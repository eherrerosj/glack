import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { message, account } from "../src/adapter.ts";
test("extracts exact reply deep link and isolates account", () => {
  const { document } = new JSDOM(
    '<title>Test - Chat</title><button aria-label="Google Account: Test (test@example.com)"></button><c-wiz data-local-topic-id="parent" data-p=\'%.@.["space/room1"]\'><div data-id="reply1" data-message-multiplat-item-id="MSG/reply1"><h3>Alice</h3><div jsname="bgckF">hello</div></div></c-wiz>',
  ).window;
  const m = message(document.querySelector("[data-id]"), document);
  assert.equal(account(document), "test@example.com");
  assert.equal(
    m.url,
    "https://chat.google.com/room/room1/parent/reply1?authuser=test%40example.com",
  );
  assert.equal(m.text, "hello");
  assert.equal(m.sender, "Alice");
});
test("does not save unidentified rows under a guessed context", () => {
  const { document } = new JSDOM('<div data-id="a">Hi</div>').window;
  assert.equal(message(document.querySelector("div"), document), null);
});
test("confirmation rejects sending rows even inside a confirmed parent thread", async () => {
  const { confirmed } = await import("../src/adapter.ts");
  const { document } = new JSDOM(
    '<c-wiz data-is-local-only="false"><div data-id="id"><span jsname="E53oB">Sending…</span></div></c-wiz>',
  ).window;
  const r = document.querySelector("[data-id]");
  assert.equal(confirmed(r), false);
  r.innerHTML = '<span data-absolute-timestamp="1793177623905">Now</span>';
  assert.equal(confirmed(r), true);
});
test("message text retains emoji converted by Chat into images", async () => {
  const { textOf } = await import("../src/adapter.ts");
  const { document } = new JSDOM(
    '<div id="body"><img alt="↪"> Replied to thread:<div>Reply</div><div>View thread</div></div>',
  ).window;
  assert.equal(
    textOf(document.querySelector("#body")),
    "↪ Replied to thread:\nReply\nView thread",
  );
});
test("sent status does not depend on the cached topic local-only flag", async () => {
  const { confirmed } = await import("../src/adapter.ts");
  const { document } = new JSDOM(
    '<c-wiz data-is-local-only="true"><div data-id="server-id"><span jsname="E53oB" data-absolute-timestamp="1793177623905">Now</span></div></c-wiz>',
  ).window;
  assert.equal(confirmed(document.querySelector("[data-id]")), true);
});
