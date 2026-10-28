# Using Glack

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

See [validation notes](validation.md) and the [Chat Plus review](chat-plus-review.md).
Live broadcast tests used the private, owner-only Space [Workbench Lab &#8212; Cedar 4827](https://chat.google.com/room/AAQAhLYm8MM).
Both the Send button and Enter key worked. An occupied Space draft blocked sending while preserving both drafts.
All outgoing test messages stayed in that Space.

Version 0.2 introduced the appearance and productivity tools.
The original unpacked installation in Enrique's Chrome profile used ID `noilnpoahclgelmmlojbaeanmafkcgnf`.

</details>
