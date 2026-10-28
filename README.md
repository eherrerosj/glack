# Chat Workbench

Local Chrome extension for Google Chat. Installed unpacked in Enrique's Chrome profile as `noilnpoahclgelmmlojbaeanmafkcgnf`.

## Use

- Open Google Chat or its installed desktop app. Click **Later** in the sidebar or the floating lower-left button.
- Hover or keyboard-focus a message: **Save** bookmarks it; **Remind** offers 20 minutes, one hour, tomorrow at 09:00, or a custom local time.
- Later supports search, Done/Undo, context links and a Reply navigation action. For a message whose native reply control is unavailable, it opens the message and asks you to use Chat's Reply in thread action.
- Collections are local conversation shortcuts with drag-and-drop movement, a keyboard-accessible Move menu, ordering and persisted collapse state. Google's native sidebar sections remain available and are the recommended place for primary conversation organization.
- In a Space thread, select **Also post to Space** before sending a plain-text reply. It sends the reply first, waits for DOM confirmation, and then sends a separate linked root post. Do not use it for attachments, rich text or mention chips.
- The ••• tab explains behavior and provides JSON backup export/import. Imports merge into the currently detected account.

## Installation and updates

The installed folder is `dist/`. Do not move or delete this folder while using the extension.

```sh
npm ci
npm run check
npm run build
npm test
```

After rebuilding, open chrome://extensions, click Reload on Chat Workbench, then reload Google Chat tabs and its desktop app. No Google OAuth setup is required. To remove, use Chrome's Remove button; export a backup first if you want to keep saved items.

## Scope and limitations

- Standalone chat.google.com and its Chrome-installed desktop app. Gmail-embedded Chat and mobile clients are not supported in this build.
- Reminder notifications are local Chrome notifications, not Google bot DMs. They cannot wake a computer or run while Chrome is closed; overdue alarms reconcile on startup/resume.
- Local data persists in this Chrome profile, separated by detected Google email. It does not sync to mobile or other profiles.
- Broadcasts are two separate messages, not atomic server-side publication. Existing root drafts block sending. Navigation or uncertain delivery stops the operation. Check Chat before retrying.
- Exact delivery confirmation relies on Google's private DOM metadata, not an official API receipt. Google UI changes can require adapter updates.
- Native section unread aggregation and a separate inline reply composer are not implemented. Reply uses the native Chat workflow.
- No private APIs, network interception, CSP removal, analytics, or external storage.

## Validation

See docs/validation.md and docs/chat-plus-review.md. Live outbound broadcast testing requires a designated test Space; no colleague-facing test messages have been sent.
