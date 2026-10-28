export interface Preferences {
  theme: "aubergine" | "light" | "dark" | "ocean" | "native";
  compact: boolean;
  collapseMedia: boolean;
  code: boolean;
  keywords: string[];
  alerts: boolean;
}
export function preferences(raw: any = {}): Preferences {
  return {
    theme: ["aubergine", "light", "dark", "ocean", "native"].includes(
      raw?.theme,
    )
      ? raw.theme
      : "aubergine",
    compact: typeof raw?.compact === "boolean" ? raw.compact : true,
    collapseMedia: raw?.collapseMedia === true,
    code: raw?.code !== false,
    keywords: (Array.isArray(raw?.keywords) ? raw.keywords : [])
      .filter((x: unknown): x is string => typeof x === "string")
      .map((x: string) => x.trim().slice(0, 80))
      .filter(
        (x: string, i: number, all: string[]) =>
          x && all.findIndex((v) => v.toLowerCase() === x.toLowerCase()) === i,
      )
      .slice(0, 30),
    alerts: raw?.alerts === true,
  };
}
export function keywordMatches(text: string, keywords: string[]) {
  return keywords.filter((k) =>
    text.toLocaleLowerCase().includes(k.toLocaleLowerCase()),
  );
}
export function fuzzyScore(name: string, query: string) {
  const n = name.toLowerCase(),
    q = query.trim().toLowerCase();
  if (!q) return 1;
  if (n === q) return 10000;
  if (n.includes(q)) return 5000 - n.indexOf(q) * 10 - n.length;
  let at = -1,
    score = 1000;
  for (const c of q) {
    const next = n.indexOf(c, at + 1);
    if (next < 0) return 0;
    score -= next - at;
    at = next;
  }
  return Math.max(1, score - n.length);
}
