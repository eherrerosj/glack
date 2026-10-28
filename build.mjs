import { build } from "esbuild";
import { writeFile, copyFile, mkdir } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await copyFile("src/icon.png", "dist/icon.png");
await build({
  entryPoints: ["src/content.ts", "src/background.ts"],
  outdir: "dist",
  bundle: true,
  target: "chrome120",
  format: "iife",
  sourcemap: true,
  loader: { ".css": "text" },
});
await copyFile("src/outer.css", "dist/style.css");
await writeFile(
  "dist/manifest.json",
  JSON.stringify(
    {
      manifest_version: 3,
      name: "Chat Workbench",
      version: "0.2.0",
      description:
        "A quieter Google Chat: Later, local reminders, collections and thread broadcasts.",
      permissions: ["storage", "alarms", "notifications"],
      host_permissions: ["https://chat.google.com/*"],
      background: { service_worker: "background.js" },
      action: { default_title: "Open Chat Workbench" },
      icons: { 128: "icon.png" },
      content_scripts: [
        {
          matches: ["https://chat.google.com/*"],
          js: ["content.js"],
          css: ["style.css"],
          run_at: "document_idle",
        },
      ],
    },
    null,
    2,
  ),
);
