import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { SseFooterTransform } from "./proxy.js";

test("SSE footer preserves UTF-8 characters split across network chunks", async () => {
  const event = `event: response.output_text.done\ndata: ${JSON.stringify({ type: "response.output_text.done", text: "café", item_id: "msg_1", output_index: 0, content_index: 0 })}\n\n`;
  const bytes = Buffer.from(event, "utf8");
  const accent = bytes.indexOf(Buffer.from("é", "utf8"));
  assert.ok(accent > 0);
  const split = accent + 1;
  const output: Buffer[] = [];
  for await (const chunk of Readable.from([bytes.subarray(0, split), bytes.subarray(split)]).pipe(new SseFooterTransform(() => " footer"))) {
    output.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(output).toString("utf8");
  assert.match(text, /café footer/);
  assert.doesNotMatch(text, /�/);
});
