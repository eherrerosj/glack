# Glack

Glack brings familiar Slack workflows to Google Chat, making it easier to drop a separate Slack subscription.
If your team already uses Google Workspace, the goal is simple: spend less on chat without giving up everyday conveniences.
This local Chrome extension adds:

- Thread broadcasting: post a thread reply to the main Space with a link back to its context.
- A Later queue: save messages, search them, mark them done, and return to reply.
- Message reminders: choose 20 minutes, one hour, tomorrow at 09:00, or a custom local time.
- Conversation collections: organize local shortcuts with drag and drop, ordering, and collapsible groups.
- Quick switching: use Cmd/Ctrl+K to find discovered DMs, group chats, and Spaces with fuzzy search.
- Themes and compact messages: choose eight palettes with independent Light, Dark, or System mode.
- Keyword radar: highlight phrases in loaded messages, with optional Chrome alerts for new matches.
- A code and log viewer: read messages with lexical highlighting, line numbers, copying, and line wrapping.
- Media controls: show images and previews by default, or collapse detected media when you want less clutter.

Glack works on standalone [Google Chat](https://chat.google.com) and its Chrome-installed desktop app. It does not support Gmail-embedded Chat or mobile clients.
It keeps data in your Chrome profile, separated by your detected Google email. Data does not sync to other profiles or mobile.

## Get started

Build the extension locally:

```sh
npm ci
npm run check
npm run build
npm test
```

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `dist/` folder.
5. Reload Google Chat.

Keep `dist/` in place while using Glack. Glack needs no Google OAuth setup.
After rebuilding, click Reload on Glack in `chrome://extensions`. Then reload your Google Chat tabs and desktop app.

## Use Glack

Open Later in the sidebar or through the floating button at the lower left.
Hover over a message, or focus it with the keyboard, to reveal Save and Remind.
Later includes search, Done/Undo, context links, and a Reply action that opens the native Chat workflow.
When the native reply control is unavailable, Glack opens the message and asks you to use Reply in thread.

Open Glack themes in the sidebar, or press Alt+Shift+T, to change appearance.
The Google Chat gear controls native settings such as notifications. Use Glack themes for Glack colors and display modes.
Choose Aubergine, Paper, Midnight, Ocean, Forest, Rose, Lavender, or Sunset. Google original restores Google's appearance.
Compact spacing is a separate setting. System mode follows your device automatically.
Theme and mode selections save before Chat refreshes.

In a Space thread, select Also post to Space before sending a plain-text reply.
Glack sends the reply first, waits for confirmation in the page, then sends a separate linked post to the Space.
Do not use broadcasting for attachments, rich text, or mention chips.

Collections support a keyboard-accessible Move menu and remember their collapsed state.
Google's native sidebar sections remain the recommended place to organize your main conversations.
Recent visits in the switcher persist per account.

Enter comma-separated phrases in Keyword radar to highlight matches. Enable Chrome alerts if you want notifications.
Use Code / logs on supported messages to open the viewer. It provides lexical highlighting without full language parsing.
Press Alt+Shift+M to toggle media collapsing. Each affected message gets a Show media button.
Detection excludes small images and emoji, but can miss preview cards.

The ••• tab explains behavior and provides JSON backup export/import. Imports merge into the detected account.
Export a backup before removing Glack if you want to keep saved items. Use Chrome's Remove button to uninstall it.

## Limits and privacy

- Reminders use local Chrome notifications rather than Google bot DMs. Chrome must be running; reminders cannot wake your computer.
- Glack checks overdue reminders when Chrome starts or resumes.
- Broadcasting creates two separate messages. It does not publish them as one atomic server operation.
- An existing draft in the main Space blocks broadcasting. Navigation or uncertain delivery stops it. Check Chat before retrying.
- Delivery checks rely on Google's private page metadata rather than official API receipts. Google UI changes can require adapter or selector updates.
- Glack preserves Google's interactions. It does not implement aggregate unread counts for sections or a separate inline reply composer.
- Glack uses no private APIs, network interception, CSP removal, analytics, or external storage.
- Appearance and productivity features add no Chrome permissions, remote services, or external scripts.

<details>
<summary>Validation and project history</summary>

See [validation notes](docs/validation.md) and the [Chat Plus review](docs/chat-plus-review.md).
Live broadcast tests used the private, owner-only Space [Workbench Lab &#8212; Cedar 4827](https://chat.google.com/room/AAQAhLYm8MM).
Both the Send button and Enter key worked. An occupied Space draft blocked sending while preserving both drafts.
All outgoing test messages stayed in that Space.

Version 0.2 introduced the appearance and productivity tools.
The original unpacked installation in Enrique's Chrome profile used ID `noilnpoahclgelmmlojbaeanmafkcgnf`.

</details>
