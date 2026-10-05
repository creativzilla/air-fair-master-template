import assert from "node:assert/strict";
import test from "node:test";
import { invitationRedirect } from "./redirect.ts";

test("invitations default to the configured dashboard; other origins require explicit configuration", () => {
  const site = "https://airfairtravel.com";
  assert.equal(invitationRedirect(undefined, site), `${site}/dashboard`);
  assert.equal(invitationRedirect(`${site}/dashboard`, site), `${site}/dashboard`);
  assert.equal(invitationRedirect("http://localhost:5173/dashboard", site, "http://localhost:5173"), "http://localhost:5173/dashboard");
  for (const destination of ["https://evil.example/dashboard", "https://airfairtravel.com.evil.example/dashboard",
    "https://evil.example@airfairtravel.com/dashboard", "http://airfairtravel.com/dashboard", "//evil.example/dashboard",
    `${site}/dashboard?next=https://evil.example`, `${site}/dashboard#access_token=x`, `${site}/other`,
    "http://localhost:5173/dashboard", "javascript:alert(1)", {}, 1]) {
    assert.throws(() => invitationRedirect(destination, site));
  }
  assert.throws(() => invitationRedirect(undefined, "http://untrusted.example"));
  assert.throws(() => invitationRedirect(undefined, site, "https://extra.example/path"));
});
