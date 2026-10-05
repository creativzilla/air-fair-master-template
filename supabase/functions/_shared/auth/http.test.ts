import test from "node:test";
import assert from "node:assert/strict";
import { isUuid, publicFailure, readJsonObject, RequestError } from "./http.ts";

const req = (body: string, headers = {}) => new Request("https://local.test", { method: "POST", body, headers });
test("JSON requests require an object and count actual UTF-8 bytes", async () => {
  assert.deepEqual(await readJsonObject(req('{"action":"list"}'), 100), { action: "list" });
  for (const body of ["null", "[]", "1", '"text"', "{bad"]) {
    await assert.rejects(readJsonObject(req(body), 100), /Invalid request body/);
  }
  await assert.rejects(readJsonObject(req('{"text":"😀😀"}'), 15), (e: unknown) => e instanceof RequestError && e.status === 413);
  await assert.rejects(readJsonObject(req('{"text":"long value"}', { "content-length": "1" }), 10), /too large/);
  await assert.rejects(readJsonObject(req('{}', { "content-length": "1000" }), 10), /too large/);
});
test("streamed oversized bodies are cancelled without waiting for the whole payload", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(20)); }, cancel() { cancelled = true; } });
  const request = new Request("https://local.test", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readJsonObject(request, 10), /too large/);
  assert.equal(cancelled, true);
});
test("only deliberate validation errors are exposed, never database/provider errors", () => {
  for (const error of [new Error("private customer payload"), { message: "database details", code: "23505" }, "sensitive"]) {
    assert.deepEqual(publicFailure(error), { status: 500, body: { error: "Request failed. Please try again." } });
  }
  assert.equal(publicFailure(new RequestError("Invalid ID.")).body.error, "Invalid ID.");
  assert.equal(isUuid("00000000-0000-0000-0000-000000000001"), true);
  for (const id of ["-".repeat(36), "not-an-id", null, {}, 1]) assert.equal(isUuid(id), false);
});
