import type { Item } from "./core";
export const rows = "[data-message-multiplat-item-id][data-id]";
export const editorSelector = '[contenteditable="true"][role="textbox"]';
export function account(doc: Document = document): string | null {
  for (const e of doc.querySelectorAll(
    '[aria-label*="Google Account"],[aria-label*="Cuenta de Google"],[aria-label*="Compte Google"]',
  )) {
    const match = e
      .getAttribute("aria-label")
      ?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match) return match[0].toLowerCase();
  }
  return null;
}
export function message(
  row: HTMLElement,
  doc: Document = document,
): Item | null {
  const topic = row.closest<HTMLElement>("[data-local-topic-id]");
  const group = topic?.getAttribute("data-p")?.match(/"(space|dm)\/([^"\s]+)"/);
  const id = row.dataset.id;
  const tid = topic?.dataset.localTopicId;
  if (!group || !id || !tid) return null;
  const text =
    row.querySelector<HTMLElement>('[jsname="bgckF"]')?.innerText ??
    row.querySelector('[jsname="bgckF"]')?.textContent ??
    "";
  const sender =
    row.querySelector('h3,[role="heading"][aria-level="3"]')?.textContent ??
    row.querySelector("[data-name]")?.getAttribute("data-name") ??
    "Message";
  const a = account(doc);
  return {
    id: `${group[2]}/${tid}/${id}`,
    text: text.trim() || "[Attachment or media]",
    sender,
    space: doc.title.replace(/ - Chat$/, ""),
    url: `https://chat.google.com/${group[1] === "space" ? "room" : "dm"}/${group[2]}/${tid}/${id}${a ? `?authuser=${encodeURIComponent(a)}` : ""}`,
    savedAt: Date.now(),
  };
}
export function composer(editor: HTMLElement) {
  return editor.closest<HTMLElement>("c-wiz[data-group-id]");
}
export function rootEditor(group: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>(editorSelector)].find((e) => {
      const c = composer(e);
      return (
        c?.dataset.groupId === group &&
        c.dataset.isDetailedThreadView === "false" &&
        c.dataset.isRoomComposePostbar === "true"
      );
    }) ?? null
  );
}
export function sendButton(editor: HTMLElement): HTMLElement | null {
  return (
    composer(editor)?.querySelector<HTMLElement>(
      'button[aria-label="Send message"],button[jsname="GBTyxb"]',
    ) ?? null
  );
}
export function textOf(e: HTMLElement) {
  return (e.innerText ?? e.textContent ?? "").trim();
}
export function putDraft(editor: HTMLElement, text: string) {
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
  if (!document.execCommand("insertText", false, text))
    throw Error(
      "Chat did not accept the draft. Your message has not been sent.",
    );
  editor.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }),
  );
}
export function waitFor<T>(
  read: () => T | null | false,
  timeout = 12000,
): Promise<T> {
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
            "Delivery could not be confirmed. Check Chat before trying again.",
          ),
        );
        return;
      }
      setTimeout(tick, 180);
    };
    tick();
  });
}
