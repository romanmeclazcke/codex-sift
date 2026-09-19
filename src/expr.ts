export type ValueMap = Record<string, string | number | boolean>;

type Token =
  | { kind: "id"; value: string }
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "lbrack" }
  | { kind: "rbrack" }
  | { kind: "comma" }
  | { kind: "eof" };

const OPS = ["==", "!=", ">=", "<=", ">", "<"];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.trim();
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (c === "[") {
      tokens.push({ kind: "lbrack" });
      i++;
      continue;
    }
    if (c === "]") {
      tokens.push({ kind: "rbrack" });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ kind: "comma" });
      i++;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (OPS.includes(two)) {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if (OPS.includes(c)) {
      tokens.push({ kind: "op", value: c });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      let value = "";
      while (i < s.length && s[i] !== q) {
        value += s[i++];
      }
      i++;
      tokens.push({ kind: "str", value });
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const start = i;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      tokens.push({ kind: "num", value: Number(s.slice(start, i)) });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
      tokens.push({ kind: "id", value: s.slice(start, i) });
      continue;
    }
    throw new Error(`Unexpected character '${c}' in expression: ${input}`);
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

class Parser {
  constructor(
    private tokens: Token[],
    private values: ValueMap,
  ) {}
  i = 0;

  peek(): Token {
    return this.tokens[this.i];
  }

  eat(): Token {
    return this.tokens[this.i++];
  }

  parse(): boolean {
    const value = this.parseOr();
    if (this.peek().kind !== "eof") {
      throw new Error("Trailing tokens in expression");
    }
    return Boolean(value);
  }

  parseOr(): boolean {
    let left = this.parseAnd();
    while (this.peek().kind === "id" && (this.peek() as { value?: string }).value === "or") {
      this.eat();
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  parseAnd(): boolean {
    let left = this.parseCmp();
    while (this.peek().kind === "id" && (this.peek() as { value?: string }).value === "and") {
      this.eat();
      const right = this.parseCmp();
      left = left && right;
    }
    return left;
  }

  parseCmp(): boolean {
    if (this.peek().kind === "lparen") {
      this.eat();
      const inner = this.parseOr();
      if (this.peek().kind !== "rparen") throw new Error("Missing )");
      this.eat();
      return inner;
    }
    const first = this.eat();
    if (first.kind === "id" && first.value === "true") return true;
    if (first.kind === "id" && first.value === "false") return false;
    if (first.kind !== "id") throw new Error("Expected identifier");

    const next = this.peek();
    if (next.kind === "id" && next.value === "in") {
      this.eat();
      const list = this.parseList();
      return list.includes(String(this.lookup(first.value)));
    }
    if (next.kind === "op") {
      const op = this.eat() as { kind: "op"; value: string };
      const rightTok = this.eat();
      const left = this.lookup(first.value);
      const right = this.literal(rightTok);
      return compare(left, op.value, right);
    }
    return Boolean(this.lookup(first.value));
  }

  parseList(): string[] {
    if (this.peek().kind !== "lbrack") throw new Error("Expected [list]");
    this.eat();
    const items: string[] = [];
    while (this.peek().kind !== "rbrack" && this.peek().kind !== "eof") {
      const tok = this.eat();
      if (tok.kind === "id" || tok.kind === "str") items.push(tok.value);
      else if (tok.kind === "num") items.push(String(tok.value));
      if (this.peek().kind === "comma") this.eat();
    }
    if (this.peek().kind !== "rbrack") throw new Error("Missing ]");
    this.eat();
    return items;
  }

  lookup(name: string): string | number | boolean {
    if (!(name in this.values)) throw new Error(`Unknown signal '${name}'`);
    return this.values[name];
  }

  literal(tok: Token): string | number | boolean {
    if (tok.kind === "num") return tok.value;
    if (tok.kind === "str") return tok.value;
    if (tok.kind === "id") {
      if (tok.value === "true") return true;
      if (tok.value === "false") return false;
      if (tok.value in this.values) return this.values[tok.value];
      return tok.value;
    }
    throw new Error("Expected literal");
  }
}

function compare(left: string | number | boolean, op: string, right: string | number | boolean): boolean {
  if (op === "==") return left === right;
  if (op === "!=") return left !== right;
  const l = Number(left);
  const r = Number(right);
  if (op === ">") return l > r;
  if (op === ">=") return l >= r;
  if (op === "<") return l < r;
  if (op === "<=") return l <= r;
  throw new Error(`Unknown operator ${op}`);
}

export function evalWhen(expr: string | boolean, values: ValueMap): boolean {
  if (typeof expr === "boolean") return expr;
  return new Parser(tokenize(String(expr)), values).parse();
}
