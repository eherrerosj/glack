import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const bundle = await readFile(
  new URL("../dist/content.js", import.meta.url),
  "utf8",
);
function fixture({ occupied = false, failReply = false } = {}) {
  const dom = new JSDOM(
    `<title>Test - Chat</title><button aria-label="Google Account: Test (test@example.com)"></button><div aria-label="Starred shortcut"></div><c-wiz data-is-detailed-thread-view="false" data-is-room-compose-postbar="true" data-group-id="space/test"><div role="textbox" contenteditable="true">${occupied ? "Existing draft" : ""}</div><button aria-label="Send message">Send</button></c-wiz><c-wiz data-topic-id="parent" data-local-topic-id="parent" data-is-local-only="false" data-p='%.@.["space/test"]'><div data-id="parent" data-message-multiplat-item-id="MSG/parent"><h3>Test</h3><div jsname="bgckF">Parent message</div></div></c-wiz><c-wiz data-is-detailed-thread-view="true" data-topic-id="parent" data-group-id="space/test"><div role="textbox" contenteditable="true">Resolved</div><button aria-label="Send message">Send</button></c-wiz>`,
    {
      url: "https://chat.google.com/room/test",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window;
  let sends = 0;
  w.chrome = {
    runtime: {
      sendMessage: async () => ({
        state: { version: 1, items: [], sections: [] },
      }),
    },
    storage: { onChanged: { addListener() {} } },
  };
  w.document.execCommand = (_cmd, _ui, text) => {
    const e = w.document.activeElement;
    e.textContent = text;
    return true;
  };
  const editors = w.document.querySelectorAll("[contenteditable]");
  const buttons = w.document.querySelectorAll(
    'button[aria-label="Send message"]',
  );
  buttons[1].onclick = () => {
    sends++;
    if (failReply) return;
    const row = w.document.createElement("div");
    row.setAttribute("data-id", "reply");
    row.setAttribute("data-message-multiplat-item-id", "MSG/reply");
    row.innerHTML =
      '<div jsname="bgckF">Resolved</div><span data-absolute-timestamp="123">Now</span>';
    w.document.querySelector("[data-local-topic-id]").append(row);
    editors[1].textContent = "";
  };
  buttons[0].onclick = () => {
    sends++;
    const topic = w.document.createElement("c-wiz");
    topic.dataset.localTopicId = "broadcast";
    topic.dataset.isLocalOnly = "false";
    const row = w.document.createElement("div");
    row.dataset.id = "broadcast";
    row.setAttribute("data-message-multiplat-item-id", "MSG/broadcast");
    const text = w.document.createElement("div");
    text.setAttribute("jsname", "bgckF");
    text.textContent = editors[0].textContent;
    row.append(text);
    const stamp = w.document.createElement("span");
    stamp.setAttribute("data-absolute-timestamp", "123");
    row.append(stamp);
    topic.append(row);
    w.document.body.append(topic);
    editors[0].textContent = "";
  };
  w.eval(bundle);
  return { dom, w, editors, buttons, sends: () => sends };
}
const settle = () => new Promise((r) => setTimeout(r, 50));
test("broadcast sends reply then one linked root post", async () => {
  const f = fixture();
  try {
    await settle();
    f.w.document.querySelector(".cw-broadcast input").checked = true;
    f.buttons[1].click();
    await settle();
    assert.equal(f.sends(), 2);
    assert.match(
      f.w.document.querySelector('[data-id="broadcast"]').textContent,
      /Replied to thread: Parent message/,
    );
    assert.match(
      f.w.document.querySelector("#cw-host").shadowRoot.textContent,
      /Reply and Space broadcast sent/,
    );
  } finally {
    f.dom.window.close();
  }
});
test("occupied root draft blocks both sends and preserves reply", async () => {
  const f = fixture({ occupied: true });
  try {
    await settle();
    f.w.document.querySelector(".cw-broadcast input").checked = true;
    f.buttons[1].click();
    await settle();
    assert.equal(f.sends(), 0);
    assert.equal(f.editors[0].textContent, "Existing draft");
    assert.equal(f.editors[1].textContent, "Resolved");
  } finally {
    f.dom.window.close();
  }
});
test("unconfirmed reply never triggers root send", async () => {
  const f = fixture({ failReply: true });
  try {
    await settle();
    f.w.document.querySelector(".cw-broadcast input").checked = true;
    f.buttons[1].click();
    await settle();
    assert.equal(f.sends(), 1);
    assert.equal(f.editors[0].textContent, "");
  } finally {
    f.dom.window.close();
  }
});
test("switcher keyboard navigation filters sidebar conversations and Escape restores focus", async () => {
  const f = fixture();
  try {
    await settle();
    const nav = f.w.document.createElement("div");
    nav.innerHTML =
      '<div role="link"><i data-hovercard-id="space/alpha"></i><bdi>Project Alpha</bdi></div><div role="link"><i data-hovercard-id="space/beta"></i><bdi>Project Beta</bdi></div>';
    f.w.document.body.append(nav);
    f.editors[0].focus();
    f.w.document.dispatchEvent(
      new f.w.KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
      }),
    );
    const s = f.w.document.querySelector("#cw-experience").shadowRoot;
    const input = s.querySelector("input");
    input.value = "pjlp";
    input.dispatchEvent(new f.w.Event("input"));
    assert.match(s.querySelector("[role=option]").textContent, /Alpha/);
    assert.equal(s.querySelectorAll("[role=option]").length, 1);
    input.dispatchEvent(
      new f.w.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true,
      }),
    );
    assert.equal(s.querySelector("[role=dialog]"), null);
    assert.equal(f.w.document.activeElement, f.editors[0]);
  } finally {
    f.dom.window.close();
  }
});
test("code viewer preserves literal markup as text and shows numbered lines", async () => {
  const f = fixture();
  try {
    await settle();
    const body = f.w.document.querySelector("[jsname=bgckF]");
    const pre = f.w.document.createElement("pre");
    pre.textContent =
      'const value = "<img src=x onerror=alert(1)>";\nreturn value;';
    body.replaceChildren(pre);
    await new Promise((r) => setTimeout(r, 350));
    f.w.document.querySelector(".cw-code-button").click();
    const s = f.w.document.querySelector("#cw-experience").shadowRoot;
    assert.equal(s.querySelectorAll(".code-line").length, 2);
    assert.equal(s.querySelector("img"), null);
    assert.match(s.querySelector(".code-view").textContent, /<img src=x/);
  } finally {
    f.dom.window.close();
  }
});
test("media toggles retain emoji and can reveal a collapsed attachment", async () => {
  const f = fixture();
  try {
    await settle();
    const row = f.w.document.querySelector("[data-id=parent]");
    const img = f.w.document.createElement("img");
    img.width = 200;
    img.alt = "Test image";
    const emoji = f.w.document.createElement("img");
    emoji.width = 18;
    emoji.alt = "smile emoji";
    row.append(img, emoji);
    await new Promise((r) => setTimeout(r, 350));
    assert.ok(img.classList.contains("cw-media"));
    assert.ok(!emoji.classList.contains("cw-media"));
    const b = row.querySelector(".cw-media-toggle");
    b.click();
    assert.ok(row.classList.contains("cw-media-expanded"));
    assert.equal(b.getAttribute("aria-expanded"), "true");
    b.click();
    assert.ok(!row.classList.contains("cw-media-expanded"));
  } finally {
    f.dom.window.close();
  }
});
test("composer styling never marks an enclosing conversation as an editor", async () => {
  const f = fixture();
  try {
    await settle();
    const composer = f.editors[0].parentElement;
    const container = f.w.document.createElement("c-wiz");
    container.dataset.groupId = "space/test";
    composer.before(container);
    container.append(composer);
    await new Promise((r) => setTimeout(r, 350));
    assert.ok(composer.classList.contains("cw-composer"));
    assert.ok(!container.classList.contains("cw-composer"));
  } finally {
    f.dom.window.close();
  }
});
test("broadcast card preserves original message text and renders reply text safely", async () => {
  const f = fixture();
  try {
    await settle();
    const body = f.w.document.querySelector("[jsname=bgckF]");
    const source =
      "↪ Replied to thread: Original context\n\n<img src=x onerror=alert(1)>\n\nView thread: https://chat.google.com/room/test/parent/parent";
    body.textContent = source;
    await new Promise((r) => setTimeout(r, 350));
    const card = f.w.document.querySelector(".cw-broadcast-card");
    assert.ok(card);
    assert.equal(body.textContent, source);
    assert.equal(card.querySelector("img"), null);
    assert.equal(card.querySelector("a").textContent, "View thread →");
    assert.match(
      card.querySelector(".cw-broadcast-reply").textContent,
      /<img src=x/,
    );
    body.textContent = "Edited ordinary message";
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(f.w.document.querySelector(".cw-broadcast-card"), null);
    assert.ok(!body.classList.contains("cw-broadcast-original"));
  } finally {
    f.dom.window.close();
  }
});
test("temporary account header removal retains the selected appearance", async () => {
  const f = fixture();
  try {
    await settle();
    f.w.chrome.runtime.sendMessage = async () => ({
      state: {
        version: 1,
        revision: 5,
        items: [],
        sections: [],
        preferences: { theme: "ocean" },
      },
    });
    const account = f.w.document.querySelector(
      '[aria-label*="Google Account"]',
    );
    account.remove();
    await new Promise((r) => setTimeout(r, 350));
    f.w.document.body.append(account);
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(f.w.document.documentElement.dataset.cwTheme, "ocean");
    account.remove();
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(f.w.document.documentElement.dataset.cwTheme, "ocean");
  } finally {
    f.w.close();
  }
});
test("duplicate injection does not create a second appearance controller", async () => {
  const f = fixture();
  try {
    await settle();
    f.w.eval(bundle);
    assert.equal(f.w.document.querySelectorAll("#cw-host").length, 1);
    assert.equal(f.w.document.querySelectorAll("#cw-experience").length, 1);
  } finally {
    f.w.close();
  }
});
test("appearance survives Chat replacing root classes without removing native classes", async () => {
  const f = fixture();
  try {
    await settle();
    const root = f.w.document.documentElement;
    root.className = "google-shell-hydrated";
    root.removeAttribute("data-cw-theme");
    await settle();
    assert.ok(root.classList.contains("google-shell-hydrated"));
    assert.ok(root.classList.contains("cw-styled"));
    assert.ok(root.classList.contains("cw-compact"));
    assert.equal(root.dataset.cwTheme, "aubergine");
  } finally {
    f.w.close();
  }
});
