"use strict";
(() => {
  // src/preferences.ts
  function preferences(raw = {}) {
    return {
      theme: ["aubergine", "light", "dark", "ocean", "native"].includes(
        raw?.theme
      ) ? raw.theme : "aubergine",
      compact: typeof raw?.compact === "boolean" ? raw.compact : true,
      collapseMedia: raw?.collapseMedia === true,
      code: raw?.code !== false,
      keywords: (Array.isArray(raw?.keywords) ? raw.keywords : []).filter((x) => typeof x === "string").map((x) => x.trim().slice(0, 80)).filter(
        (x, i, all) => x && all.findIndex((v) => v.toLowerCase() === x.toLowerCase()) === i
      ).slice(0, 30),
      alerts: raw?.alerts === true
    };
  }

  // src/core.ts
  var emptyState = () => ({
    version: 1,
    items: [],
    sections: []
  });
  function safeLink(link) {
    try {
      const u = new URL(link);
      return u.protocol === "https:" && u.hostname === "chat.google.com" && !u.username && !u.password;
    } catch {
      return false;
    }
  }
  function upsert(items, item) {
    const old = items.find((x) => x.id === item.id);
    return [
      ...items.filter((x) => x.id !== item.id),
      { ...old, ...item, savedAt: old?.savedAt ?? item.savedAt }
    ];
  }
  function validateBackup(value) {
    const s = value;
    if (!s || s.version !== 1 || !Array.isArray(s.items) || !Array.isArray(s.sections) || s.items.length > 1e4 || s.sections.length > 50)
      throw Error("This is not a supported Workbench backup");
    for (const i of s.items)
      if (!i || typeof i.id !== "string" || i.id.length > 300 || typeof i.text !== "string" || i.text.length > 3e4 || !Number.isFinite(i.savedAt) || !safeLink(i.url ?? "") || i.due !== void 0 && !Number.isFinite(i.due))
        throw Error("Backup contains an invalid saved message");
    for (const c of s.sections)
      if (!c || typeof c.id !== "string" || typeof c.name !== "string" || c.name.length > 80 || !Array.isArray(c.links) || c.links.some((l) => typeof l.name !== "string" || !safeLink(l.url)))
        throw Error("Backup contains an invalid collection");
    return structuredClone(s);
  }

  // src/background.ts
  var serial = Promise.resolve();
  var key = (account) => `account:${account}`;
  function accountOK(a) {
    return typeof a === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a) && a.length < 254;
  }
  async function read(account) {
    return (await chrome.storage.local.get(key(account)))[key(account)] ?? emptyState();
  }
  async function reconcile() {
    const all = await chrome.storage.local.get(null);
    for (const [k, s] of Object.entries(all)) {
      if (!k.startsWith("account:")) continue;
      for (const item of s.items) {
        const name = JSON.stringify([k.slice(8), item.id]);
        if (item.due && !item.done && !item.notified)
          await chrome.alarms.create(name, {
            when: Math.max(item.due, Date.now() + 1e3)
          });
        else await chrome.alarms.clear(name);
      }
    }
  }
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !accountOK(msg.account)) {
      reply({ error: "Account unavailable. Open Chat and sign in." });
      return false;
    }
    serial = serial.then(async () => {
      try {
        const state = await read(msg.account);
        switch (msg.type) {
          case "visit": {
            if (!safeLink(msg.url ?? "") || typeof msg.name !== "string")
              throw Error("Invalid conversation");
            state.recent = [
              { name: msg.name.slice(0, 200), url: msg.url, seen: Date.now() },
              ...(state.recent ?? []).filter((c) => c.url !== msg.url)
            ].slice(0, 80);
            break;
          }
          case "preferences":
            state.preferences = preferences(msg.preferences);
            break;
          case "radar": {
            if (!state.preferences?.alerts || !safeLink(msg.url ?? ""))
              throw Error("Radar alerts disabled");
            const k = `radar:${msg.account}:${String(msg.id).slice(0, 300)}`;
            if ((await chrome.storage.session.get(k))[k]) {
              reply({ state });
              return;
            }
            await chrome.storage.session.set({ [k]: true });
            const id = `radar:${crypto.randomUUID()}`;
            await chrome.storage.session.set({ [id]: msg.url });
            await chrome.notifications.create(id, {
              type: "basic",
              iconUrl: "icon.png",
              title: "Keyword radar",
              message: String(msg.text).slice(0, 240)
            });
            reply({ state });
            return;
          }
          case "read":
            reply({ state });
            return;
          case "save": {
            const x = msg.item;
            if (!x || typeof x.id !== "string" || typeof x.text !== "string" || !safeLink(x.url ?? "") || !Number.isFinite(x.savedAt))
              throw Error("Invalid saved message");
            if (x.due && (!Number.isFinite(x.due) || x.due <= Date.now()))
              throw Error("Choose a future time");
            const existing = state.items.find((item) => item.id === x.id);
            state.items = upsert(state.items, {
              id: x.id.slice(0, 300),
              text: x.text.slice(0, 3e4),
              url: x.url,
              sender: String(x.sender ?? "").slice(0, 200),
              space: String(x.space ?? "").slice(0, 200),
              savedAt: x.savedAt,
              done: false,
              due: x.due ?? existing?.due,
              notified: x.due ? false : existing?.notified
            });
            break;
          }
          case "update": {
            const item = state.items.find((x) => x.id === msg.id);
            if (!item) throw Error("Saved item not found");
            if (typeof msg.done === "boolean") item.done = msg.done;
            if (msg.due === null) {
              delete item.due;
              delete item.notified;
            } else if (msg.due !== void 0) {
              if (!Number.isFinite(msg.due) || msg.due <= Date.now())
                throw Error("Choose a future time");
              item.due = msg.due;
              item.notified = false;
              item.done = false;
            }
            break;
          }
          case "import": {
            const backup = validateBackup(msg.backup);
            if (backup.preferences)
              state.preferences = preferences(backup.preferences);
            for (const item of backup.items)
              state.items = upsert(state.items, item);
            for (const section of backup.sections)
              if (!state.sections.some((s) => s.id === section.id))
                state.sections.push(section);
            break;
          }
          case "sections": {
            if (!Array.isArray(msg.sections) || msg.sections.length > 50)
              throw Error("Invalid sections");
            state.sections = msg.sections.map((s) => ({
              id: String(s.id).slice(0, 80),
              name: String(s.name).slice(0, 80),
              collapsed: !!s.collapsed,
              links: (s.links ?? []).filter((l) => safeLink(l.url)).slice(0, 300).map((l) => ({
                name: String(l.name).slice(0, 200),
                url: l.url
              }))
            }));
            break;
          }
          default:
            throw Error("Unknown action");
        }
        await chrome.storage.local.set({ [key(msg.account)]: state });
        await reconcile();
        reply({ state });
      } catch (e) {
        reply({ error: e instanceof Error ? e.message : "Storage failed" });
      }
    });
    return true;
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    serial = serial.then(async () => {
      try {
        const [account, id] = JSON.parse(alarm.name);
        const state = await read(account);
        const item = state.items.find((x) => x.id === id);
        if (!item?.due || item.done || item.notified || item.due > Date.now())
          return;
        item.notified = true;
        await chrome.storage.local.set({ [key(account)]: state });
        await chrome.notifications.create(alarm.name, {
          type: "basic",
          iconUrl: "icon.png",
          title: `Reminder \xB7 ${item.space || "Google Chat"}`,
          message: `${item.sender || "Message"}: ${item.text.slice(0, 220)}`,
          buttons: [{ title: "Open message" }, { title: "Snooze 20 minutes" }],
          priority: 1
        });
      } catch (e) {
        console.warn("Reminder delivery failed", e);
      }
    });
  });
  async function openReminder(id) {
    if (id.startsWith("radar:")) {
      const url = (await chrome.storage.session.get(id))[id];
      if (typeof url === "string" && safeLink(url))
        await chrome.tabs.create({ url });
      return;
    }
    try {
      const [account, itemId] = JSON.parse(id);
      const item = (await read(account)).items.find((x) => x.id === itemId);
      if (item?.url && safeLink(item.url))
        await chrome.tabs.create({ url: item.url });
    } catch {
    }
  }
  chrome.notifications.onClicked.addListener(openReminder);
  chrome.notifications.onButtonClicked.addListener((id, index) => {
    if (index === 0) void openReminder(id);
    else
      serial = serial.then(async () => {
        const [account, itemId] = JSON.parse(id);
        const state = await read(account);
        const item = state.items.find((x) => x.id === itemId);
        if (item) {
          item.due = Date.now() + 12e5;
          item.notified = false;
          await chrome.storage.local.set({ [key(account)]: state });
          await reconcile();
        }
      });
  });
  chrome.runtime.onStartup.addListener(() => void reconcile());
  chrome.runtime.onInstalled.addListener(() => void reconcile());
  chrome.action.onClicked.addListener(
    () => void chrome.tabs.create({
      url: "https://chat.google.com/app/home#workbench"
    })
  );
})();
//# sourceMappingURL=background.js.map
