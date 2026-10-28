<p align="center">
  <img src="assets/glack.svg" width="88" height="88" alt="Glack logo">
</p>
<h1 align="center">Glack</h1>
<p align="center"><strong>Keep Google Chat. Bring the Slack habits.</strong></p>
<p align="center">Thread broadcasts, reminders, saved messages, and a workspace that feels like yours.</p>
<p align="center">
  <a href="#features">Features</a> ·
  <a href="#install">Install</a> ·
  <a href="docs/usage.md">User guide</a> ·
  <a href="#contributing">Contributing</a>
</p>

If your team already uses Google Workspace, a separate Slack subscription can be a hard sell.
Glack adds familiar Slack workflows to Google Chat, so staying with Chat means giving up fewer everyday conveniences.

## Features

- Broadcast thread replies to the main Space, with a link back to the conversation.
- Save messages to Later, search your queue, mark items done, and return to reply.
- Set message reminders for 20 minutes, one hour, tomorrow at 09:00, or a custom time.
- Group conversation shortcuts into collapsible collections with drag and drop.
- Jump between DMs, group chats, and Spaces with fuzzy search and Cmd/Ctrl+K.
- Choose eight color palettes, Light/Dark/System mode, and compact message spacing.
- Highlight keywords and get optional Chrome alerts for new matches in loaded messages.
- Read code and logs with highlighting, line numbers, copying, and line wrapping.
- Keep images and previews visible, or collapse detected media when you need less clutter.

## Install

Glack currently installs from source as an unpacked Chrome extension.
You need Git, Node.js, and npm.

```sh
git clone https://github.com/eherrerosj/glack.git
cd glack
npm ci
npm run check
npm run build
npm test
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository's `dist/` folder.
5. Reload [Google Chat](https://chat.google.com).

Keep `dist/` in place while using Glack. Glack needs no Google OAuth setup.

Works in standalone Google Chat and its Chrome-installed desktop app.
Gmail-embedded Chat and mobile clients are not supported.

<details>
<summary>Updating or removing Glack</summary>

After pulling changes, run the build commands again.
Click Reload on Glack in `chrome://extensions`, then reload your Chat tabs and desktop app.

Before uninstalling, export a JSON backup from Glack's ••• tab to keep your saved items.
Use Chrome's Remove button to uninstall. Backup imports merge into the detected account.

</details>

## Quick start

| What you want to do | Where to go |
| --- | --- |
| Save a message or set a reminder | Hover over a message, then choose Save or Remind. |
| Review saved messages | Open Later in the sidebar. |
| Switch conversations | Press <kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd>. |
| Change Glack's appearance | Open Glack themes, or press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd>. |
| Toggle media collapsing | Press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd>. |
| Broadcast a thread reply | Select Also post to Space before sending a plain-text reply. |

Use **Glack themes** for colors and display modes. The Google Chat gear still controls Google's settings.
Theme and mode selections save before Chat refreshes.

See the [user guide](docs/usage.md) for all controls, backup options, and feature limits.

## Privacy and limits

Your data stays in your Chrome profile, separated by your detected Google email.
It does not sync across profiles or to mobile.
Glack uses no analytics, external storage, private APIs, or network interception.

Reminders use local Chrome notifications rather than bot DMs. Chrome must be running.
Broadcasting sends two separate messages and supports plain text only.
Google Chat UI changes can require extension updates.
Read the [full limitations](docs/usage.md#limits-and-privacy) before relying on these workflows.

## Contributing

Found a bug? [Open an issue](https://github.com/eherrerosj/glack/issues) with reproduction steps, your Chrome version, and your Glack theme and display mode.
Use screenshots with private messages removed.

For code changes, run `npm run check`, `npm run build`, and `npm test` before opening a pull request.
For interface changes, also check the affected screens in Google Chat.
The [validation notes](docs/validation.md) describe previous checks.

Curious about the implementation? Read the [Chat Plus review](docs/chat-plus-review.md) and [user guide](docs/usage.md).
