import { test } from "node:test";
import assert from "node:assert/strict";
import { fuzzyScore, preferences, keywordMatches } from "../src/preferences.ts";
test("switcher matches subsequences and prioritizes exact names", () => {
  assert.ok(
    fuzzyScore("general", "general") >
      fuzzyScore("general projects", "general"),
  );
  assert.ok(fuzzyScore("Project Alpha", "pja") > 0);
  assert.equal(fuzzyScore("general", "xyz"), 0);
});
test("preferences constrain untrusted values and default to Slack styling", () => {
  assert.equal(preferences({ theme: "bad" }).theme, "aubergine");
  assert.deepEqual(
    preferences({ keywords: ["  Incident  ", "incident", "", 42] }).keywords,
    ["Incident"],
  );
  assert.equal(preferences({ compact: false }).compact, false);
});
test("radar treats punctuation literally and matches case-insensitively", () => {
  assert.deepEqual(keywordMatches("C++ service DOWN", ["c++", "down", "x.*"]), [
    "c++",
    "down",
  ]);
});
test("mode migration preserves old dark choices and validates all new palettes", async () => {
  const { resolvedMode, palettes } = await import("../src/preferences.ts");
  assert.equal(preferences({ theme: "dark" }).mode, "dark");
  assert.equal(preferences({ theme: "dark", mode: "light" }).mode, "light");
  for (const theme of Object.keys(palettes))
    assert.equal(preferences({ theme }).theme, theme);
  assert.equal(resolvedMode("system", true), "dark");
  assert.equal(resolvedMode("system", false), "light");
  assert.equal(resolvedMode("light", true), "light");
  assert.equal(resolvedMode("dark", false), "dark");
});
test("every palette supports readable white selected-navigation labels", async () => {
  const { palettes } = await import("../src/preferences.ts");
  function luminance(hex) {
    const c = hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  }
  for (const [name, colors] of Object.entries(palettes))
    assert.ok(1.05 / (luminance(colors[2]) + 0.05) >= 4.5, name);
});
