import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
async function harness() {
  const session = {};
  const db = {},
    alarms = new Map(),
    notifications = [];
  const listeners = {};
  const event = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
  const chrome = {
    storage: {
      session: {
        get: async (k) => ({ [k]: session[k] }),
        set: async (x) => Object.assign(session, x),
      },
      local: {
        get: async (k) =>
          k === null ? structuredClone(db) : { [k]: structuredClone(db[k]) },
        set: async (x) => Object.assign(db, structuredClone(x)),
      },
    },
    runtime: {
      id: "test",
      onMessage: event("message"),
      onInstalled: event("installed"),
      onStartup: event("startup"),
    },
    alarms: {
      create: async (n, a) => alarms.set(n, a),
      clear: async (n) => alarms.delete(n),
      onAlarm: event("alarm"),
    },
    notifications: {
      create: async (n, o) => notifications.push({ n, o }),
      onClicked: event("clicked"),
      onButtonClicked: event("button"),
    },
    tabs: { create: async () => {} },
    action: { onClicked: event("action") },
  };
  vm.runInNewContext(
    await readFile(new URL("../dist/background.js", import.meta.url), "utf8"),
    { chrome, console, Date, JSON, Promise, URL, crypto },
  );
  const rpc = (data, account = "a@example.com") =>
    new Promise((resolve) =>
      listeners.message({ ...data, account }, { id: "test" }, resolve),
    );
  return { rpc, db, alarms, notifications, listeners };
}
const item = {
  id: "room/topic/msg",
  text: "Review this",
  url: "https://chat.google.com/room/room/topic/msg",
  savedAt: 1,
};
test("serial storage preserves simultaneous saves and isolates accounts", async () => {
  const h = await harness();
  await Promise.all([
    h.rpc({ type: "save", item }),
    h.rpc({ type: "save", item: { ...item, id: "second" } }),
  ]);
  assert.equal((await h.rpc({ type: "read" })).state.items.length, 2);
  assert.equal(
    (await h.rpc({ type: "read" }, "b@example.com")).state.items.length,
    0,
  );
});
test("alarm is persisted and duplicate delivery suppressed", async () => {
  const h = await harness();
  await h.rpc({ type: "save", item: { ...item, due: Date.now() + 10000 } });
  assert.equal(h.alarms.size, 1);
  h.db["account:a@example.com"].items[0].due = Date.now() - 1;
  const name = [...h.alarms.keys()][0];
  h.listeners.alarm({ name });
  h.listeners.alarm({ name });
  await h.rpc({ type: "read" });
  assert.equal(h.notifications.length, 1);
  assert.equal(h.db["account:a@example.com"].items[0].notified, true);
});
test("completing clears the scheduled alarm", async () => {
  const h = await harness();
  await h.rpc({ type: "save", item: { ...item, due: Date.now() + 10000 } });
  await h.rpc({ type: "update", id: item.id, done: true });
  assert.equal(h.alarms.size, 0);
});
test("bookmarking an existing reminder preserves its schedule", async () => {
  const h = await harness();
  const due = Date.now() + 100000;
  await h.rpc({ type: "save", item: { ...item, due } });
  await h.rpc({ type: "save", item });
  assert.equal((await h.rpc({ type: "read" })).state.items[0].due, due);
});
test("invalid reminder does not mutate stored data", async () => {
  const h = await harness();
  assert.match(
    (await h.rpc({ type: "save", item: { ...item, due: Date.now() - 1 } }))
      .error,
    /future/,
  );
  assert.equal((await h.rpc({ type: "read" })).state.items.length, 0);
});

test("radar notifications respect opt-in and deduplicate per account", async () => {
  const h = await harness();
  const match = { type: "radar", id: "one", text: "incident", url: item.url };
  assert.match((await h.rpc(match)).error, /disabled/);
  await h.rpc({
    type: "preferences",
    preferences: { alerts: true, keywords: ["incident"], theme: "dark" },
  });
  await Promise.all([h.rpc(match), h.rpc(match)]);
  assert.equal(h.notifications.length, 1);
  assert.equal((await h.rpc({ type: "read" })).state.preferences.theme, "dark");
  assert.equal(
    (await h.rpc({ type: "read" }, "b@example.com")).state.preferences,
    undefined,
  );
});
test("recent conversations survive reads and stay scoped to the account", async () => {
  const h = await harness();
  await h.rpc({ type: "visit", name: "Lab", url: item.url });
  await h.rpc({ type: "visit", name: "Lab", url: item.url });
  assert.equal((await h.rpc({ type: "read" })).state.recent.length, 1);
  assert.equal(
    (await h.rpc({ type: "read" }, "b@example.com")).state.recent,
    undefined,
  );
});
test("preference patches from other tabs do not revert the saved theme", async () => {
  const h = await harness();
  await h.rpc({ type: "preferences", patch: { theme: "dark" } });
  await h.rpc({ type: "preferences", patch: { compact: false } });
  let result = await h.rpc({ type: "read" });
  assert.equal(result.state.preferences.theme, "dark");
  assert.equal(result.state.preferences.compact, false);
  await Promise.all(
    ["ocean", "light", "aubergine", "dark"].map((theme) =>
      h.rpc({ type: "preferences", patch: { theme } }),
    ),
  );
  result = await h.rpc({ type: "read" });
  assert.equal(result.state.preferences.theme, "dark");
  assert.equal(result.state.preferences.compact, false);
});
