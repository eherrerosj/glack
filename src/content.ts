import {
  emptyState,
  reminderTime,
  broadcastText,
  canBroadcast,
  type State,
  type Item,
  type Section,
} from "./core";
import {
  account,
  message,
  rows,
  editorSelector,
  composer,
  rootEditor,
  sendButton,
  textOf,
  putDraft,
  waitFor,
} from "./adapter";
import css from "./style.css";
if (window.top === window && location.pathname !== "/drivesharing/driveshare")
  start();
function start() {
  let state: State = emptyState(),
    identity: string | null = null,
    open = false,
    view = "later",
    query = "",
    busy = false;
  let selected: Item | null = null;
  let returnFocus: HTMLElement | null = null;
  const host = document.createElement("div");
  host.id = "cw-host";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  shadow.append(style);
  document.body.append(host);
  const ui = document.createElement("div");
  shadow.append(ui);
  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls = "",
    text = "",
  ) {
    const n = document.createElement(tag);
    n.className = cls;
    n.textContent = text;
    return n;
  }
  function button(text: string, fn: () => void, cls = "cw-btn") {
    const b = el("button", cls, text);
    b.type = "button";
    b.onclick = fn;
    return b;
  }
  function toast(text: string) {
    shadow.querySelector(".cw-toast")?.remove();
    const t = el("div", "cw-toast", text);
    t.setAttribute("role", "status");
    shadow.append(t);
    setTimeout(() => t.remove(), 6500);
  }
  async function rpc(data: Record<string, unknown>) {
    if (!identity)
      throw Error(
        "Google account not detected yet. Reload Chat after signing in.",
      );
    const requestedAccount = identity;
    const result = await chrome.runtime.sendMessage({
      ...data,
      account: identity,
    });
    if (requestedAccount !== identity) return state;
    if (result.error) throw Error(result.error);
    state = result.state;
    render();
    return state;
  }
  function act(fn: () => Promise<unknown>) {
    void fn().catch((e) =>
      toast(e.message ?? "Action failed. Reload Chat and try again."),
    );
  }
  function show(v = "later") {
    returnFocus = document.activeElement as HTMLElement;
    open = true;
    view = v;
    selected = null;
    render();
    shadow.querySelector<HTMLElement>(".cw-panel button")?.focus();
  }
  function close() {
    open = false;
    selected = null;
    render();
    returnFocus?.focus();
  }
  async function save(item: Item, due?: number) {
    await rpc({ type: "save", item: { ...item, due } });
    toast(
      due
        ? "Reminder scheduled. It will appear here and in Chrome notifications."
        : "Saved to Later",
    );
  }
  function remind(item: Item) {
    selected = item;
    open = true;
    view = "remind";
    render();
  }
  function jump(item: Item, reply = false) {
    if (!item.url) return;
    close();
    if (reply) sessionStorage.setItem("cw-reply-target", item.id);
    location.assign(item.url);
  }
  function render() {
    ui.replaceChildren();
    const pending = state.items.filter((x) => !x.done);
    const due = pending.filter((x) => x.due && x.due <= Date.now());
    const launcher = button(
      `◷  Later${pending.length ? ` · ${pending.length}` : ""}`,
      () => (open ? close() : show()),
      "cw-launcher",
    );
    launcher.title = "Chat Workbench · Alt+Shift+L";
    launcher.setAttribute("aria-expanded", String(open));
    ui.append(launcher);
    if (due.length) launcher.classList.add("cw-due");
    if (!open) return;
    const panel = el("section", "cw-panel");
    panel.setAttribute("aria-label", "Chat Workbench");
    const head = el("header", "cw-head");
    const titles = el("div");
    titles.append(
      el("div", "cw-eyebrow", "CHAT WORKBENCH"),
      el(
        "h1",
        "",
        view === "remind"
          ? "Remind me"
          : view === "collections"
            ? "Collections"
            : view === "settings"
              ? "Your workspace"
              : "A little less to remember.",
      ),
    );
    head.append(titles, button("×", close, "cw-close"));
    panel.append(head);
    const tabs = el("nav", "cw-tabs");
    for (const [v, label] of [
      ["later", "Later"],
      ["reminders", "Reminders"],
      ["done", "Done"],
      ["collections", "Collections"],
      ["settings", "•••"],
    ]) {
      const b = button(
        label,
        () => {
          view = v;
          selected = null;
          render();
        },
        `cw-tab ${view === v ? "active" : ""}`,
      );
      b.setAttribute("aria-current", String(view === v));
      tabs.append(b);
    }
    panel.append(tabs);
    const body = el("div", "cw-body");
    panel.append(body);
    ui.append(panel);
    if (view === "remind" && selected) {
      body.append(el("p", "cw-muted", selected.text.slice(0, 220)));
      for (const [p, label] of [
        ["20m", "In 20 minutes"],
        ["1h", "In 1 hour"],
        ["tomorrow", "Tomorrow at 9:00"],
      ])
        body.append(
          button(
            label,
            () => {
              const item = selected!;
              act(async () => {
                await save(item, reminderTime(p));
                view = "reminders";
                selected = null;
                render();
              });
            },
            "cw-preset",
          ),
        );
      const label = el("label", "cw-label", "Custom date & time");
      const date = el("input", "cw-input");
      date.type = "datetime-local";
      label.append(date);
      body.append(
        label,
        button(
          "Set reminder",
          () => {
            const time = new Date(date.value).getTime();
            if (!Number.isFinite(time) || time <= Date.now()) {
              toast("Choose a date and time in the future");
              return;
            }
            const item = selected!;
            act(async () => {
              await save(item, time);
              view = "reminders";
              selected = null;
              render();
            });
          },
          "cw-btn primary",
        ),
      );
      return;
    }
    if (view === "collections") {
      renderCollections(body);
      return;
    }
    if (view === "settings") {
      const importer = el("input", "cw-input");
      importer.type = "file";
      importer.accept = ".json";
      importer.setAttribute("aria-label", "Import Workbench backup");
      importer.onchange = () =>
        act(async () => {
          const file = importer.files?.[0];
          if (!file) return;
          if (file.size > 5000000)
            throw Error("Backup is too large (maximum 5 MB)");
          await rpc({ type: "import", backup: JSON.parse(await file.text()) });
          toast("Backup merged into this account");
        });
      body.append(
        el("h2", "", "Local by design"),
        el("p", "cw-muted", `Signed in as ${identity ?? "detecting account…"}`),
        el(
          "p",
          "",
          "Saved messages and reminders stay in this Chrome profile. No analytics, external servers or Google API tokens.",
        ),
        el(
          "p",
          "cw-muted",
          "Reminders arrive while Chrome is running. Missed reminders appear after Chrome or your computer resumes.",
        ),
        el("h2", "", "Sidebar sections"),
        el(
          "p",
          "",
          "Google Chat already supports custom sections and drag-and-drop. Use a section’s menu to create or rename one. Collections here are additional local shortcuts.",
        ),
        el("h2", "", "Thread broadcasts"),
        el(
          "p",
          "",
          "Open a Space thread and check “Also post to Space” before sending a plain-text reply. Linked posts are separate messages. Attachments, rich formatting and mention chips require manual sharing.",
        ),
        importer,
        button("Export this account’s backup", () => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(state, null, 2)], {
              type: "application/json",
            }),
          );
          const a = el("a");
          a.href = url;
          a.download = "chat-workbench-backup.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }),
      );
      return;
    }
    const search = el("input", "cw-input");
    search.placeholder = "Find a saved message…";
    search.setAttribute("aria-label", "Search saved items");
    search.value = query;
    search.oninput = () => {
      query = search.value;
      renderList(list);
    };
    body.append(search);
    const list = el("div", "cw-list");
    body.append(list);
    renderList(list);
  }
  function renderList(list: HTMLElement) {
    list.replaceChildren();
    const matches = state.items
      .filter(
        (i) =>
          (view === "done" ? i.done : !i.done) &&
          (view !== "reminders" || i.due) &&
          `${i.text} ${i.sender} ${i.space}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        view === "reminders"
          ? (a.due ?? 0) - (b.due ?? 0)
          : b.savedAt - a.savedAt,
      );
    if (!matches.length) {
      list.append(
        el("div", "cw-empty-icon", "✓"),
        el(
          "h2",
          "cw-center",
          view === "done" ? "Room for progress." : "You’re all caught up.",
        ),
        el(
          "p",
          "cw-muted cw-center",
          "Hover over a message and choose Save or Remind. Your next steps will be waiting here.",
        ),
      );
      return;
    }
    for (const item of matches) {
      const card = el("article", "cw-card");
      const meta = el("div", "cw-meta");
      meta.append(
        el("span", "", item.space || "Google Chat"),
        el(
          "span",
          "",
          new Date(item.savedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
        ),
      );
      card.append(
        meta,
        el("strong", "cw-sender", item.sender || "Message"),
        el("p", "cw-message", item.text),
      );
      if (item.due)
        card.append(
          el(
            "div",
            `cw-time ${item.due <= Date.now() && !item.done ? "overdue" : ""}`,
            `${item.due <= Date.now() ? "Due" : "Reminder"} · ${new Date(item.due).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          ),
        );
      const actions = el("div", "cw-actions");
      actions.append(
        button(item.done ? "Undo" : "✓ Done", () =>
          act(() => rpc({ type: "update", id: item.id, done: !item.done })),
        ),
        button("↗ Context", () => jump(item)),
        button("Reply", () => jump(item, true)),
        button("◷", () => remind(item)),
      );
      if (item.due)
        actions.append(
          button("Cancel reminder", () =>
            act(() => rpc({ type: "update", id: item.id, due: null })),
          ),
        );
      card.append(actions);
      list.append(card);
    }
  }
  function renderCollections(body: HTMLElement) {
    body.append(
      el(
        "p",
        "cw-muted",
        "Local shortcuts alongside your native Chat sections. Drag shortcuts between collections, or use Move.",
      ),
    );
    const name = el("input", "cw-input");
    name.placeholder = "New collection name";
    name.maxLength = 80;
    body.append(
      name,
      button("+ Create collection", () => {
        if (!name.value.trim()) return;
        state.sections.push({
          id: crypto.randomUUID(),
          name: name.value.trim(),
          collapsed: false,
          links: [],
        });
        act(() => rpc({ type: "sections", sections: state.sections }));
      }),
    );
    for (const s of state.sections) {
      const card = el("section", "cw-card");
      const h = el("div", "cw-actions");
      h.append(
        button(
          `${s.collapsed ? "▸" : "▾"} ${s.name} · ${s.links.length}`,
          () => {
            s.collapsed = !s.collapsed;
            act(() => rpc({ type: "sections", sections: state.sections }));
          },
        ),
        button("↑", () => {
          const n = state.sections.indexOf(s);
          if (n > 0) {
            [state.sections[n - 1], state.sections[n]] = [
              s,
              state.sections[n - 1],
            ];
            act(() => rpc({ type: "sections", sections: state.sections }));
          }
        }),
      );
      card.append(h);
      card.ondragover = (e) => e.preventDefault();
      card.ondrop = (e) => {
        e.preventDefault();
        const raw = e.dataTransfer?.getData("application/x-cw-link");
        if (!raw) return;
        try {
          const { from, url } = JSON.parse(raw);
          const source = state.sections.find((x) => x.id === from);
          const link = source?.links.find((x) => x.url === url);
          if (link && source) {
            source.links = source.links.filter((x) => x.url !== url);
            if (!s.links.some((x) => x.url === url)) s.links.push(link);
            act(() => rpc({ type: "sections", sections: state.sections }));
          }
        } catch {}
      };
      if (!s.collapsed) {
        for (const link of s.links) {
          const row = el("div", "cw-collection-row");
          row.draggable = true;
          row.ondragstart = (e) =>
            e.dataTransfer?.setData(
              "application/x-cw-link",
              JSON.stringify({ from: s.id, url: link.url }),
            );
          const a = el("a", "cw-shortcut", link.name);
          a.href = link.url;
          const move = el("select", "cw-select");
          move.setAttribute("aria-label", `Move ${link.name}`);
          const placeholder = el("option", "", "Move…");
          placeholder.value = "";
          move.append(placeholder);
          for (const target of state.sections.filter((x) => x.id !== s.id)) {
            const o = el("option", "", target.name);
            o.value = target.id;
            move.append(o);
          }
          move.onchange = () => {
            const target = state.sections.find((x) => x.id === move.value);
            if (!target) return;
            s.links = s.links.filter((x) => x !== link);
            if (!target.links.some((x) => x.url === link.url))
              target.links.push(link);
            act(() => rpc({ type: "sections", sections: state.sections }));
          };
          row.append(
            a,
            move,
            button("×", () => {
              s.links = s.links.filter((x) => x !== link);
              act(() => rpc({ type: "sections", sections: state.sections }));
            }),
          );
          card.append(row);
        }
        card.append(
          button("+ Add current conversation", () => {
            const c = [
              ...document.querySelectorAll<HTMLElement>("c-wiz[data-group-id]"),
            ].find((x) => x.dataset.groupId);
            const group = c?.dataset.groupId;
            if (!group) {
              toast("Open a conversation first");
              return;
            }
            const [kind, id] = group.split("/");
            const url = `https://chat.google.com/${kind === "space" ? "room" : "dm"}/${id}?authuser=${encodeURIComponent(identity ?? "")}`;
            if (!s.links.some((x) => x.url === url))
              s.links.push({
                name: document.title.replace(/ - Chat$/, ""),
                url,
              });
            act(() => rpc({ type: "sections", sections: state.sections }));
          }),
        );
      }
      body.append(card);
    }
  }
  function enhanceMessages() {
    for (const row of document.querySelectorAll<HTMLElement>(rows)) {
      if (row.querySelector(":scope > .cw-message-tools")) continue;
      const item = message(row);
      if (!item) continue;
      const tools = el("div", "cw-message-tools");
      tools.append(
        button("♡ Save", () => act(() => save(message(row)!))),
        button("◷ Remind", () => remind(message(row)!)),
      );
      row.append(tools);
      row.classList.add("cw-message-row");
      if (item.text.startsWith("↪ Replied to thread: ")) {
        const badge = el("div", "cw-thread-badge", "↪ Replied to thread");
        row.prepend(badge);
      }
    }
  }
  function enhanceComposers() {
    for (const editor of document.querySelectorAll<HTMLElement>(
      editorSelector,
    )) {
      const c = composer(editor);
      if (
        !c ||
        c.dataset.isDetailedThreadView !== "true" ||
        !c.dataset.groupId?.startsWith("space/") ||
        c.querySelector(".cw-broadcast")
      )
        continue;
      const label = el("label", "cw-broadcast");
      const check = el("input");
      check.type = "checkbox";
      label.append(check, document.createTextNode(" Also post to Space"));
      label.title =
        "Send a linked plain-text copy to the Space after your reply is confirmed";
      c.append(label);
      const intercept = (event: Event) => {
        if (!check.checked || busy) return;
        if (
          event instanceof KeyboardEvent &&
          (event.key !== "Enter" || event.shiftKey || event.isComposing)
        )
          return;
        if (
          event instanceof MouseEvent &&
          !sendButton(editor)?.contains(event.target as Node)
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        act(() => broadcast(editor, check));
      };
      editor.addEventListener("keydown", intercept, true);
      c.addEventListener("click", intercept, true);
    }
  }
  async function broadcast(editor: HTMLElement, check: HTMLInputElement) {
    const c = composer(editor)!;
    const group = c.dataset.groupId!;
    const tid = c.dataset.topicId;
    const text = textOf(editor);
    const root = rootEditor(group);
    if (!text || !tid || !root)
      throw Error("Open the Space and its thread before broadcasting.");
    if (textOf(root))
      throw Error(
        "Your Space composer already has a draft. Finish or clear it first.",
      );
    if (
      editor.querySelector(
        "img,[data-user-id],[data-mention-id],b,strong,i,em,pre,ul,ol,[style]",
      ) ||
      c.querySelector("[data-attachment-id]")
    )
      throw Error(
        "Broadcast supports plain text. Share attachments, mentions and rich formatting manually.",
      );
    const parent = [
      ...document.querySelectorAll<HTMLElement>("[data-local-topic-id]"),
    ]
      .find((x) => x.dataset.localTopicId === tid)
      ?.querySelector<HTMLElement>('[jsname="bgckF"]');
    const link = `https://chat.google.com/room/${group.split("/")[1]}/${tid}/${tid}?authuser=${encodeURIComponent(identity!)}`;
    const before = new Set(
      [...document.querySelectorAll<HTMLElement>(rows)].map(
        (x) => x.dataset.id,
      ),
    );
    const url = location.href;
    const a = identity;
    busy = true;
    check.checked = false;
    try {
      await Promise.resolve();
      sendButton(editor)?.click();
      toast("Sending reply…");
      await waitFor(() => {
        if (location.href !== url || identity !== a) return null;
        return [...document.querySelectorAll<HTMLElement>(rows)].find(
          (r) =>
            !before.has(r.dataset.id) &&
            r.closest<HTMLElement>("[data-local-topic-id]")?.dataset
              .localTopicId === tid &&
            r.closest<HTMLElement>("[data-local-topic-id]")?.dataset
              .isLocalOnly === "false" &&
            r.dataset.id &&
            !r.dataset.id.startsWith("local") &&
            textOf(r.querySelector<HTMLElement>('[jsname="bgckF"]') ?? r) ===
              text,
        );
      });
      if (
        !canBroadcast({
          sameContext:
            location.href === url && identity === a && root.isConnected,
          rootEmpty: !textOf(root),
          replyConfirmed: true,
          richContent: false,
        })
      )
        throw Error(
          "Reply sent. Broadcast stopped because your context or Space draft changed.",
        );
      const copy = broadcastText(
        text,
        parent ? textOf(parent) : "Thread",
        link,
      );
      putDraft(root, copy);
      const send = await waitFor(() => {
        const b = sendButton(root);
        return b &&
          !b.hasAttribute("disabled") &&
          b.getAttribute("aria-disabled") !== "true"
          ? b
          : null;
      }, 3000);
      if (location.href !== url || identity !== a || textOf(root) !== copy)
        throw Error("Reply sent. Review the broadcast draft before sending.");
      const rootsBefore = new Set(
        [...document.querySelectorAll<HTMLElement>(rows)].map(
          (x) => x.dataset.id,
        ),
      );
      send.click();
      await waitFor(() =>
        [...document.querySelectorAll<HTMLElement>(rows)].find(
          (r) =>
            !rootsBefore.has(r.dataset.id) &&
            r.closest<HTMLElement>("[data-local-topic-id]")?.dataset
              .isLocalOnly === "false" &&
            textOf(r.querySelector<HTMLElement>('[jsname="bgckF"]') ?? r) ===
              copy,
        ),
      );
      toast("Reply and Space broadcast sent");
      editor.focus();
    } catch (e) {
      throw Error(
        `${e instanceof Error ? e.message : "Broadcast interrupted"} No automatic retry was made.`,
      );
    } finally {
      busy = false;
    }
  }
  let scheduled = false;
  function scan() {
    scheduled = false;
    const next = account();
    if (next !== identity) {
      identity = next;
      selected = null;
      state = emptyState();
      if (next) act(() => rpc({ type: "read" }));
      else render();
    }
    enhanceMessages();
    enhanceComposers();
    const shortcut = document.querySelector<HTMLElement>(
      '[aria-label="Starred shortcut"]',
    );
    if (shortcut?.parentElement && !document.getElementById("cw-nav")) {
      const nav = button("◷  Later", () => show(), "cw-nav");
      nav.id = "cw-nav";
      shortcut.parentElement.append(nav);
    }
    if (sessionStorage.getItem("cw-reply-target")) {
      const target = sessionStorage.getItem("cw-reply-target")!.split("/");
      const editor = [
        ...document.querySelectorAll<HTMLElement>(editorSelector),
      ].find((e) => composer(e)?.dataset.topicId === target[1]);
      if (!editor) {
        const row = [...document.querySelectorAll<HTMLElement>(rows)].find(
          (r) => r.dataset.id === target[2],
        );
        if (row) {
          row.focus();
          const topic = row.closest<HTMLElement>("[data-local-topic-id]");
          const reply = [
            ...(topic?.querySelectorAll<HTMLElement>("button") ?? []),
          ].find((b) =>
            /repl(y|ies).*thread|^\d+ replies|^Reply in thread/i.test(
              b.getAttribute("aria-label") ?? "",
            ),
          );
          if (reply) reply.click();
          else {
            sessionStorage.removeItem("cw-reply-target");
            toast(
              "Message opened. Use Chat’s Reply in thread action to reply.",
            );
          }
        }
      }
      if (editor) {
        editor.focus();
        sessionStorage.removeItem("cw-reply-target");
      }
    }
  }
  new MutationObserver((m) => {
    if (
      m.every((x) =>
        (x.target as Element).closest?.(
          "#cw-host,.cw-message-tools,.cw-broadcast",
        ),
      )
    )
      return;
    if (!scheduled) {
      scheduled = true;
      setTimeout(scan, 250);
    }
  }).observe(document.body, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && identity && changes[`account:${identity}`]) {
      state =
        (changes[`account:${identity}`].newValue as State | undefined) ??
        emptyState();
      render();
    }
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && e.shiftKey && e.code === "KeyL") {
        e.preventDefault();
        open ? close() : show();
      }
      if (e.key === "Escape" && open) {
        close();
        e.stopPropagation();
      }
    },
    true,
  );
  shadow.addEventListener("keydown", (event) => {
    const e = event as KeyboardEvent;
    if (e.key === "Tab" && open) {
      const nodes = [
        ...shadow.querySelectorAll<HTMLElement>(
          ".cw-panel button,.cw-panel input,.cw-panel a,.cw-panel select",
        ),
      ].filter((x) => !x.hasAttribute("disabled"));
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && shadow.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && shadow.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  render();
  scan();
  if (location.hash === "#workbench") show();
  setInterval(() => {
    if (open && view === "reminders") render();
  }, 60000);
}
