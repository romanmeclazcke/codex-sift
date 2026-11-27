import { randomUUID } from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import { injectIntoUnknown } from "./catalog.js";
import { decideTurn, fallbackTurn } from "./jev.js";
import { writeDecision, writeOutcome } from "./log.js";
import { redact } from "./redact.js";
import type { Decision, Policy } from "./types.js";
import {
  hash,
  inspectTurn,
  isRecord,
  previousResponseId,
  requestIdentity,
  requestModel,
  rewriteModel,
  taskRelation,
} from "./turns.js";
import {
  classifyPath,
  detectAuthMode,
  forwardHeaders,
  pipeUpstream,
  readIncoming,
  requestUpstream,
  upstreamFor,
} from "./upstream.js";

type TaskPin = {
  sessionId: string;
  taskId: string;
  turnId?: string;
  fingerprint?: string;
  context: string;
  decision: Promise<Decision>;
  completed: boolean;
};

type Pins = {
  sessions: Map<string, TaskPin>;
  turns: Map<string, TaskPin>;
  responses: Map<string, TaskPin>;
};

function remember(map: Map<string, TaskPin>, key: string, pin: TaskPin): void {
  map.delete(key);
  map.set(key, pin);
  if (map.size > 4096) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": body.length,
  });
  res.end(body);
}

export function startProxy(policy: Policy): Promise<{ server: http.Server; port: number; url: string }> {
  const pins: Pins = { sessions: new Map(), turns: new Map(), responses: new Map() };

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res, policy, pins);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end(`sift proxy error: ${message}`);
      } else {
        res.end();
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind loopback proxy"));
        return;
      }
      resolve({
        server,
        port: addr.port,
        url: `http://127.0.0.1:${addr.port}`,
      });
    });
    server.on("error", reject);
  });
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  policy: Policy,
  pins: Pins,
): Promise<void> {
  const incoming = new URL(req.url || "/", "http://127.0.0.1");
  const kind = classifyPath(incoming.pathname);
  const mode = detectAuthMode(req.headers);
  const target = upstreamFor(mode, incoming.pathname, incoming.search);
  const targetUrl = new URL(target.path, target.origin);
  const method = req.method || "GET";

  if (kind !== "responses") {
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
    if (kind === "models" && method === "GET") {
      await proxyModels(req, res, targetUrl, policy);
      return;
    }
    pipeUpstream(targetUrl, method, forwardHeaders(req.headers, targetUrl.host), body, req, res);
    return;
  }

  const raw = await readBody(req);
  let parsed: unknown;
  const headers = forwardHeaders(req.headers, targetUrl.host);
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    pipeUpstream(targetUrl, method, headers, raw, req, res);
    return;
  }

  if (!isRecord(parsed) || (requestModel(parsed) && requestModel(parsed) !== policy.virtual_model.slug)) {
    pipeUpstream(targetUrl, method, headers, raw, req, res);
    return;
  }

  const { latest, first, prior, isUserTurn, historyDepth } = inspectTurn(parsed);
  const identity = requestIdentity(parsed, req.headers);
  const scope = hash(JSON.stringify([targetUrl.origin, req.headers.authorization, req.headers["chatgpt-account-id"]]));
  const sessionKey = identity.session
    ? `${scope}:session:${hash(identity.session)}`
    : first && `${scope}:history:${first.fingerprint}`;
  const turnKey = identity.turn && `${identity.session ? sessionKey : scope}:turn:${hash(identity.turn)}`;
  const parentId = previousResponseId(parsed);
  const parent = parentId ? pins.responses.get(`${scope}:${parentId}`) : undefined;
  const knownSession = sessionKey ? pins.sessions.get(sessionKey) : undefined;
  const priorPin = parent ?? (identity.session || !isUserTurn || historyDepth > 1 ? knownSession : undefined);
  const turnPin = turnKey ? pins.turns.get(turnKey) : undefined;
  const sameTurn = identity.turn === undefined || priorPin?.turnId === identity.turn;
  const fingerprint = latest && `${historyDepth}:${latest.fingerprint}`;
  const repeating = isUserTurn && priorPin && !priorPin.completed && sameTurn && priorPin.fingerprint === fingerprint;
  let pin = turnPin ?? (repeating || !isUserTurn ? priorPin : undefined);
  const requestKind = pin ? "continuation" : "initial";
  if (!pin) {
    const prompt = latest?.text ?? "";
    const relation = taskRelation(prompt);
    const previousTask = relation === "new" ? undefined : parent?.context || prior?.text || priorPin?.context;
    const sessionId = priorPin?.sessionId ?? randomUUID();
    const taskId = randomUUID();
    const decide = async () => {
      if (!isUserTurn) {
        return fallbackTurn(policy, prompt, latest?.hasImage ?? false, "No pinned route for this continuation, using fallback lane");
      }
      const previousLane = relation === "new" ? undefined : (await priorPin?.decision)?.lane;
      return decideTurn(policy, prompt, {
        hasImage: latest?.hasImage,
        retry: relation === "retry",
        previousLane,
        previousTask,
      });
    };

    pin = {
      sessionId,
      taskId,
      turnId: identity.turn,
      fingerprint,
      context: redact(previousTask || prompt, 512),
      decision: decide().then((selected) => {
        writeDecision(selected, prompt, { session_id: sessionId, task_id: taskId, policy });
        return selected;
      }),
      completed: false,
    };
    if (sessionKey) remember(pins.sessions, sessionKey, pin);
    if (turnKey) remember(pins.turns, turnKey, pin);
  }

  const selected = await pin.decision;
  const outbound = rewriteModel(parsed, selected.model, selected.effort);
  const payload = Buffer.from(JSON.stringify(outbound));
  headers["content-length"] = payload.length;
  headers["content-type"] = "application/json";
  const task = pin;
  pipeUpstream(targetUrl, method, headers, payload, req, res, {
    onResponseId(id) {
      remember(pins.responses, `${scope}:${id}`, task);
    },
    onComplete(result) {
      if (result.outcome === "completed") task.completed = true;
      writeOutcome({ session_id: task.sessionId, task_id: task.taskId, request_kind: requestKind, ...result });
    },
  });
}

async function proxyModels(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetUrl: URL,
  policy: Policy,
): Promise<void> {
  try {
    const up = await requestUpstream(targetUrl, "GET", forwardHeaders(req.headers, targetUrl.host));
    const raw = await readIncoming(up);
    try {
      const parsed = JSON.parse(raw.toString("utf8") || "{}");
      json(res, up.statusCode || 200, injectIntoUnknown(parsed, policy));
    } catch {
      res.writeHead(up.statusCode || 200, up.headers);
      res.end(raw);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`sift models error: ${message}`);
  }
}
