#!/usr/bin/env node
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Router, type RouteDefinition } from "./router.js";

function loadRoutes(path: string): RouteDefinition[] {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`routes file must contain a JSON array, got ${typeof parsed}`);
  }
  return parsed as RouteDefinition[];
}

async function run(): Promise<void> {
  const [, , routesPath, urlsPath] = process.argv;

  if (!routesPath) {
    process.stderr.write("usage: routeq <routes.json> [urls-file]\n");
    process.stderr.write("  urls are read from urls-file if given, otherwise from stdin\n");
    process.exitCode = 1;
    return;
  }

  const router = new Router(loadRoutes(routesPath));

  // Read line by line off a stream instead of slurping the file, so a
  // multi-gigabyte access log costs a line buffer, not the whole file.
  const input = urlsPath ? createReadStream(urlsPath, { encoding: "utf8" }) : process.stdin;
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    const url = line.trim();
    if (!url) continue;

    const result = router.match(url);
    const record = result
      ? { url, matched: true, route: result.name, params: result.params }
      : { url, matched: false };

    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}

run().catch((err) => {
  process.stderr.write(`routeq: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
