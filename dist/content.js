"use strict";
(() => {
  // src/core.ts
  var emptyState = () => ({
    version: 1,
    items: [],
    sections: []
  });
  function reminderTime(preset, now = Date.now()) {
    if (preset === "tomorrow") {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    }
    return now + (preset === "20m" ? 20 : 60) * 6e4;
  }
  function broadcastText(text, parent, url) {
    return `\u21AA Replied to thread: ${parent.replace(/\s+/g, " ").slice(0, 180)}

${text}

View thread: ${url}`;
  }
  function canBroadcast(s) {
    return s.sameContext && s.rootEmpty && s.replyConfirmed && !s.richContent;
  }
  function sameText(a, b) {
    return a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
  }

  // src/adapter.ts
  var rows = "[data-message-multiplat-item-id][data-id]";
  var editorSelector = '[contenteditable="true"][role="textbox"]';
  function account(doc = document) {
    for (const e of doc.querySelectorAll(
      '[aria-label*="Google Account"],[aria-label*="Cuenta de Google"],[aria-label*="Compte Google"]'
    )) {
      const match = e.getAttribute("aria-label")?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (match) return match[0].toLowerCase();
    }
    return null;
  }
  function message(row, doc = document) {
    const topic = row.closest("[data-local-topic-id]");
    const group = topic?.getAttribute("data-p")?.match(/"(space|dm)\/([^"\s]+)"/);
    const id = row.dataset.id;
    const tid = topic?.dataset.localTopicId;
    if (!group || !id || !tid) return null;
    const body = row.querySelector('[jsname="bgckF"]');
    const text = body ? textOf(body) : "";
    const sender = row.querySelector('h3,[role="heading"][aria-level="3"]')?.textContent ?? row.querySelector("[data-name]")?.getAttribute("data-name") ?? "Message";
    const a = account(doc);
    return {
      id: `${group[2]}/${tid}/${id}`,
      text: text.trim() || "[Attachment or media]",
      sender,
      space: doc.title.replace(/ - Chat$/, ""),
      url: `https://chat.google.com/${group[1] === "space" ? "room" : "dm"}/${group[2]}/${tid}/${id}${a ? `?authuser=${encodeURIComponent(a)}` : ""}`,
      savedAt: Date.now()
    };
  }
  function composer(editor) {
    return editor.closest("c-wiz[data-group-id]");
  }
  function rootEditor(group) {
    return [...document.querySelectorAll(editorSelector)].find((e) => {
      const c = composer(e);
      return c?.dataset.groupId === group && c.dataset.isDetailedThreadView === "false" && c.dataset.isRoomComposePostbar === "true";
    }) ?? null;
  }
  function sendButton(editor) {
    return composer(editor)?.querySelector(
      'button[aria-label="Send message"],button[jsname="GBTyxb"]'
    ) ?? null;
  }
  function textOf(e) {
    const read = (node) => {
      if (node.nodeType === 3) return node.textContent ?? "";
      if (node.nodeType !== 1) return "";
      const element = node;
      if (element.tagName === "IMG") return element.getAttribute("alt") ?? "";
      if (element.tagName === "BR") return "\n";
      const text = [...element.childNodes].map(read).join("");
      return /^(DIV|P|LI|BLOCKQUOTE|PRE)$/.test(element.tagName) ? "\n" + text + "\n" : text;
    };
    return read(e).replace(/\n{2,}/g, "\n").trim();
  }
  function putDraft(editor, text) {
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (!document.execCommand("insertText", false, text))
      throw Error(
        "Chat did not accept the draft. Your message has not been sent."
      );
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
  }
  function waitFor(read, timeout = 12e3) {
    return new Promise((resolve, reject) => {
      const until = Date.now() + timeout;
      const tick = () => {
        const value = read();
        if (value) {
          resolve(value);
          return;
        }
        if (Date.now() > until) {
          reject(
            Error(
              "Delivery could not be confirmed. Check Chat before trying again."
            )
          );
          return;
        }
        setTimeout(tick, 180);
      };
      tick();
    });
  }
  function confirmed(row) {
    const stamp = Number(
      row.querySelector("[data-absolute-timestamp]")?.getAttribute("data-absolute-timestamp")
    );
    return stamp > 0 && !/Sending|Retry|Failed to send/i.test(
      row.querySelector('[jsname="E53oB"]')?.textContent ?? ""
    );
  }

  // src/style.css
  var style_default = ':host {\n  font-family:\n    Google Sans,\n    Inter,\n    -apple-system,\n    BlinkMacSystemFont,\n    "Segoe UI",\n    sans-serif;\n  color: #20352e;\n  font-size: 14px;\n  line-height: 1.5;\n  color-scheme: light dark;\n}\n* {\n  box-sizing: border-box;\n}\nbutton,\ninput,\nselect {\n  font: inherit;\n}\nbutton,\na,\ninput,\nselect {\n  -webkit-tap-highlight-color: transparent;\n}\nbutton {\n  cursor: pointer;\n}\nbutton:focus-visible,\na:focus-visible,\ninput:focus-visible,\nselect:focus-visible {\n  outline: 3px solid #75b6a0;\n  outline-offset: 3px;\n}\nbutton {\n  transition:\n    background 0.15s,\n    transform 0.15s;\n}\nbutton:hover {\n  filter: brightness(0.96);\n}\n.cw-launcher {\n  position: fixed;\n  bottom: 24px;\n  left: 24px;\n  z-index: 2147483000;\n  border: 1px solid #d8e4dd;\n  border-radius: 30px;\n  background: #183f33;\n  color: #fff;\n  padding: 12px 20px;\n  box-shadow: 0 4px 18px #122d2925;\n  font-weight: 600;\n}\n.cw-launcher.cw-due {\n  background: #8b4e16;\n}\n.cw-panel {\n  position: fixed;\n  top: 20px;\n  right: 22px;\n  bottom: 20px;\n  width: 440px;\n  max-width: calc(100vw - 28px);\n  z-index: 2147483001;\n  background: #f7faf7;\n  border: 1px solid #dbe5dd;\n  border-radius: 24px;\n  box-shadow: 0 16px 65px #0c241f35;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  animation: cw-in 0.18s ease-out;\n}\n.cw-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  padding: 28px 26px 20px;\n  background: linear-gradient(120deg, #e7f2eb, #f7faf7);\n}\n.cw-eyebrow {\n  font-size: 10px;\n  letter-spacing: 2px;\n  font-weight: 750;\n  color: #577365;\n  margin-bottom: 8px;\n}\nh1 {\n  font-size: 24px;\n  font-weight: 550;\n  letter-spacing: -0.7px;\n  margin: 0;\n  line-height: 1.2;\n}\nh2 {\n  font-size: 18px;\n  font-weight: 550;\n  letter-spacing: -0.3px;\n  margin: 22px 0 8px;\n}\np {\n  margin: 10px 0;\n  line-height: 1.6;\n}\n.cw-close {\n  border: 0;\n  background: transparent;\n  color: inherit;\n  font-size: 27px;\n  line-height: 24px;\n  padding: 4px 8px;\n  border-radius: 8px;\n}\n.cw-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 0 20px 15px;\n  border-bottom: 1px solid #e1e8e2;\n}\n.cw-tab {\n  border: 0;\n  padding: 8px 11px;\n  background: transparent;\n  color: #66756c;\n  border-radius: 10px;\n  font-size: 12px;\n  font-weight: 600;\n}\n.cw-tab.active {\n  background: #dfebe3;\n  color: #244c3b;\n}\n.cw-body {\n  padding: 20px 24px;\n  overflow: auto;\n  flex: 1;\n  overscroll-behavior: contain;\n}\n.cw-input {\n  width: 100%;\n  border: 1px solid #d9e2db;\n  border-radius: 12px;\n  background: #fff;\n  color: inherit;\n  padding: 12px 14px;\n  margin-bottom: 12px;\n  font-size: 13px;\n}\n.cw-card {\n  border: 1px solid #e0e7e1;\n  background: #fff;\n  padding: 18px;\n  border-radius: 16px;\n  margin: 12px 0;\n  box-shadow: 0 2px 3px #183f3303;\n}\n.cw-meta {\n  display: flex;\n  justify-content: space-between;\n  gap: 12px;\n  font-size: 10px;\n  text-transform: uppercase;\n  letter-spacing: 0.7px;\n  color: #738278;\n  margin-bottom: 10px;\n}\n.cw-meta span:first-child {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.cw-sender {\n  font-size: 13px;\n  font-weight: 650;\n}\n.cw-message {\n  font-size: 13px;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  max-height: 220px;\n  overflow: auto;\n  color: #44564b;\n}\n.cw-actions {\n  display: flex;\n  gap: 6px;\n  flex-wrap: wrap;\n  margin-top: 14px;\n}\n.cw-btn {\n  border: 1px solid #e0e7e1;\n  background: #f7faf7;\n  color: #375847;\n  border-radius: 8px;\n  padding: 7px 10px;\n  font-size: 11px;\n  font-weight: 600;\n}\n.cw-btn.primary {\n  background: #245b43;\n  color: #fff;\n  padding: 11px 15px;\n  border-color: #245b43;\n}\n.cw-time {\n  font-size: 11px;\n  color: #627c6b;\n  background: #eef4ef;\n  border-radius: 6px;\n  padding: 5px 8px;\n  display: inline-block;\n}\n.cw-time.overdue {\n  background: #fff0d9;\n  color: #8a5915;\n}\n.cw-muted {\n  color: #7b887f;\n  font-size: 12px;\n}\n.cw-center {\n  text-align: center;\n}\n.cw-empty-icon {\n  width: 58px;\n  height: 58px;\n  display: grid;\n  place-items: center;\n  border-radius: 50%;\n  background: #e7f0e9;\n  color: #668675;\n  font-size: 24px;\n  margin: 54px auto 18px;\n}\n.cw-toast {\n  position: fixed;\n  z-index: 2147483646;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  max-width: 560px;\n  padding: 14px 20px;\n  border-radius: 12px;\n  background: #203f32;\n  color: white;\n  box-shadow: 0 8px 30px #0003;\n  font-size: 13px;\n  animation: cw-in 0.18s ease-out;\n}\n.cw-preset {\n  display: block;\n  width: 100%;\n  text-align: left;\n  padding: 14px;\n  border: 1px solid #d9e2db;\n  border-radius: 12px;\n  background: #fff;\n  color: inherit;\n  margin: 10px 0;\n}\n.cw-label {\n  display: block;\n  margin-top: 20px;\n  font-size: 12px;\n  color: #748377;\n}\n.cw-label input {\n  margin-top: 8px;\n}\n.cw-collection-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 10px 0;\n  border-bottom: 1px solid #edf1ed;\n}\n.cw-shortcut {\n  color: #2d654b;\n  flex: 1;\n  text-decoration: none;\n  font-size: 13px;\n}\n.cw-select {\n  max-width: 90px;\n  border: 1px solid #dce4dd;\n  border-radius: 6px;\n  padding: 4px;\n  color: inherit;\n  background: transparent;\n  font-size: 11px;\n}\n@keyframes cw-in {\n  from {\n    opacity: 0;\n    translate: 0 5px;\n  }\n  to {\n    opacity: 1;\n    translate: 0 0;\n  }\n}\n@media (prefers-color-scheme: dark) {\n  :host {\n    color: #dce8df;\n  }\n  .cw-panel {\n    background: #1b2420;\n    border-color: #3c4c41;\n  }\n  .cw-head {\n    background: linear-gradient(120deg, #273a2e, #1b2420);\n  }\n  .cw-eyebrow,\n  .cw-muted {\n    color: #9ab3a2;\n  }\n  .cw-tabs {\n    border-color: #35453a;\n  }\n  .cw-tab {\n    color: #a1b7a8;\n  }\n  .cw-tab.active {\n    background: #344d3d;\n    color: #d9ecdf;\n  }\n  .cw-card,\n  .cw-input,\n  .cw-preset {\n    background: #242f28;\n    border-color: #3c4c41;\n  }\n  .cw-btn {\n    background: #2d3c32;\n    color: #d0e5d7;\n    border-color: #455b4b;\n  }\n  .cw-message {\n    color: #c0d0c4;\n  }\n  .cw-close {\n    color: inherit;\n  }\n  .cw-meta {\n    color: #9bb4a4;\n  }\n  .cw-time {\n    background: #324938;\n    color: #b7d3bf;\n  }\n  .cw-time.overdue {\n    background: #4f3e25;\n    color: #e5c08b;\n  }\n  .cw-empty-icon {\n    background: #304735;\n    color: #a8c6b0;\n  }\n  .cw-shortcut {\n    color: #b0d5bd;\n  }\n  .cw-collection-row {\n    border-color: #3a4c3e;\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  * {\n    animation: none !important;\n    transition: none !important;\n  }\n}\n';

  // src/content.ts
  if (window.top === window && location.pathname !== "/drivesharing/driveshare")
    start();
  function start() {
    let state = emptyState(), identity = null, open = false, view = "later", query = "", busy = false;
    let selected = null;
    let returnFocus = null;
    const host = document.createElement("div");
    host.id = "cw-host";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = style_default;
    shadow.append(style);
    document.body.append(host);
    const ui = document.createElement("div");
    shadow.append(ui);
    function el(tag, cls = "", text = "") {
      const n = document.createElement(tag);
      n.className = cls;
      n.textContent = text;
      return n;
    }
    function button(text, fn, cls = "cw-btn") {
      const b = el("button", cls, text);
      b.type = "button";
      b.onclick = fn;
      return b;
    }
    function toast(text) {
      shadow.querySelector(".cw-toast")?.remove();
      const t = el("div", "cw-toast", text);
      t.setAttribute("role", "status");
      shadow.append(t);
      setTimeout(() => t.remove(), 6500);
    }
    async function rpc(data) {
      if (!identity)
        throw Error(
          "Google account not detected yet. Reload Chat after signing in."
        );
      const requestedAccount = identity;
      const result = await chrome.runtime.sendMessage({
        ...data,
        account: identity
      });
      if (requestedAccount !== identity) return state;
      if (result.error) throw Error(result.error);
      state = result.state;
      render();
      return state;
    }
    function act(fn) {
      void fn().catch(
        (e) => toast(e.message ?? "Action failed. Reload Chat and try again.")
      );
    }
    function show(v = "later") {
      returnFocus = document.activeElement;
      open = true;
      view = v;
      selected = null;
      render();
      shadow.querySelector(".cw-panel button")?.focus();
    }
    function close() {
      open = false;
      selected = null;
      render();
      returnFocus?.focus();
    }
    async function save(item, due) {
      await rpc({ type: "save", item: { ...item, due } });
      toast(
        due ? "Reminder scheduled. It will appear here and in Chrome notifications." : "Saved to Later"
      );
    }
    function remind(item) {
      selected = item;
      open = true;
      view = "remind";
      render();
    }
    function jump(item, reply = false) {
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
        `\u25F7  Later${pending.length ? ` \xB7 ${pending.length}` : ""}`,
        () => open ? close() : show(),
        "cw-launcher"
      );
      launcher.title = "Chat Workbench \xB7 Alt+Shift+L";
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
          view === "remind" ? "Remind me" : view === "collections" ? "Collections" : view === "settings" ? "Your workspace" : "A little less to remember."
        )
      );
      head.append(titles, button("\xD7", close, "cw-close"));
      panel.append(head);
      const tabs = el("nav", "cw-tabs");
      for (const [v, label] of [
        ["later", "Later"],
        ["reminders", "Reminders"],
        ["done", "Done"],
        ["collections", "Collections"],
        ["settings", "\u2022\u2022\u2022"]
      ]) {
        const b = button(
          label,
          () => {
            view = v;
            selected = null;
            render();
          },
          `cw-tab ${view === v ? "active" : ""}`
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
        for (const [p, label2] of [
          ["20m", "In 20 minutes"],
          ["1h", "In 1 hour"],
          ["tomorrow", "Tomorrow at 9:00"]
        ])
          body.append(
            button(
              label2,
              () => {
                const item = selected;
                act(async () => {
                  await save(item, reminderTime(p));
                  view = "reminders";
                  selected = null;
                  render();
                });
              },
              "cw-preset"
            )
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
              const item = selected;
              act(async () => {
                await save(item, time);
                view = "reminders";
                selected = null;
                render();
              });
            },
            "cw-btn primary"
          )
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
        importer.onchange = () => act(async () => {
          const file = importer.files?.[0];
          if (!file) return;
          if (file.size > 5e6)
            throw Error("Backup is too large (maximum 5 MB)");
          await rpc({ type: "import", backup: JSON.parse(await file.text()) });
          toast("Backup merged into this account");
        });
        body.append(
          el("h2", "", "Local by design"),
          el("p", "cw-muted", `Signed in as ${identity ?? "detecting account\u2026"}`),
          el(
            "p",
            "",
            "Saved messages and reminders stay in this Chrome profile. No analytics, external servers or Google API tokens."
          ),
          el(
            "p",
            "cw-muted",
            "Reminders arrive while Chrome is running. Missed reminders appear after Chrome or your computer resumes."
          ),
          el("h2", "", "Sidebar sections"),
          el(
            "p",
            "",
            "Google Chat already supports custom sections and drag-and-drop. Use a section\u2019s menu to create or rename one. Collections here are additional local shortcuts."
          ),
          el("h2", "", "Thread broadcasts"),
          el(
            "p",
            "",
            "Open a Space thread and check \u201CAlso post to Space\u201D before sending a plain-text reply. Linked posts are separate messages. Attachments, rich formatting and mention chips require manual sharing."
          ),
          importer,
          button("Export this account\u2019s backup", () => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(state, null, 2)], {
                type: "application/json"
              })
            );
            const a = el("a");
            a.href = url;
            a.download = "chat-workbench-backup.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5e3);
          })
        );
        return;
      }
      const search = el("input", "cw-input");
      search.placeholder = "Find a saved message\u2026";
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
    function renderList(list) {
      list.replaceChildren();
      const matches = state.items.filter(
        (i) => (view === "done" ? i.done : !i.done) && (view !== "reminders" || i.due) && `${i.text} ${i.sender} ${i.space}`.toLowerCase().includes(query.toLowerCase())
      ).sort(
        (a, b) => view === "reminders" ? (a.due ?? 0) - (b.due ?? 0) : b.savedAt - a.savedAt
      );
      if (!matches.length) {
        list.append(
          el("div", "cw-empty-icon", "\u2713"),
          el(
            "h2",
            "cw-center",
            view === "done" ? "Room for progress." : "You\u2019re all caught up."
          ),
          el(
            "p",
            "cw-muted cw-center",
            "Hover over a message and choose Save or Remind. Your next steps will be waiting here."
          )
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
            new Date(item.savedAt).toLocaleDateString(void 0, {
              month: "short",
              day: "numeric"
            })
          )
        );
        card.append(
          meta,
          el("strong", "cw-sender", item.sender || "Message"),
          el("p", "cw-message", item.text)
        );
        if (item.due)
          card.append(
            el(
              "div",
              `cw-time ${item.due <= Date.now() && !item.done ? "overdue" : ""}`,
              `${item.due <= Date.now() ? "Due" : "Reminder"} \xB7 ${new Date(item.due).toLocaleString(void 0, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
            )
          );
        const actions = el("div", "cw-actions");
        actions.append(
          button(
            item.done ? "Undo" : "\u2713 Done",
            () => act(() => rpc({ type: "update", id: item.id, done: !item.done }))
          ),
          button("\u2197 Context", () => jump(item)),
          button("Reply", () => jump(item, true)),
          button("\u25F7", () => remind(item))
        );
        if (item.due)
          actions.append(
            button(
              "Cancel reminder",
              () => act(() => rpc({ type: "update", id: item.id, due: null }))
            )
          );
        card.append(actions);
        list.append(card);
      }
    }
    function renderCollections(body) {
      body.append(
        el(
          "p",
          "cw-muted",
          "Local shortcuts alongside your native Chat sections. Drag shortcuts between collections, or use Move."
        )
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
            links: []
          });
          act(() => rpc({ type: "sections", sections: state.sections }));
        })
      );
      for (const s of state.sections) {
        const card = el("section", "cw-card");
        const h = el("div", "cw-actions");
        h.append(
          button(
            `${s.collapsed ? "\u25B8" : "\u25BE"} ${s.name} \xB7 ${s.links.length}`,
            () => {
              s.collapsed = !s.collapsed;
              act(() => rpc({ type: "sections", sections: state.sections }));
            }
          ),
          button("\u2191", () => {
            const n = state.sections.indexOf(s);
            if (n > 0) {
              [state.sections[n - 1], state.sections[n]] = [
                s,
                state.sections[n - 1]
              ];
              act(() => rpc({ type: "sections", sections: state.sections }));
            }
          })
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
          } catch {
          }
        };
        if (!s.collapsed) {
          for (const link of s.links) {
            const row = el("div", "cw-collection-row");
            row.draggable = true;
            row.ondragstart = (e) => e.dataTransfer?.setData(
              "application/x-cw-link",
              JSON.stringify({ from: s.id, url: link.url })
            );
            const a = el("a", "cw-shortcut", link.name);
            a.href = link.url;
            const move = el("select", "cw-select");
            move.setAttribute("aria-label", `Move ${link.name}`);
            const placeholder = el("option", "", "Move\u2026");
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
              button("\xD7", () => {
                s.links = s.links.filter((x) => x !== link);
                act(() => rpc({ type: "sections", sections: state.sections }));
              })
            );
            card.append(row);
          }
          card.append(
            button("+ Add current conversation", () => {
              const c = [
                ...document.querySelectorAll("c-wiz[data-group-id]")
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
                  url
                });
              act(() => rpc({ type: "sections", sections: state.sections }));
            })
          );
        }
        body.append(card);
      }
    }
    function enhanceMessages() {
      for (const row of document.querySelectorAll(rows)) {
        if (row.querySelector(":scope > .cw-message-tools")) continue;
        const item = message(row);
        if (!item) continue;
        const tools = el("div", "cw-message-tools");
        tools.append(
          button("\u2661 Save", () => act(() => save(message(row)))),
          button("\u25F7 Remind", () => remind(message(row)))
        );
        row.append(tools);
        row.classList.add("cw-message-row");
        if (item.text.startsWith("\u21AA Replied to thread: ")) {
          const badge = el("div", "cw-thread-badge", "\u21AA Replied to thread");
          row.prepend(badge);
        }
      }
    }
    function enhanceComposers() {
      for (const editor of document.querySelectorAll(
        editorSelector
      )) {
        const c = composer(editor);
        if (!c || c.dataset.isDetailedThreadView !== "true" || !c.dataset.groupId?.startsWith("space/") || c.querySelector(".cw-broadcast"))
          continue;
        const label = el("label", "cw-broadcast");
        const check = el("input");
        check.type = "checkbox";
        label.append(check, document.createTextNode(" Also post to Space"));
        label.title = "Send a linked plain-text copy to the Space after your reply is confirmed";
        c.append(label);
        const intercept = (event) => {
          if (!check.checked || busy) return;
          if (event instanceof KeyboardEvent && (event.key !== "Enter" || event.shiftKey || event.isComposing))
            return;
          if (event instanceof MouseEvent && !sendButton(editor)?.contains(event.target))
            return;
          event.preventDefault();
          event.stopImmediatePropagation();
          act(() => broadcast(editor, check));
        };
        editor.addEventListener("keydown", intercept, true);
        c.addEventListener("click", intercept, true);
      }
    }
    async function broadcast(editor, check) {
      const c = composer(editor);
      const group = c.dataset.groupId;
      const tid = c.dataset.topicId;
      const text = textOf(editor);
      const root = rootEditor(group);
      if (!text || !tid || !root)
        throw Error("Open the Space and its thread before broadcasting.");
      if (textOf(root))
        throw Error(
          "Your Space composer already has a draft. Finish or clear it first."
        );
      if (editor.querySelector(
        "img,[data-user-id],[data-mention-id],b,strong,i,em,pre,ul,ol,[style]"
      ) || c.querySelector("[data-attachment-id]"))
        throw Error(
          "Broadcast supports plain text. Share attachments, mentions and rich formatting manually."
        );
      const parent = [
        ...document.querySelectorAll("[data-local-topic-id]")
      ].find((x) => x.dataset.localTopicId === tid)?.querySelector('[jsname="bgckF"]');
      const link = `https://chat.google.com/room/${group.split("/")[1]}/${tid}/${tid}?authuser=${encodeURIComponent(identity)}`;
      const before = new Set(
        [...document.querySelectorAll(rows)].map(
          (x) => x.dataset.id
        )
      );
      const url = location.href;
      const a = identity;
      busy = true;
      check.checked = false;
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        sendButton(editor)?.click();
        toast("Sending reply\u2026");
        await waitFor(() => {
          if (location.href !== url || identity !== a) return null;
          return [...document.querySelectorAll(rows)].find(
            (r) => !before.has(r.dataset.id) && confirmed(r) && r.closest("[data-local-topic-id]")?.dataset.localTopicId === tid && r.dataset.id && !r.dataset.id.startsWith("local") && textOf(r.querySelector('[jsname="bgckF"]') ?? r) === text
          );
        });
        if (!canBroadcast({
          sameContext: location.href === url && identity === a && root.isConnected,
          rootEmpty: !textOf(root),
          replyConfirmed: true,
          richContent: false
        }))
          throw Error(
            "Reply sent. Broadcast stopped because your context or Space draft changed."
          );
        const copy = broadcastText(
          text,
          parent ? textOf(parent) : "Thread",
          link
        );
        putDraft(root, copy);
        const send = await waitFor(() => {
          const b = sendButton(root);
          return b && !b.hasAttribute("disabled") && b.getAttribute("aria-disabled") !== "true" ? b : null;
        }, 3e3);
        if (location.href !== url || identity !== a || !sameText(textOf(root), copy))
          throw Error("Reply sent. Review the broadcast draft before sending.");
        const rootsBefore = new Set(
          [...document.querySelectorAll(rows)].map(
            (x) => x.dataset.id
          )
        );
        send.click();
        await waitFor(
          () => [...document.querySelectorAll(rows)].find(
            (r) => !rootsBefore.has(r.dataset.id) && confirmed(r) && sameText(
              textOf(r.querySelector('[jsname="bgckF"]') ?? r),
              copy
            )
          )
        );
        toast("Reply and Space broadcast sent");
        editor.focus();
      } catch (e) {
        throw Error(
          `${e instanceof Error ? e.message : "Broadcast interrupted"} No automatic retry was made.`
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
      const shortcut = document.querySelector(
        '[aria-label="Starred shortcut"]'
      );
      if (shortcut?.parentElement && !document.getElementById("cw-nav")) {
        const nav = button("\u25F7  Later", () => show(), "cw-nav");
        nav.id = "cw-nav";
        shortcut.parentElement.append(nav);
      }
      if (sessionStorage.getItem("cw-reply-target")) {
        const target = sessionStorage.getItem("cw-reply-target").split("/");
        const editor = [
          ...document.querySelectorAll(editorSelector)
        ].find((e) => composer(e)?.dataset.topicId === target[1]);
        if (!editor) {
          const row = [...document.querySelectorAll(rows)].find(
            (r) => r.dataset.id === target[2]
          );
          if (row) {
            row.focus();
            const topic = row.closest("[data-local-topic-id]");
            const reply = [
              ...topic?.querySelectorAll("button") ?? []
            ].find(
              (b) => /repl(y|ies).*thread|^\d+ replies|^Reply in thread/i.test(
                b.getAttribute("aria-label") ?? ""
              )
            );
            if (reply) reply.click();
            else {
              sessionStorage.removeItem("cw-reply-target");
              toast(
                "Message opened. Use Chat\u2019s Reply in thread action to reply."
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
      if (m.every(
        (x) => x.target.closest?.(
          "#cw-host,.cw-message-tools,.cw-broadcast"
        )
      ))
        return;
      if (!scheduled) {
        scheduled = true;
        setTimeout(scan, 250);
      }
    }).observe(document.body, { childList: true, subtree: true });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && identity && changes[`account:${identity}`]) {
        state = changes[`account:${identity}`].newValue ?? emptyState();
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
      true
    );
    shadow.addEventListener("keydown", (event) => {
      const e = event;
      if (e.key === "Tab" && open) {
        const nodes = [
          ...shadow.querySelectorAll(
            ".cw-panel button,.cw-panel input,.cw-panel a,.cw-panel select"
          )
        ].filter((x) => !x.hasAttribute("disabled"));
        const first = nodes[0], last = nodes.at(-1);
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
    }, 6e4);
  }
})();
//# sourceMappingURL=content.js.map
