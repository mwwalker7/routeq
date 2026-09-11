# routeq

You have a routing table — the list of URL patterns your app or API gateway
matches against — and a pile of URLs: an access log, a list of links scraped
off a site, a batch of incoming webhook targets. The question you actually
want answered is simple: **for each of these URLs, which route matches, and
what are the extracted parameters?**

Most routers don't answer that question directly. They're built into a
framework and wired to live request handling, so getting a straight answer
means spinning up a server, sending fake requests through it, and reading the
result back out. routeq skips all of that. Give it a route table and a list
of URLs, and it tells you what matched.

Access logs can be large — gigabytes, not lines. routeq reads its input one
line at a time with a streaming line reader, so it holds a single line in
memory at any point rather than the whole file. It works the same way against
stdin, so you can pipe a live log through it.

## Route table format

A JSON array of `{ "name": ..., "pattern": ... }` objects. Patterns use
`:name` for a single path segment and `*` for "everything after this point,
slashes included". Routes are tried in order and the first match wins, same
as in Express or similar frameworks.

```json
[
  { "name": "user-profile", "pattern": "/users/:id" },
  { "name": "user-posts", "pattern": "/users/:id/posts/:postId" },
  { "name": "static-asset", "pattern": "/static/*" }
]
```

## Usage

Build it (there's nothing to install — no third-party dependencies):

```
tsc
```

Then query a file of URLs:

```
node dist/cli.js routes.json urls.txt
```

or pipe them in:

```
tail -f /var/log/nginx/access.log | extract-urls | node dist/cli.js routes.json
```

Each input line produces one JSON line of output:

```
{"url":"/users/42","matched":true,"route":"user-profile","params":{"id":"42"}}
{"url":"/users/42/posts/7","matched":true,"route":"user-posts","params":{"id":"42","postId":"7"}}
{"url":"/about","matched":false}
```

Query strings and fragments (`?...`, `#...`) are stripped before matching,
since they're not part of the route path.

## Library use

The matching logic is also usable directly, without the CLI:

```ts
import { Router } from "./src/router.js";

const router = new Router([
  { name: "user-profile", pattern: "/users/:id" },
]);

router.match("/users/42?tab=activity");
// { name: "user-profile", pattern: "/users/:id", params: { id: "42" } }
```

## License

MIT
