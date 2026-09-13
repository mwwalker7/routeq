import assert from "node:assert/strict";
import { test } from "node:test";
import { compileRoute, Router } from "./router.js";

test("compileRoute captures a single param and matches only one segment", () => {
  const route = compileRoute({ name: "user", pattern: "/users/:id" });
  assert.deepEqual(route.paramNames, ["id"]);
  assert.ok(route.regex.test("/users/42"));
  assert.ok(!route.regex.test("/users/42/posts"));
});

test("compileRoute param name stops at the first non-word character", () => {
  const route = compileRoute({ name: "post", pattern: "/posts/:id.json" });
  assert.deepEqual(route.paramNames, ["id"]);
  const m = route.regex.exec("/posts/7.json");
  assert.ok(m);
  assert.equal(m?.[1], "7");
});

test("compileRoute throws on an empty parameter name", () => {
  assert.throws(() => compileRoute({ name: "bad", pattern: "/users/:/edit" }));
  assert.throws(() => compileRoute({ name: "bad", pattern: "/users/:" }));
});

test("compileRoute names multiple wildcards distinctly", () => {
  const route = compileRoute({ name: "mixed", pattern: "/*/static/*" });
  assert.deepEqual(route.paramNames, ["wildcard0", "wildcard1"]);
  const m = route.regex.exec("/a/b/static/c/d");
  assert.ok(m);
  assert.equal(m?.[1], "a/b");
  assert.equal(m?.[2], "c/d");
});

test("compileRoute escapes regex-special characters in literal segments", () => {
  const route = compileRoute({ name: "dotted", pattern: "/a.b+c" });
  assert.ok(route.regex.test("/a.b+c"));
  assert.ok(!route.regex.test("/aXb+c"));
  assert.ok(!route.regex.test("/a.bbc"));
});

test("compileRoute treats the root pattern as an exact match", () => {
  const route = compileRoute({ name: "root", pattern: "/" });
  assert.ok(route.regex.test("/"));
  assert.ok(!route.regex.test("/anything"));
});

test("Router.match returns the first route that matches", () => {
  const router = new Router([
    { name: "specific", pattern: "/users/me" },
    { name: "generic", pattern: "/users/:id" },
  ]);
  assert.equal(router.match("/users/me")?.name, "specific");
  assert.equal(router.match("/users/42")?.name, "generic");
});

test("Router.match strips query strings and hash fragments before matching", () => {
  const router = new Router([{ name: "user", pattern: "/users/:id" }]);
  const result = router.match("/users/42?tab=activity#top");
  assert.deepEqual(result?.params, { id: "42" });
});

test("Router.match decodes percent-encoded params", () => {
  const router = new Router([{ name: "search", pattern: "/search/:term" }]);
  const result = router.match("/search/hello%20world");
  assert.deepEqual(result?.params, { term: "hello world" });
});

test("Router.match returns null when nothing matches", () => {
  const router = new Router([{ name: "user", pattern: "/users/:id" }]);
  assert.equal(router.match("/about"), null);
});
