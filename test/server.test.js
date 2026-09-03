import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer, parsePort } from "../src/server.js";

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

describe("fuzzball API", () => {
  it("reports health", async () => {
    const { response, body } = await request("/health");
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  });

  it("calculates a ratio", async () => {
    const { response, body } = await request("/?a=asdf&b=asdfasdf");
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ratio: 67 });
  });

  it("extracts the best match", async () => {
    const { response, body } = await request("/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "appl", choices: ["apple", "banana", "apply"], cutoff: 80 }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(body, { choice: "apple", score: 89 });
  });

  it("returns nulls when no choice meets the cutoff", async () => {
    const { body } = await request("/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "apple", choices: ["pear"], cutoff: 90 }),
    });
    assert.deepEqual(body, { choice: null, score: null });
  });

  it("rejects invalid JSON shapes and cutoffs", async () => {
    const nullBody = await request("/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });
    assert.equal(nullBody.response.status, 400);
    assert.deepEqual(nullBody.body, { error: "Request body must be a JSON object" });

    const badCutoff = await request("/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "a", choices: ["a"], cutoff: 101 }),
    });
    assert.equal(badCutoff.response.status, 400);
  });

  it("requires JSON content and returns method metadata", async () => {
    const mediaType = await request("/extract", { method: "POST", body: "{}" });
    assert.equal(mediaType.response.status, 415);

    const method = await request("/health", { method: "POST" });
    assert.equal(method.response.status, 405);
    assert.equal(method.response.headers.get("allow"), "GET");
  });
});

describe("parsePort", () => {
  it("accepts valid ports and rejects invalid values", () => {
    assert.equal(parsePort("8080"), 8080);
    for (const value of ["0", "65536", "3.14", "abc"]) {
      assert.throws(() => parsePort(value), /PORT must be/);
    }
  });
});
