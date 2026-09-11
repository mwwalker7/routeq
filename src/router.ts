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

// Express-style patterns: ":name" captures a single path segment, "*" captures
// the rest (including slashes). Everything else is matched literally.
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
      regexSource += "([^/]+)";
      i = j - 1;
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
