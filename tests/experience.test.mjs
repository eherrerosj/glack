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
