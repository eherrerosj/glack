"use strict";
(() => {
  // src/icons.ts
  var paths = {
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    later: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    media: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1 M3 17l6-6 4 4 3-3 5 5 M16 7h.01",
    theme: "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-10h-4 M7 8h.01 M6 13h.01 M11 6h.01",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"
  };
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[name] ?? paths.grid);
    svg.append(path);
    return svg;
  }

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
  function safeLink(link) {
    try {
      const u = new URL(link);
      return u.protocol === "https:" && u.hostname === "chat.google.com" && !u.username && !u.password;
    } catch {
      return false;
    }
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
  function parseBroadcast(text) {
    const match = text.match(
      /^↪ Replied to thread: ([^\n]+)\n+([\s\S]+?)\n+View thread:\s*(https:\/\/chat\.google\.com\/\S+)\s*$/
    );
    if (!match || !safeLink(match[3])) return null;
    const url = new URL(match[3]);
    if (!/^\/room\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname)) return null;
    return { parent: match[1].trim(), reply: match[2].trim(), url: match[3] };
  }

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
  function keywordMatches(text, keywords) {
    return keywords.filter(
      (k) => text.toLocaleLowerCase().includes(k.toLocaleLowerCase())
    );
  }
  function fuzzyScore(name, query) {
    const n = name.toLowerCase(), q = query.trim().toLowerCase();
    if (!q) return 1;
    if (n === q) return 1e4;
    if (n.includes(q)) return 5e3 - n.indexOf(q) * 10 - n.length;
    let at = -1, score = 1e3;
    for (const c of q) {
      const next = n.indexOf(c, at + 1);
      if (next < 0) return 0;
      score -= next - at;
      at = next;
    }
    return Math.max(1, score - n.length);
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
    const author = row.querySelector(
      '[jsname="oU6v8b"],h3,[role="heading"][aria-level="3"]'
    );
    const sender = author?.textContent?.trim() || author?.getAttribute("data-name") || row.querySelector("[data-name]")?.getAttribute("data-name") || [...row.querySelectorAll('[data-is-message="true"][data-member-id]')].map((e) => e.textContent?.trim()).find(Boolean) || "Message";
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

  // src/experience.css
  var experience_default = ':host {\n  --ink: #1d1c1d;\n  --paper: #fff;\n  --muted: #616061;\n  --border: #ddd;\n  --accent: #611f69;\n  font:\n    15px/1.45 -apple-system,\n    BlinkMacSystemFont,\n    "Segoe UI",\n    sans-serif;\n  color: var(--ink);\n}\n:host([data-theme="dark"]) {\n  --paper: #1a1d21;\n  --ink: #d1d2d3;\n  --muted: #a1a1a4;\n  --border: #414348;\n  --accent: #c69bd2;\n}\n* {\n  box-sizing: border-box;\n}\nbutton,\ninput,\nselect {\n  font: inherit;\n}\nbutton {\n  cursor: pointer;\n  background: var(--paper);\n  color: var(--ink);\n  border: 1px solid var(--border);\n  border-radius: 6px;\n  padding: 8px 12px;\n}\nbutton:hover {\n  background: color-mix(in srgb, var(--accent) 10%, var(--paper));\n}\nbutton:focus-visible,\ninput:focus-visible,\nselect:focus-visible {\n  outline: 3px solid #1264a3;\n  outline-offset: 2px;\n}\n.veil {\n  position: fixed;\n  inset: 0;\n  background: #0007;\n  backdrop-filter: none;\n  z-index: 2147483646;\n  display: flex;\n  justify-content: center;\n  align-items: flex-start;\n  padding: 12vh 24px 24px;\n}\n.dialog {\n  width: 600px;\n  max-height: 80vh;\n  overflow: auto;\n  background: var(--paper);\n  border-radius: 12px;\n  border: 1px solid var(--border);\n  box-shadow: 0 18px 80px #0005;\n  padding: 24px;\n}\n.wide {\n  width: min(1000px, 94vw);\n}\nheader {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 18px;\n}\nheader button {\n  border: 0;\n  font-size: 24px;\n  padding: 0 8px;\n}\nh2 {\n  font-size: 22px;\n  letter-spacing: -0.5px;\n  margin: 0;\n}\nh3 {\n  font-size: 15px;\n  margin: 24px 0 6px;\n}\n.muted,\n.hint {\n  color: var(--muted);\n  font-size: 13px;\n}\n.hint {\n  font-size: 12px;\n}\n.text-input {\n  display: block;\n  width: 100%;\n  padding: 12px;\n  border: 1px solid var(--border);\n  border-radius: 6px;\n  background: var(--paper);\n  color: var(--ink);\n  margin: 8px 0 14px;\n}\n.themes {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 10px;\n  margin: 22px 0;\n}\n.themes button:before {\n  content: "";\n  display: block;\n  height: 35px;\n  border-radius: 4px;\n  margin-bottom: 8px;\n  background: linear-gradient(\n    90deg,\n    #350d36 22%,\n    #4a154b 22%,\n    #4a154b 55%,\n    #fff 55%\n  );\n  border: 1px solid #8885;\n}\n.themes [data-swatch="dark"]:before {\n  background: linear-gradient(\n    90deg,\n    #121016 22%,\n    #19171d 22%,\n    #19171d 55%,\n    #1a1d21 55%\n  );\n}\n.themes [data-swatch="light"]:before {\n  background: linear-gradient(\n    90deg,\n    #3f0e40 22%,\n    #f3eef4 22%,\n    #f3eef4 55%,\n    #fff 55%\n  );\n}\n.themes [data-swatch="ocean"]:before {\n  background: linear-gradient(\n    90deg,\n    #062f40 22%,\n    #114b5f 22%,\n    #114b5f 55%,\n    #fff 55%\n  );\n}\n.themes [data-swatch="native"]:before {\n  background: linear-gradient(90deg, #e8f0fe 55%, #fff 55%);\n}\n.themes [aria-pressed="true"] {\n  outline: 2px solid var(--accent);\n  font-weight: 700;\n}\n.toggle {\n  display: flex;\n  gap: 10px;\n  align-items: center;\n  margin: 14px 0;\n}\n.toggle input {\n  accent-color: var(--accent);\n  width: 17px;\n  height: 17px;\n}\n.results button {\n  display: block;\n  width: 100%;\n  border: 0;\n  text-align: left;\n  padding: 12px;\n}\n.results [aria-selected="true"] {\n  background: #1264a3;\n  color: #fff;\n}\n.code-actions {\n  display: flex;\n  gap: 8px;\n}\n.code-view {\n  overflow: auto;\n  max-height: 55vh;\n  background: #161b22;\n  color: #e6edf3;\n  padding: 16px 0;\n  border-radius: 7px;\n  font:\n    13px/1.65 ui-monospace,\n    SFMono-Regular,\n    Menlo,\n    monospace;\n}\n.code-line {\n  display: flex;\n  min-width: max-content;\n}\n.line-number {\n  color: #7d8590;\n  user-select: none;\n  min-width: 55px;\n  text-align: right;\n  padding-right: 18px;\n  flex-shrink: 0;\n}\n.code-line > span:last-child {\n  padding-right: 16px;\n}\n.wrap .code-line {\n  min-width: 0;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n.keyword {\n  color: #ff7b72;\n}\n.string {\n  color: #a5d6ff;\n}\n.number {\n  color: #79c0ff;\n}\n.comment {\n  color: #8b949e;\n}\n/* Keep all controls reachable in short windows and avoid clipped dialog footers. */\n.veil {\n  padding: clamp(20px, 7vh, 64px) 20px;\n  align-items: center;\n}\n.dialog {\n  max-height: calc(100dvh - 40px);\n  padding: 24px;\n  scrollbar-gutter: stable;\n}\n.dialog > header {\n  padding-bottom: 12px;\n  border-bottom: 1px solid var(--border);\n  margin-bottom: 16px;\n}\n.dialog > header button {\n  width: 32px;\n  height: 32px;\n  border-radius: 6px;\n  line-height: 1;\n}\n.themes {\n  grid-template-columns: repeat(5, minmax(0, 1fr));\n  gap: 8px;\n  margin: 16px 0 22px;\n}\n.themes button {\n  font-size: 12px;\n  padding: 8px 6px;\n  min-height: 76px;\n}\n.themes button:before {\n  height: 28px;\n}\n.toggle {\n  font-size: 14px;\n  line-height: 1.5;\n  margin: 12px 0;\n}\n.toggle input {\n  flex-shrink: 0;\n}\n.results {\n  max-height: 45vh;\n  overflow: auto;\n  margin: 0 -8px;\n}\n.results button {\n  border-radius: 5px;\n}\nfooter.hint {\n  border-top: 1px solid var(--border);\n  padding-top: 12px;\n  margin-top: 12px;\n}\nselect {\n  background: var(--paper);\n  color: var(--ink);\n  border: 1px solid var(--border);\n  border-radius: 5px;\n  padding: 6px 10px;\n}\n@media (max-width: 560px) {\n  .themes {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n  .dialog {\n    padding: 18px;\n  }\n  .code-actions {\n    flex-wrap: wrap;\n  }\n}\n\n:host([data-theme="ocean"]) {\n  --accent: #087e99;\n  --paper: #f7fcfd;\n  --ink: #133b49;\n  --border: #c7dfe5;\n}\n:host([data-theme="light"]) {\n  --accent: #62566d;\n  --paper: #fffefa;\n  --ink: #343640;\n  --border: #ddd8ce;\n}\ninput {\n  accent-color: var(--accent);\n}\n';

  // src/experience.ts
  function experience(identity, rpc, toast) {
    let p = preferences(), account2 = "", baseline = Date.now(), active = false;
    let route = location.pathname, visited = "";
    const seen = /* @__PURE__ */ new Set(), recent = /* @__PURE__ */ new Map();
    const host = document.createElement("div");
    host.id = "cw-experience";
    const shadow = host.attachShadow({ mode: "open" }), style = document.createElement("style");
    style.textContent = experience_default;
    shadow.append(style);
    document.body.append(host);
    let modal = null, previous = null;
    const node = (tag, text = "", cls = "") => {
      const e = document.createElement(tag);
      e.textContent = text;
      e.className = cls;
      return e;
    };
    const button = (text, fn) => {
      const b = node("button", text);
      b.type = "button";
      if (text === "\xD7") b.setAttribute("aria-label", "Close dialog");
      b.onclick = fn;
      return b;
    };
    function dismiss() {
      modal?.remove();
      modal = null;
      previous?.focus();
    }
    function dialog(title) {
      dismiss();
      previous = document.activeElement;
      modal = node("div", "", "veil");
      const box = node("section", "", "dialog");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", title);
      const h = node("header");
      h.append(node("h2", title), button("\xD7", dismiss));
      box.append(h);
      modal.append(box);
      shadow.append(modal);
      modal.onclick = (e) => {
        if (e.target === modal) dismiss();
      };
      return box;
    }
    shadow.addEventListener("keydown", (event) => {
      const e = event;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
      if (e.key === "Tab" && modal) {
        const n = [
          ...modal.querySelectorAll("button,input,select,a")
        ];
        const f = n[0], l = n.at(-1);
        if (e.shiftKey && shadow.activeElement === f) {
          e.preventDefault();
          l?.focus();
        } else if (!e.shiftKey && shadow.activeElement === l) {
          e.preventDefault();
          f?.focus();
        }
      }
    });
    async function change(patch, refresh = false) {
      const requestedAccount = identity();
      const next = preferences({ ...p, ...patch });
      try {
        await rpc({ type: "preferences", preferences: next });
        if (identity() !== requestedAccount) return;
        p = next;
        apply();
        scan();
        if (refresh) location.reload();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not save preferences");
      }
    }
    function apply() {
      const root = document.documentElement;
      root.dataset.cwTheme = p.theme;
      root.classList.toggle("cw-styled", p.theme !== "native");
      root.classList.toggle("cw-compact", p.compact);
      root.classList.toggle("cw-hide-media", p.collapseMedia);
      root.classList.toggle("cw-code-enabled", p.code);
      host.dataset.theme = p.theme;
      const workbench = document.getElementById("cw-host");
      if (workbench) workbench.dataset.theme = p.theme;
    }
    function settings() {
      const box = dialog("Make Chat yours");
      box.append(
        node(
          "p",
          "Slack-inspired appearance, with your Google Chat conversations.",
          "muted"
        )
      );
      const themes = node("div", "", "themes");
      for (const [value, label2] of [
        ["aubergine", "Aubergine"],
        ["light", "Paper"],
        ["dark", "Midnight"],
        ["ocean", "Ocean"],
        ["native", "Google original"]
      ]) {
        const b = button(label2, () => {
          void change({ theme: value }, true);
        });
        b.dataset.swatch = value;
        b.setAttribute("aria-pressed", String(p.theme === value));
        themes.append(b);
      }
      box.append(themes);
      const toggle = (label2, key) => {
        const l = node("label", "", "toggle"), i = document.createElement("input");
        i.type = "checkbox";
        i.checked = p[key];
        i.onchange = () => void change({ [key]: i.checked });
        l.append(i, document.createTextNode(label2));
        box.append(l);
      };
      toggle("Compact message spacing", "compact");
      toggle(
        "Collapse images, videos and previews \xB7 Alt+Shift+M",
        "collapseMedia"
      );
      toggle("Enhanced code & log viewer", "code");
      box.append(
        node("h3", "Keyword radar"),
        node(
          "p",
          "Highlights loaded messages. Optional notifications apply only to newly arriving messages while Chat is open.",
          "muted"
        )
      );
      const label = node("label", "Keywords (comma separated)");
      const input = document.createElement("input");
      input.className = "text-input";
      input.value = p.keywords.join(", ");
      input.placeholder = "incident, urgent, your project";
      label.append(input);
      box.append(label);
      toggle("Notify me about new matches", "alerts");
      box.append(
        button(
          "Save keywords",
          () => void change({ keywords: input.value.split(",") }).then(
            () => toast("Keyword radar updated")
          )
        )
      );
      box.append(
        node(
          "p",
          "\u2318 / Ctrl K  Switch conversations     \xB7     Alt+Shift+T  Appearance",
          "hint"
        )
      );
      box.querySelector("button")?.focus();
    }
    function collect() {
      for (const link of document.querySelectorAll(
        '[role="link"]'
      )) {
        const group = link.closest("[data-group-id]")?.dataset.groupId ?? link.querySelector("[data-hovercard-id]")?.dataset.hovercardId ?? "";
        if (!/^(space|dm)\//.test(group)) continue;
        const name = link.querySelector("bdi")?.textContent?.trim() || link.getAttribute("aria-label")?.replace(/,.*$/, "") || link.innerText?.split("\n").filter(
          (t) => !/^(Away|Idle|Active|Unread|Conversation|Options|Suggested contact|Press |Open in)/.test(
            t
          )
        ).join(" ").trim() || "";
        if (!name) continue;
        const [kind, id] = group.split("/");
        const url = `https://chat.google.com/${kind === "space" ? "room" : "dm"}/${encodeURIComponent(id)}?authuser=${encodeURIComponent(identity() ?? "")}`;
        const old = recent.get(url);
        recent.set(url, { name, url, seen: old?.seen ?? 0 });
      }
      const route2 = location.pathname.match(/(?:chat|room|dm)\/([^/]+)/)?.[1];
      for (const c of recent.values()) {
        if (new URL(c.url).pathname.endsWith("/" + route2) && visited !== c.url && identity()) {
          visited = c.url;
          c.seen = Date.now();
          void rpc({ type: "visit", name: c.name, url: c.url }).catch(() => {
            visited = "";
          });
        }
      }
    }
    function switcher() {
      collect();
      const box = dialog("Jump to a conversation");
      const input = document.createElement("input");
      input.className = "text-input";
      input.placeholder = "Where would you like to go?";
      input.setAttribute("aria-label", "Find a conversation");
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-controls", "cw-switch-results");
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-autocomplete", "list");
      const results = node("div", "", "results");
      results.id = "cw-switch-results";
      results.setAttribute("role", "listbox");
      let selected = 0, matches = [];
      function draw() {
        results.replaceChildren();
        matches = [...recent.values()].map((c) => ({ c, score: fuzzyScore(c.name, input.value) })).filter((x) => x.score > 0).sort(
          (a, b) => b.score - a.score || b.c.seen - a.c.seen || a.c.name.localeCompare(b.c.name)
        ).slice(0, 12).map((x) => x.c);
        selected = Math.min(selected, Math.max(0, matches.length - 1));
        input.removeAttribute("aria-activedescendant");
        for (const [i, c] of matches.entries()) {
          const b = button(
            `${new URL(c.url).pathname.startsWith("/room") ? "#" : "@"}  ${c.name}`,
            () => location.assign(c.url)
          );
          b.id = `cw-result-${i}`;
          b.setAttribute("role", "option");
          b.setAttribute("aria-selected", String(i === selected));
          b.tabIndex = -1;
          results.append(b);
          if (i === selected) input.setAttribute("aria-activedescendant", b.id);
        }
        if (!matches.length)
          results.append(
            node(
              "p",
              "No matches in loaded sidebar conversations. Expand your Chat sections to discover more.",
              "muted"
            )
          );
      }
      input.oninput = () => {
        selected = 0;
        draw();
      };
      input.onkeydown = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          selected = (selected + (e.key === "ArrowDown" ? 1 : -1) + Math.max(1, matches.length)) % Math.max(1, matches.length);
          draw();
        }
        if (e.key === "Enter" && matches[selected]) {
          e.preventDefault();
          location.assign(matches[selected].url);
        }
      };
      box.append(
        input,
        node("p", "Recent conversations first \xB7 type a few letters", "hint"),
        results,
        node("footer", "\u2191 \u2193 Navigate     \u21B5 Open     Esc Close", "hint")
      );
      draw();
      input.focus();
    }
    function codeViewer(source) {
      const box = dialog("Code & logs");
      box.classList.add("wide");
      const actions = node("div", "", "code-actions");
      const pre = node("pre", "", "code-view");
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Highlighting mode");
      for (const lang of ["Code & logs", "Plain text"]) {
        const o = document.createElement("option");
        o.value = lang;
        o.textContent = lang;
        select.append(o);
      }
      function draw() {
        pre.replaceChildren();
        for (const [i, line] of source.split("\n").entries()) {
          const row = node("div", "", "code-line"), num = node("span", String(i + 1), "line-number"), text = node("span");
          if (select.value === "Plain text") text.textContent = line;
          else {
            const tokens = line.split(
              /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|await|async|def|import|from|class|True|False|true|false|null|None|ERROR|WARN|INFO|DEBUG)\b|\b\d+(?:\.\d+)?\b|\/\/.*$|#.*$)/g
            );
            for (const t of tokens) {
              const cls = /^["']/.test(t) ? "string" : /^(\/\/|#)/.test(t) ? "comment" : /^\d/.test(t) ? "number" : /^(const|let|var|function|return|if|else|await|async|def|import|from|class|True|False|true|false|null|None|ERROR|WARN|INFO|DEBUG)$/.test(
                t
              ) ? "keyword" : "";
              text.append(node("span", t, cls));
            }
          }
          row.append(num, text);
          pre.append(row);
        }
      }
      const copy = button("Copy code", () => {
        void navigator.clipboard.writeText(source).then(
          () => {
            copy.textContent = "Copied";
          },
          () => toast("Clipboard unavailable. Select and copy the code manually.")
        );
      });
      actions.append(
        select,
        copy,
        button("Wrap lines", () => pre.classList.toggle("wrap"))
      );
      select.onchange = draw;
      box.append(actions, pre);
      draw();
      copy.focus();
    }
    const rail = node("nav", "", "cw-workspace-rail");
    rail.setAttribute("aria-label", "Glack workspace navigation");
    for (const [glyph, label, fn] of [
      ["grid", "Glack appearance", settings],
      ["search", "Jump to conversation", switcher],
      ["later", "Open Later", () => document.getElementById("cw-nav")?.click()],
      [
        "media",
        "Toggle media",
        () => void change({ collapseMedia: !p.collapseMedia })
      ],
      ["theme", "Appearance and keyword radar", settings]
    ]) {
      const b = button("", fn);
      b.append(icon(glyph));
      b.title = label;
      b.setAttribute("aria-label", label);
      rail.append(b);
    }
    document.body.append(rail);
    function scan() {
      if (route !== location.pathname) {
        route = location.pathname;
        baseline = Date.now();
        active = false;
      }
      collect();
      for (const button2 of document.querySelectorAll(
        'button,[role="button"]'
      )) {
        if (button2.textContent?.trim() === "New chat")
          button2.classList.add("cw-new-chat");
      }
      document.querySelector('[role="banner"]')?.classList.add("cw-topbar");
      for (const root of document.querySelectorAll(
        "c-wiz[data-group-id]"
      )) {
        const editor = root.querySelector(
          '[contenteditable="true"][role="textbox"]'
        );
        if (editor && editor.closest("c-wiz[data-group-id]") === root) {
          root.classList.add("cw-chat-surface", "cw-composer");
          for (let layer = editor.parentElement; layer && layer !== root; layer = layer.parentElement)
            layer.classList.add("cw-editor-layer");
        }
      }
      for (const list of document.querySelectorAll(
        '[role="list"][aria-label="List of spaces."],[role="list"][aria-label="List of direct messages"]'
      )) {
        list.classList.add("cw-sidebar-list");
        let parent = list.parentElement;
        for (let i = 0; i < 10 && parent; i++, parent = parent.parentElement) {
          if (parent.querySelector('[aria-label="Starred shortcut"]')) {
            parent.classList.add("cw-sidebar");
            break;
          }
        }
      }
      for (const row of document.querySelectorAll(rows)) {
        const body = row.querySelector('[jsname="bgckF"]');
        if (!body) continue;
        const item = message(row);
        if (!item) continue;
        const broadcast = parseBroadcast(item.text);
        let card = body.parentElement?.querySelector(
          ":scope > .cw-broadcast-card"
        );
        if (broadcast && !body.closest('[contenteditable="true"]')) {
          const signature = JSON.stringify(broadcast);
          if (!card || card.dataset.content !== signature) {
            card?.remove();
            card = node("section", "", "cw-broadcast-card");
            card.dataset.content = signature;
            const context = node("div", "", "cw-thread-context");
            context.append(
              node("span", "Thread reply", "cw-thread-label"),
              node("div", broadcast.parent, "cw-thread-parent")
            );
            const link = node(
              "a",
              "View thread \u2192",
              "cw-thread-link"
            );
            link.href = broadcast.url;
            card.append(
              context,
              node("p", broadcast.reply, "cw-broadcast-reply"),
              link
            );
            body.after(card);
          }
          body.classList.add("cw-broadcast-original");
        } else {
          card?.remove();
          body.classList.remove("cw-broadcast-original");
        }
        let authorLine = row.querySelector(
          ":scope > .cw-author-line"
        );
        if (!authorLine) {
          authorLine = node("div", "", "cw-author-line");
          authorLine.setAttribute("aria-hidden", "true");
          authorLine.append(
            node("span", "", "cw-author-avatar"),
            node("strong"),
            node("time")
          );
          row.prepend(authorLine);
        }
        const setText = (e, value) => {
          if (e && e.textContent !== value) e.textContent = value;
        };
        const name = item.sender?.trim() || "Message";
        setText(authorLine.querySelector("strong"), name);
        const avatar = authorLine.querySelector(".cw-author-avatar");
        const photo = row.querySelector(".HTZBof img") ?? (name === "You" ? document.querySelector(
          '[aria-label*="Google Account"] img'
        ) : null);
        const photoUrl = photo?.currentSrc || photo?.src;
        if (photoUrl && /^https:\/\//.test(photoUrl)) {
          if (avatar.querySelector("img")?.getAttribute("src") !== photoUrl) {
            const image = document.createElement("img");
            image.src = photoUrl;
            image.alt = "";
            image.draggable = false;
            avatar.replaceChildren(image);
          }
        } else {
          const fullName = row.querySelector('[jsname="oU6v8b"]')?.getAttribute("data-name") || name;
          setText(
            avatar,
            fullName.split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
          );
        }
        setText(
          authorLine.querySelector("time"),
          row.querySelector('[jsname="E53oB"]')?.textContent?.trim() ?? ""
        );
        row.classList.add("cw-has-author");
        for (const author of row.querySelectorAll(
          '[data-is-message="true"][data-member-id],h3,[role="heading"][aria-level="3"]'
        ))
          author.classList.add("cw-native-author");
        const matches = keywordMatches(item.text, p.keywords);
        row.classList.toggle("cw-radar-match", matches.length > 0);
        row.dataset.cwKeywords = matches.join(", ");
        const stamp = Number(
          row.querySelector("[data-absolute-timestamp]")?.getAttribute("data-absolute-timestamp")
        );
        if (!seen.has(item.id) && stamp > 0) {
          seen.add(item.id);
          if (p.alerts && matches.length && stamp > baseline && active)
            void rpc({
              type: "radar",
              id: item.id,
              url: item.url,
              text: `${matches.join(", ")} \xB7 ${item.sender}: ${item.text}`
            }).catch(() => {
            });
        }
        const sources = [
          ...body.querySelectorAll("pre,code")
        ].filter((e) => !e.parentElement?.closest("pre,code"));
        if (!sources.length && (/```[\s\S]+```/.test(item.text) || item.text.split("\n").filter(
          (l) => /^\s*(\{|\}|const |import |def |\d{4}-\d{2}-\d{2}|ERROR |WARN |INFO )/.test(
            l
          )
        ).length >= 2))
          sources.push(body);
        if (sources.length && !row.querySelector(".cw-code-button")) {
          const b = button("Code / logs", () => {
            const text = sources.map((e) => textOf(e)).join("\n\n");
            codeViewer(text.replace(/^```[^\n]*\n/, "").replace(/\n```$/, ""));
          });
          b.className = "cw-code-button";
          row.append(b);
          for (const source of sources) source.classList.add("cw-code-source");
        }
        const media = [
          ...row.querySelectorAll(
            "video,iframe,[data-attachment-id],img"
          )
        ].filter((e) => {
          if (e.tagName !== "IMG") return true;
          const image = e;
          return !image.closest("[data-hovercard-id],.cw-author-avatar,.HTZBof") && !/emoji|avatar|profile/i.test(
            image.className + " " + image.alt + " " + image.src
          ) && Math.max(image.width, image.naturalWidth) > 100;
        });
        for (const m of media) m.classList.add("cw-media");
        if (media.length && !row.querySelector(".cw-media-toggle")) {
          const b = button("\u25B8 Show media", () => {
            const expanded = row.classList.toggle("cw-media-expanded");
            b.textContent = expanded ? "\u25BE Hide media" : "\u25B8 Show media";
            b.setAttribute("aria-expanded", String(expanded));
          });
          b.className = "cw-media-toggle";
          b.setAttribute("aria-expanded", "false");
          row.append(b);
        }
      }
      active = true;
    }
    document.addEventListener(
      "keydown",
      (e) => {
        if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
          e.preventDefault();
          e.stopImmediatePropagation();
          switcher();
        } else if (e.altKey && e.shiftKey && e.code === "KeyT") {
          e.preventDefault();
          settings();
        } else if (e.altKey && e.shiftKey && e.code === "KeyM") {
          e.preventDefault();
          void change({ collapseMedia: !p.collapseMedia });
        }
      },
      true
    );
    return {
      settings,
      switcher,
      scan,
      update(raw, history = []) {
        const next = identity() ?? "";
        if (next !== account2) {
          account2 = next;
          recent.clear();
          visited = "";
          seen.clear();
          baseline = Date.now();
          active = false;
          route = location.pathname;
          dismiss();
        }
        for (const c of history) {
          const old = recent.get(c.url);
          if (!old || c.seen > old.seen) recent.set(c.url, c);
        }
        p = preferences(raw);
        apply();
      }
    };
  }

  // src/style.css
  var style_default = ':host {\n  font-family:\n    Google Sans,\n    Inter,\n    -apple-system,\n    BlinkMacSystemFont,\n    "Segoe UI",\n    sans-serif;\n  color: #20352e;\n  font-size: 14px;\n  line-height: 1.5;\n  color-scheme: light dark;\n}\n* {\n  box-sizing: border-box;\n}\nbutton,\ninput,\nselect {\n  font: inherit;\n}\nbutton,\na,\ninput,\nselect {\n  -webkit-tap-highlight-color: transparent;\n}\nbutton {\n  cursor: pointer;\n}\nbutton:focus-visible,\na:focus-visible,\ninput:focus-visible,\nselect:focus-visible {\n  outline: 3px solid #75b6a0;\n  outline-offset: 3px;\n}\nbutton {\n  transition:\n    background 0.15s,\n    transform 0.15s;\n}\nbutton:hover {\n  filter: brightness(0.96);\n}\n.cw-launcher {\n  position: fixed;\n  bottom: 24px;\n  left: 24px;\n  z-index: 2147483000;\n  border: 1px solid #d8e4dd;\n  border-radius: 30px;\n  background: #183f33;\n  color: #fff;\n  padding: 12px 20px;\n  box-shadow: 0 4px 18px #122d2925;\n  font-weight: 600;\n}\n.cw-launcher.cw-due {\n  background: #8b4e16;\n}\n.cw-panel {\n  position: fixed;\n  top: 20px;\n  right: 22px;\n  bottom: 20px;\n  width: 440px;\n  max-width: calc(100vw - 28px);\n  z-index: 2147483001;\n  background: #f7faf7;\n  border: 1px solid #dbe5dd;\n  border-radius: 24px;\n  box-shadow: 0 16px 65px #0c241f35;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  animation: cw-in 0.18s ease-out;\n}\n.cw-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  padding: 28px 26px 20px;\n  background: linear-gradient(120deg, #e7f2eb, #f7faf7);\n}\n.cw-eyebrow {\n  font-size: 10px;\n  letter-spacing: 2px;\n  font-weight: 750;\n  color: #577365;\n  margin-bottom: 8px;\n}\nh1 {\n  font-size: 24px;\n  font-weight: 550;\n  letter-spacing: -0.7px;\n  margin: 0;\n  line-height: 1.2;\n}\nh2 {\n  font-size: 18px;\n  font-weight: 550;\n  letter-spacing: -0.3px;\n  margin: 22px 0 8px;\n}\np {\n  margin: 10px 0;\n  line-height: 1.6;\n}\n.cw-close {\n  border: 0;\n  background: transparent;\n  color: inherit;\n  font-size: 27px;\n  line-height: 24px;\n  padding: 4px 8px;\n  border-radius: 8px;\n}\n.cw-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 0 20px 15px;\n  border-bottom: 1px solid #e1e8e2;\n}\n.cw-tab {\n  border: 0;\n  padding: 8px 11px;\n  background: transparent;\n  color: #66756c;\n  border-radius: 10px;\n  font-size: 12px;\n  font-weight: 600;\n}\n.cw-tab.active {\n  background: #dfebe3;\n  color: #244c3b;\n}\n.cw-body {\n  padding: 20px 24px;\n  overflow: auto;\n  flex: 1;\n  overscroll-behavior: contain;\n}\n.cw-input {\n  width: 100%;\n  border: 1px solid #d9e2db;\n  border-radius: 12px;\n  background: #fff;\n  color: inherit;\n  padding: 12px 14px;\n  margin-bottom: 12px;\n  font-size: 13px;\n}\n.cw-card {\n  border: 1px solid #e0e7e1;\n  background: #fff;\n  padding: 18px;\n  border-radius: 16px;\n  margin: 12px 0;\n  box-shadow: 0 2px 3px #183f3303;\n}\n.cw-meta {\n  display: flex;\n  justify-content: space-between;\n  gap: 12px;\n  font-size: 10px;\n  text-transform: uppercase;\n  letter-spacing: 0.7px;\n  color: #738278;\n  margin-bottom: 10px;\n}\n.cw-meta span:first-child {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.cw-sender {\n  font-size: 13px;\n  font-weight: 650;\n}\n.cw-message {\n  font-size: 13px;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  max-height: 220px;\n  overflow: auto;\n  color: #44564b;\n}\n.cw-actions {\n  display: flex;\n  gap: 6px;\n  flex-wrap: wrap;\n  margin-top: 14px;\n}\n.cw-btn {\n  border: 1px solid #e0e7e1;\n  background: #f7faf7;\n  color: #375847;\n  border-radius: 8px;\n  padding: 7px 10px;\n  font-size: 11px;\n  font-weight: 600;\n}\n.cw-btn.primary {\n  background: #245b43;\n  color: #fff;\n  padding: 11px 15px;\n  border-color: #245b43;\n}\n.cw-time {\n  font-size: 11px;\n  color: #627c6b;\n  background: #eef4ef;\n  border-radius: 6px;\n  padding: 5px 8px;\n  display: inline-block;\n}\n.cw-time.overdue {\n  background: #fff0d9;\n  color: #8a5915;\n}\n.cw-muted {\n  color: #7b887f;\n  font-size: 12px;\n}\n.cw-center {\n  text-align: center;\n}\n.cw-empty-icon {\n  width: 58px;\n  height: 58px;\n  display: grid;\n  place-items: center;\n  border-radius: 50%;\n  background: #e7f0e9;\n  color: #668675;\n  font-size: 24px;\n  margin: 54px auto 18px;\n}\n.cw-toast {\n  position: fixed;\n  z-index: 2147483646;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  max-width: 560px;\n  padding: 14px 20px;\n  border-radius: 12px;\n  background: #203f32;\n  color: white;\n  box-shadow: 0 8px 30px #0003;\n  font-size: 13px;\n  animation: cw-in 0.18s ease-out;\n}\n.cw-preset {\n  display: block;\n  width: 100%;\n  text-align: left;\n  padding: 14px;\n  border: 1px solid #d9e2db;\n  border-radius: 12px;\n  background: #fff;\n  color: inherit;\n  margin: 10px 0;\n}\n.cw-label {\n  display: block;\n  margin-top: 20px;\n  font-size: 12px;\n  color: #748377;\n}\n.cw-label input {\n  margin-top: 8px;\n}\n.cw-collection-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 10px 0;\n  border-bottom: 1px solid #edf1ed;\n}\n.cw-shortcut {\n  color: #2d654b;\n  flex: 1;\n  text-decoration: none;\n  font-size: 13px;\n}\n.cw-select {\n  max-width: 90px;\n  border: 1px solid #dce4dd;\n  border-radius: 6px;\n  padding: 4px;\n  color: inherit;\n  background: transparent;\n  font-size: 11px;\n}\n@keyframes cw-in {\n  from {\n    opacity: 0;\n    translate: 0 5px;\n  }\n  to {\n    opacity: 1;\n    translate: 0 0;\n  }\n}\n@media (prefers-color-scheme: dark) {\n  :host {\n    color: #dce8df;\n  }\n  .cw-panel {\n    background: #1b2420;\n    border-color: #3c4c41;\n  }\n  .cw-head {\n    background: linear-gradient(120deg, #273a2e, #1b2420);\n  }\n  .cw-eyebrow,\n  .cw-muted {\n    color: #9ab3a2;\n  }\n  .cw-tabs {\n    border-color: #35453a;\n  }\n  .cw-tab {\n    color: #a1b7a8;\n  }\n  .cw-tab.active {\n    background: #344d3d;\n    color: #d9ecdf;\n  }\n  .cw-card,\n  .cw-input,\n  .cw-preset {\n    background: #242f28;\n    border-color: #3c4c41;\n  }\n  .cw-btn {\n    background: #2d3c32;\n    color: #d0e5d7;\n    border-color: #455b4b;\n  }\n  .cw-message {\n    color: #c0d0c4;\n  }\n  .cw-close {\n    color: inherit;\n  }\n  .cw-meta {\n    color: #9bb4a4;\n  }\n  .cw-time {\n    background: #324938;\n    color: #b7d3bf;\n  }\n  .cw-time.overdue {\n    background: #4f3e25;\n    color: #e5c08b;\n  }\n  .cw-empty-icon {\n    background: #304735;\n    color: #a8c6b0;\n  }\n  .cw-shortcut {\n    color: #b0d5bd;\n  }\n  .cw-collection-row {\n    border-color: #3a4c3e;\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  * {\n    animation: none !important;\n    transition: none !important;\n  }\n}\n\n:host([data-theme]:not([data-theme="native"])) {\n  --cw-panel-bg: #fff;\n  --cw-panel-text: #1d1c1d;\n  --cw-panel-muted: #616061;\n  --cw-panel-border: #ddd;\n  --cw-panel-hover: #f6f6f7;\n  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  color: var(--cw-panel-text);\n  color-scheme: light;\n}\n:host([data-theme="dark"][data-theme]) {\n  --cw-panel-bg: #1a1d21;\n  --cw-panel-text: #e1e2e3;\n  --cw-panel-muted: #aaadb2;\n  --cw-panel-border: #383a3e;\n  --cw-panel-hover: #222529;\n  color: var(--cw-panel-text);\n  color-scheme: dark;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-launcher {\n  display: none;\n}\n:host([data-theme]:not([data-theme="native"]))\n  :is(\n    .cw-panel,\n    .cw-head,\n    .cw-tabs,\n    .cw-card,\n    .cw-input,\n    .cw-select,\n    .cw-btn,\n    .cw-preset,\n    .cw-tab\n  ) {\n  background: var(--cw-panel-bg);\n  color: var(--cw-panel-text);\n  border-color: var(--cw-panel-border);\n}\n:host([data-theme]:not([data-theme="native"])) .cw-panel {\n  border-radius: 10px;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-head {\n  padding: 22px 22px 18px;\n}\n:host([data-theme]:not([data-theme="native"]))\n  :is(.cw-muted, .cw-meta, .cw-eyebrow) {\n  color: var(--cw-panel-muted);\n}\n:host([data-theme]:not([data-theme="native"])) :is(.cw-message, .cw-sender) {\n  color: var(--cw-panel-text);\n}\n:host([data-theme]:not([data-theme="native"])) .cw-tab.active {\n  background: var(--cw-panel-hover);\n  color: var(--cw-panel-text);\n  box-shadow: inset 0 -2px #85548b;\n  border-radius: 5px 5px 0 0;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-card {\n  border-radius: 8px;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-btn {\n  border-radius: 5px;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-btn.primary {\n  background: #007a5a;\n  color: #fff;\n  border-color: #007a5a;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-tabs {\n  padding: 0 16px 10px;\n  gap: 2px;\n  flex-wrap: wrap;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-body {\n  padding: 18px 22px;\n}\n:host([data-theme]:not([data-theme="native"])) h1 {\n  font-size: 22px;\n  font-weight: 650;\n}\n:host([data-theme]:not([data-theme="native"])) :is(.cw-time, .cw-empty-icon) {\n  background: var(--cw-panel-hover);\n  color: var(--cw-panel-muted);\n}\n:host([data-theme]:not([data-theme="native"])) .cw-time.overdue {\n  background: #d5a13420;\n  color: var(--cw-panel-text);\n}\n:host([data-theme]:not([data-theme="native"])) .cw-toast {\n  background: #252329;\n  border: 1px solid #ffffff20;\n  border-radius: 7px;\n}\n:host([data-theme]:not([data-theme="native"])) .cw-shortcut {\n  color: var(--cw-panel-text);\n}\n:host([data-theme]:not([data-theme="native"])) .cw-collection-row {\n  border-color: var(--cw-panel-border);\n}\n';

  // src/content.ts
  if (window.top === window && location.pathname !== "/drivesharing/driveshare")
    start();
  function start() {
    if (document.getElementById("cw-host")) return;
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
    const extras = experience(() => identity, rpc, toast);
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
      if ((result.state.revision ?? 0) < (state.revision ?? 0)) return state;
      state = result.state;
      extras.update(state.preferences, state.recent);
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
      launcher.title = "Glack \xB7 Alt+Shift+L";
      launcher.setAttribute("aria-expanded", String(open));
      ui.append(launcher);
      if (due.length) launcher.classList.add("cw-due");
      if (!open) return;
      const panel = el("section", "cw-panel");
      panel.setAttribute("aria-label", "Glack");
      const head = el("header", "cw-head");
      const titles = el("div");
      titles.append(
        el("div", "cw-eyebrow", "CHAT WORKBENCH"),
        el(
          "h1",
          "",
          view === "remind" ? "Remind me" : view === "collections" ? "Collections" : view === "settings" ? "Preferences" : view === "reminders" ? "Reminders" : view === "done" ? "Completed" : "Later"
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
        body.append(
          button("\u{1F3A8} Appearance & productivity", extras.settings),
          button("\u2318 K \xB7 Jump to conversation", extras.switcher)
        );
        const importer = el("input", "cw-input");
        importer.type = "file";
        importer.accept = ".json";
        importer.setAttribute("aria-label", "Import Glack backup");
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
            a.download = "glack-backup.json";
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
            view === "done" ? "No completed items yet" : "You\u2019re all caught up"
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
          button("Save", () => act(() => save(message(row)))),
          button("Remind", () => remind(message(row)))
        );
        row.append(tools);
        row.classList.add("cw-message-row");
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
      extras.scan();
      enhanceMessages();
      enhanceComposers();
      const shortcut = document.querySelector(
        '[aria-label="Starred shortcut"]'
      );
      if (shortcut?.parentElement && !document.getElementById("cw-nav")) {
        const nav = button("Later", () => show(), "cw-nav");
        nav.id = "cw-nav";
        nav.prepend(icon("later"));
        shortcut.parentElement.append(nav);
        const prefs = button(
          "Appearance",
          extras.settings,
          "cw-nav cw-appearance"
        );
        const jump2 = button("Jump to\u2026   \u2318 K", extras.switcher, "cw-nav cw-jump");
        prefs.prepend(icon("theme"));
        jump2.prepend(icon("search"));
        shortcut.parentElement.append(jump2, prefs);
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
        extras.update(state.preferences, state.recent);
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
