import { parseBroadcast } from "./core";
import { icon } from "./icons";
import {
  preferences,
  fuzzyScore,
  keywordMatches,
  type Preferences,
} from "./preferences";
import { rows, message, textOf } from "./adapter";
import css from "./experience.css";

type Conversation = { name: string; url: string; seen: number };
export function experience(
  identity: () => string | null,
  rpc: (data: Record<string, unknown>) => Promise<unknown>,
  toast: (s: string) => void,
) {
  let p = preferences(),
    account = "",
    baseline = Date.now(),
    active = false;
  let route = location.pathname,
    visited = "";
  const seen = new Set<string>(),
    recent = new Map<string, Conversation>();
  const host = document.createElement("div");
  host.id = "cw-experience";
  const shadow = host.attachShadow({ mode: "open" }),
    style = document.createElement("style");
  style.textContent = css;
  shadow.append(style);
  document.body.append(host);
  let modal: HTMLElement | null = null,
    previous: HTMLElement | null = null;
  const node = (tag: string, text = "", cls = "") => {
    const e = document.createElement(tag);
    e.textContent = text;
    e.className = cls;
    return e;
  };
  const button = (text: string, fn: () => void) => {
    const b = node("button", text) as HTMLButtonElement;
    b.type = "button";
    if (text === "×") b.setAttribute("aria-label", "Close dialog");
    b.onclick = fn;
    return b;
  };
  function dismiss() {
    modal?.remove();
    modal = null;
    previous?.focus();
  }
  function dialog(title: string) {
    dismiss();
    previous = document.activeElement as HTMLElement;
    modal = node("div", "", "veil");
    const box = node("section", "", "dialog");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", title);
    const h = node("header");
    h.append(node("h2", title), button("×", dismiss));
    box.append(h);
    modal.append(box);
    shadow.append(modal);
    modal.onclick = (e) => {
      if (e.target === modal) dismiss();
    };
    return box;
  }
  shadow.addEventListener("keydown", (event) => {
    const e = event as KeyboardEvent;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
    if (e.key === "Tab" && modal) {
      const n = [
        ...modal.querySelectorAll<HTMLElement>("button,input,select,a"),
      ];
      const f = n[0],
        l = n.at(-1);
      if (e.shiftKey && shadow.activeElement === f) {
        e.preventDefault();
        l?.focus();
      } else if (!e.shiftKey && shadow.activeElement === l) {
        e.preventDefault();
        f?.focus();
      }
    }
  });
  async function change(patch: Partial<Preferences>, refresh = false) {
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
        "muted",
      ),
    );
    const themes = node("div", "", "themes");
    for (const [value, label] of [
      ["aubergine", "Aubergine"],
      ["light", "Paper"],
      ["dark", "Midnight"],
      ["ocean", "Ocean"],
      ["native", "Google original"],
    ]) {
      const b = button(label, () => {
        void change({ theme: value as Preferences["theme"] }, true);
      });
      b.dataset.swatch = value;
      b.setAttribute("aria-pressed", String(p.theme === value));
      themes.append(b);
    }
    box.append(themes);
    const toggle = (
      label: string,
      key: "compact" | "collapseMedia" | "code" | "alerts",
    ) => {
      const l = node("label", "", "toggle"),
        i = document.createElement("input");
      i.type = "checkbox";
      i.checked = p[key];
      i.onchange = () => void change({ [key]: i.checked });
      l.append(i, document.createTextNode(label));
      box.append(l);
    };
    toggle("Compact message spacing", "compact");
    toggle(
      "Collapse images, videos and previews · Alt+Shift+M",
      "collapseMedia",
    );
    toggle("Enhanced code & log viewer", "code");
    box.append(
      node("h3", "Keyword radar"),
      node(
        "p",
        "Highlights loaded messages. Optional notifications apply only to newly arriving messages while Chat is open.",
        "muted",
      ),
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
        () =>
          void change({ keywords: input.value.split(",") }).then(() =>
            toast("Keyword radar updated"),
          ),
      ),
    );
    box.append(
      node(
        "p",
        "⌘ / Ctrl K  Switch conversations     ·     Alt+Shift+T  Appearance",
        "hint",
      ),
    );
    box.querySelector<HTMLElement>("button")?.focus();
  }
  function collect() {
    for (const link of document.querySelectorAll<HTMLElement>(
      '[role="link"]',
    )) {
      const group =
        link.closest<HTMLElement>("[data-group-id]")?.dataset.groupId ??
        link.querySelector<HTMLElement>("[data-hovercard-id]")?.dataset
          .hovercardId ??
        "";
      if (!/^(space|dm)\//.test(group)) continue;
      const name =
        link.querySelector("bdi")?.textContent?.trim() ||
        link.getAttribute("aria-label")?.replace(/,.*$/, "") ||
        link.innerText
          ?.split("\n")
          .filter(
            (t) =>
              !/^(Away|Idle|Active|Unread|Conversation|Options|Suggested contact|Press |Open in)/.test(
                t,
              ),
          )
          .join(" ")
          .trim() ||
        "";
      if (!name) continue;
      const [kind, id] = group.split("/");
      const url = `https://chat.google.com/${kind === "space" ? "room" : "dm"}/${encodeURIComponent(id)}?authuser=${encodeURIComponent(identity() ?? "")}`;
      const old = recent.get(url);
      recent.set(url, { name, url, seen: old?.seen ?? 0 });
    }
    const route = location.pathname.match(/(?:chat|room|dm)\/([^/]+)/)?.[1];
    for (const c of recent.values()) {
      if (
        new URL(c.url).pathname.endsWith("/" + route) &&
        visited !== c.url &&
        identity()
      ) {
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
    let selected = 0,
      matches: Conversation[] = [];
    function draw() {
      results.replaceChildren();
      matches = [...recent.values()]
        .map((c) => ({ c, score: fuzzyScore(c.name, input.value) }))
        .filter((x) => x.score > 0)
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.c.seen - a.c.seen ||
            a.c.name.localeCompare(b.c.name),
        )
        .slice(0, 12)
        .map((x) => x.c);
      selected = Math.min(selected, Math.max(0, matches.length - 1));
      input.removeAttribute("aria-activedescendant");
      for (const [i, c] of matches.entries()) {
        const b = button(
          `${new URL(c.url).pathname.startsWith("/room") ? "#" : "@"}  ${c.name}`,
          () => location.assign(c.url),
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
            "muted",
          ),
        );
    }
    input.oninput = () => {
      selected = 0;
      draw();
    };
    input.onkeydown = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        selected =
          (selected +
            (e.key === "ArrowDown" ? 1 : -1) +
            Math.max(1, matches.length)) %
          Math.max(1, matches.length);
        draw();
      }
      if (e.key === "Enter" && matches[selected]) {
        e.preventDefault();
        location.assign(matches[selected].url);
      }
    };
    box.append(
      input,
      node("p", "Recent conversations first · type a few letters", "hint"),
      results,
      node("footer", "↑ ↓ Navigate     ↵ Open     Esc Close", "hint"),
    );
    draw();
    input.focus();
  }
  function codeViewer(source: string) {
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
        const row = node("div", "", "code-line"),
          num = node("span", String(i + 1), "line-number"),
          text = node("span");
        if (select.value === "Plain text") text.textContent = line;
        else {
          const tokens = line.split(
            /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|await|async|def|import|from|class|True|False|true|false|null|None|ERROR|WARN|INFO|DEBUG)\b|\b\d+(?:\.\d+)?\b|\/\/.*$|#.*$)/g,
          );
          for (const t of tokens) {
            const cls = /^["']/.test(t)
              ? "string"
              : /^(\/\/|#)/.test(t)
                ? "comment"
                : /^\d/.test(t)
                  ? "number"
                  : /^(const|let|var|function|return|if|else|await|async|def|import|from|class|True|False|true|false|null|None|ERROR|WARN|INFO|DEBUG)$/.test(
                        t,
                      )
                    ? "keyword"
                    : "";
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
        () =>
          toast("Clipboard unavailable. Select and copy the code manually."),
      );
    });
    actions.append(
      select,
      copy,
      button("Wrap lines", () => pre.classList.toggle("wrap")),
    );
    select.onchange = draw;
    box.append(actions, pre);
    draw();
    copy.focus();
  }
  const rail = node("nav", "", "cw-workspace-rail");
  rail.setAttribute("aria-label", "Glack workspace navigation");
  for (const [glyph, label, fn] of [
    ["glack", "Glack appearance", settings],
    ["search", "Jump to conversation", switcher],
    ["later", "Open Later", () => document.getElementById("cw-nav")?.click()],
    [
      "media",
      "Toggle media",
      () => void change({ collapseMedia: !p.collapseMedia }),
    ],
    ["theme", "Appearance and keyword radar", settings],
  ] as const) {
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
    for (const button of document.querySelectorAll<HTMLElement>(
      'button,[role="button"]',
    )) {
      if (button.textContent?.trim() === "New chat")
        button.classList.add("cw-new-chat");
    }
    document.querySelector('[role="banner"]')?.classList.add("cw-topbar");
    for (const logo of document.querySelectorAll('[aria-label="Chat logo"]')) {
      if (logo.querySelector(".cw-brand")) continue;
      const brand = node("span", "", "cw-brand");
      brand.append(icon("glack"), document.createTextNode("Glack"));
      brand.setAttribute("aria-hidden", "true");
      logo.append(brand);
    }

    for (const root of document.querySelectorAll<HTMLElement>(
      "c-wiz[data-group-id]",
    )) {
      const editor = root.querySelector<HTMLElement>(
        '[contenteditable="true"][role="textbox"]',
      );
      if (editor && editor.closest("c-wiz[data-group-id]") === root) {
        root.classList.add("cw-chat-surface", "cw-composer");
        for (
          let layer = editor.parentElement;
          layer && layer !== root;
          layer = layer.parentElement
        )
          layer.classList.add("cw-editor-layer");
      }
    }
    for (const list of document.querySelectorAll<HTMLElement>(
      '[role="list"][aria-label="List of spaces."],[role="list"][aria-label="List of direct messages"]',
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
    for (const row of document.querySelectorAll<HTMLElement>(rows)) {
      const body = row.querySelector<HTMLElement>('[jsname="bgckF"]');
      if (!body) continue;
      const item = message(row);
      if (!item) continue;
      const broadcast = parseBroadcast(item.text);
      let card = body.parentElement?.querySelector<HTMLElement>(
        ":scope > .cw-broadcast-card",
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
            node("div", broadcast.parent, "cw-thread-parent"),
          );
          const link = node(
            "a",
            "View thread →",
            "cw-thread-link",
          ) as HTMLAnchorElement;
          link.href = broadcast.url;
          card.append(
            context,
            node("p", broadcast.reply, "cw-broadcast-reply"),
            link,
          );
          body.after(card);
        }
        body.classList.add("cw-broadcast-original");
      } else {
        card?.remove();
        body.classList.remove("cw-broadcast-original");
      }

      let authorLine = row.querySelector<HTMLElement>(
        ":scope > .cw-author-line",
      );
      if (!authorLine) {
        authorLine = node("div", "", "cw-author-line");
        authorLine.setAttribute("aria-hidden", "true");
        authorLine.append(
          node("span", "", "cw-author-avatar"),
          node("strong"),
          node("time"),
        );
        row.prepend(authorLine);
      }
      const setText = (e: Element | null, value: string) => {
        if (e && e.textContent !== value) e.textContent = value;
      };
      const name = item.sender?.trim() || "Message";
      setText(authorLine.querySelector("strong"), name);
      const avatar =
        authorLine.querySelector<HTMLElement>(".cw-author-avatar")!;
      const photo =
        row.querySelector<HTMLImageElement>(".HTZBof img") ??
        (name === "You"
          ? document.querySelector<HTMLImageElement>(
              '[aria-label*="Google Account"] img',
            )
          : null);
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
        const fullName =
          row.querySelector('[jsname="oU6v8b"]')?.getAttribute("data-name") ||
          name;
        setText(
          avatar,
          fullName
            .split(/\s+/)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase(),
        );
      }
      setText(
        authorLine.querySelector("time"),
        row.querySelector('[jsname="E53oB"]')?.textContent?.trim() ?? "",
      );
      row.classList.add("cw-has-author");
      for (const author of row.querySelectorAll<HTMLElement>(
        '[data-is-message="true"][data-member-id],h3,[role="heading"][aria-level="3"]',
      ))
        author.classList.add("cw-native-author");
      const matches = keywordMatches(item.text, p.keywords);
      row.classList.toggle("cw-radar-match", matches.length > 0);
      row.dataset.cwKeywords = matches.join(", ");
      const stamp = Number(
        row
          .querySelector("[data-absolute-timestamp]")
          ?.getAttribute("data-absolute-timestamp"),
      );
      if (!seen.has(item.id) && stamp > 0) {
        seen.add(item.id);
        if (p.alerts && matches.length && stamp > baseline && active)
          void rpc({
            type: "radar",
            id: item.id,
            url: item.url,
            text: `${matches.join(", ")} · ${item.sender}: ${item.text}`,
          }).catch(() => {});
      }
      const sources = [
        ...body.querySelectorAll<HTMLElement>("pre,code"),
      ].filter((e) => !e.parentElement?.closest("pre,code"));
      if (
        !sources.length &&
        (/```[\s\S]+```/.test(item.text) ||
          item.text
            .split("\n")
            .filter((l) =>
              /^\s*(\{|\}|const |import |def |\d{4}-\d{2}-\d{2}|ERROR |WARN |INFO )/.test(
                l,
              ),
            ).length >= 2)
      )
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
        ...row.querySelectorAll<HTMLElement>(
          "video,iframe,[data-attachment-id],img",
        ),
      ].filter((e) => {
        if (e.tagName !== "IMG") return true;
        const image = e as HTMLImageElement;
        return (
          !image.closest("[data-hovercard-id],.cw-author-avatar,.HTZBof") &&
          !/emoji|avatar|profile/i.test(
            image.className + " " + image.alt + " " + image.src,
          ) &&
          Math.max(image.width, image.naturalWidth) > 100
        );
      });
      for (const m of media) m.classList.add("cw-media");
      if (media.length && !row.querySelector(".cw-media-toggle")) {
        const b = button("▸ Show media", () => {
          const expanded = row.classList.toggle("cw-media-expanded");
          b.textContent = expanded ? "▾ Hide media" : "▸ Show media";
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
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "k"
      ) {
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
    true,
  );
  return {
    settings,
    switcher,
    scan,
    update(raw: unknown, history: Conversation[] = []) {
      const next = identity() ?? "";
      if (next !== account) {
        account = next;
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
    },
  };
}
