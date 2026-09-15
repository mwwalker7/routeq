export interface RouteDefinition {
  name: string;
  pattern: string;
}

export interface CompiledRoute {
  name: string;
  pattern: string;
  regex: RegExp;
  paramNames: string[];
}

export interface MatchResult {
  name: string;
  pattern: string;
  params: Record<string, string>;
}

// Finds the index of the ")" that closes the "(" at openIndex, accounting for
// nesting and backslash-escaped parens. Returns -1 if it's never closed.
function findMatchingParen(pattern: string, openIndex: number): number {
  let depth = 0;
  for (let k = openIndex; k < pattern.length; k++) {
    const c = pattern[k];
    if (c === "\\") {
      k++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

// A regex constraint can contain its own groups, e.g. :id((foo|bar)\d+). Those
// would shift the capture indices we rely on to line up with paramNames, so
// every "(" that isn't already a non-capturing or named marker gets rewritten
// to "(?:". Only the group we wrap the whole constraint in stays capturing.
function toNonCapturing(body: string): string {
  let result = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      result += c + (body[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "(" && body[i + 1] !== "?") {
      result += "(?:";
      continue;
    }
    result += c;
  }
  return result;
}

// Express-style patterns: ":name" captures a single path segment, ":name(re)"
// constrains that segment to the given regex, "*" captures the rest
// (including slashes). Everything else is matched literally.
export function compileRoute(def: RouteDefinition): CompiledRoute {
  const pattern = def.pattern;
  const paramNames: string[] = [];
  let regexSource = "";

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (ch === ":") {
      let j = i + 1;
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) j++;
      const name = pattern.slice(i + 1, j);
      if (!name) {
        throw new Error(`empty parameter name in pattern "${pattern}" at index ${i}`);
      }
      paramNames.push(name);

      let constraint = "[^/]+";
      let end = j;
      if (pattern[j] === "(") {
        const close = findMatchingParen(pattern, j);
        if (close === -1) {
          throw new Error(`unterminated regex constraint in pattern "${pattern}" at index ${j}`);
        }
        const body = pattern.slice(j + 1, close);
        if (!body) {
          throw new Error(`empty regex constraint in pattern "${pattern}" at index ${j}`);
        }
        try {
          new RegExp(body);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          throw new Error(`invalid regex constraint in pattern "${pattern}" at index ${j}: ${reason}`);
        }
        constraint = toNonCapturing(body);
        end = close + 1;
      }

      regexSource += `(${constraint})`;
      i = end - 1;
    } else if (ch === "*") {
      const wildcardName = `wildcard${paramNames.filter((n) => n.startsWith("wildcard")).length}`;
      paramNames.push(wildcardName);
      regexSource += "(.*)";
    } else {
      regexSource += escapeLiteral(ch);
    }
  }

  return {
    name: def.name,
    pattern,
    regex: new RegExp(`^${regexSource}$`),
    paramNames,
  };
}

function escapeLiteral(ch: string): string {
  return /[.+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

function stripQueryAndHash(input: string): string {
  return input.split("#")[0].split("?")[0];
}

export class Router {
  private readonly routes: CompiledRoute[];

  constructor(definitions: RouteDefinition[]) {
    this.routes = definitions.map(compileRoute);
  }

  // First matching route wins, same as most web frameworks' route tables.
  match(url: string): MatchResult | null {
    const path = stripQueryAndHash(url);

    for (const route of this.routes) {
      const m = route.regex.exec(path);
      if (!m) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, idx) => {
        params[name] = decodeURIComponent(m[idx + 1]);
      });

      return { name: route.name, pattern: route.pattern, params };
    }

    return null;
  }
}
