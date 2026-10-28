export interface Item {
  id: string;
  text: string;
  savedAt: number;
  sender?: string;
  space?: string;
  url?: string;
  done?: boolean;
  due?: number;
  notified?: boolean;
}
export interface Section {
  id: string;
  name: string;
  collapsed: boolean;
  links: { name: string; url: string }[];
}
export interface State {
  version: 1;
  items: Item[];
  sections: Section[];
}
export const emptyState = (): State => ({
  version: 1,
  items: [],
  sections: [],
});
export function reminderTime(preset: string, now = Date.now()): number {
  if (preset === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  return now + (preset === "20m" ? 20 : 60) * 60000;
}
export function safeLink(link: string): boolean {
  try {
    const u = new URL(link);
    return (
      u.protocol === "https:" &&
      u.hostname === "chat.google.com" &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
export function upsert<T extends { id: string; savedAt: number }>(
  items: T[],
  item: T,
): T[] {
  const old = items.find((x) => x.id === item.id);
  return [
    ...items.filter((x) => x.id !== item.id),
    { ...old, ...item, savedAt: old?.savedAt ?? item.savedAt },
  ];
}
export function broadcastText(text: string, parent: string, url: string) {
  return `↪ Replied to thread: ${parent.replace(/\s+/g, " ").slice(0, 180)}\n\n${text}\n\nView thread: ${url}`;
}
export function canBroadcast(s: {
  sameContext: boolean;
  rootEmpty: boolean;
  replyConfirmed: boolean;
  richContent: boolean;
}) {
  return s.sameContext && s.rootEmpty && s.replyConfirmed && !s.richContent;
}
export function validateBackup(value: unknown): State {
  const s = value as State;
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.items) ||
    !Array.isArray(s.sections) ||
    s.items.length > 10000 ||
    s.sections.length > 50
  )
    throw Error("This is not a supported Workbench backup");
  for (const i of s.items)
    if (
      !i ||
      typeof i.id !== "string" ||
      i.id.length > 300 ||
      typeof i.text !== "string" ||
      i.text.length > 30000 ||
      !Number.isFinite(i.savedAt) ||
      !safeLink(i.url ?? "") ||
      (i.due !== undefined && !Number.isFinite(i.due))
    )
      throw Error("Backup contains an invalid saved message");
  for (const c of s.sections)
    if (
      !c ||
      typeof c.id !== "string" ||
      typeof c.name !== "string" ||
      c.name.length > 80 ||
      !Array.isArray(c.links) ||
      c.links.some((l) => typeof l.name !== "string" || !safeLink(l.url))
    )
      throw Error("Backup contains an invalid collection");
  return structuredClone(s);
}
export function sameText(a: string, b: string) {
  return a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
}
