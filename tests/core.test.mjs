import { parseBroadcast } from "../src/core.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reminderTime,
  safeLink,
  upsert,
  broadcastText,
  canBroadcast,
} from "../src/core.ts";
test("tomorrow means next calendar day at 9", () => {
  const now = new Date(2026, 9, 24, 23, 30);
  const t = new Date(reminderTime("tomorrow", now.getTime()));
  assert.equal(t.getDate(), 25);
  assert.equal(t.getHours(), 9);
  assert.equal(t.getMinutes(), 0);
});
test("offsets are relative to clock", () =>
  assert.equal(reminderTime("20m", 1000), 1201000));
test("links reject scripts and unrelated origins", () => {
  assert.equal(safeLink("javascript:alert(1)"), false);
  assert.equal(safeLink("https://chat.google.com.evil.test/room/a"), false);
  assert.equal(safeLink("https://chat.google.com/room/abc/def/ghi"), true);
});
test("saving twice retains identity and original saved time", () => {
  let a = upsert([], { id: "a", text: "first", savedAt: 1 });
  a = upsert(a, { id: "a", text: "changed", savedAt: 2 });
  assert.equal(a.length, 1);
  assert.equal(a[0].savedAt, 1);
  assert.equal(a[0].text, "changed");
});
test("broadcast includes human-readable context and canonical link", () => {
  assert.equal(
    broadcastText(
      "Resolved",
      "Parent\nquestion",
      "https://chat.google.com/room/a/b/b",
    ),
    "↪ Replied to thread: Parent question\n\nResolved\n\nView thread: https://chat.google.com/room/a/b/b",
  );
});
test("broadcast refuses navigation, occupied root draft, and missing confirmation", () => {
  const ok = {
    sameContext: true,
    rootEmpty: true,
    replyConfirmed: true,
    richContent: false,
  };
  assert.equal(canBroadcast(ok), true);
  for (const k of ["sameContext", "rootEmpty", "replyConfirmed"])
    assert.equal(canBroadcast({ ...ok, [k]: false }), false);
  assert.equal(canBroadcast({ ...ok, richContent: true }), false);
});
test("backup validation rejects executable links and malformed data", async () => {
  const { validateBackup } = await import("../src/core.ts");
  assert.throws(() =>
    validateBackup({
      version: 1,
      items: [{ id: "x", text: "x", savedAt: 1, url: "javascript:alert(1)" }],
      sections: [],
    }),
  );
  assert.throws(() => validateBackup({ version: 2, items: [], sections: [] }));
  assert.equal(
    validateBackup({ version: 1, items: [], sections: [] }).version,
    1,
  );
});
test("composer comparison tolerates Chat collapsing empty lines", async () => {
  const { sameText } = await import("../src/core.ts");
  assert.equal(
    sameText("Parent\n\nReply\n\nLink", "Parent\nReply\nLink"),
    true,
  );
  assert.equal(sameText("Reply one", "Reply two"), false);
});
test("broadcast presentation extracts context and preserves reply paragraphs", () => {
  const text = broadcastText(
    "First paragraph\n\nSecond paragraph",
    "Original topic",
    "https://chat.google.com/room/s/t/t?authuser=a%40b.com",
  );
  assert.deepEqual(parseBroadcast(text), {
    parent: "Original topic",
    reply: "First paragraph\n\nSecond paragraph",
    url: "https://chat.google.com/room/s/t/t?authuser=a%40b.com",
  });
  assert.equal(parseBroadcast("Normal message"), null);
  assert.equal(
    parseBroadcast(
      text.replace("https://chat.google.com", "https://evil.example"),
    ),
    null,
  );
});
