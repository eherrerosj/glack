# Validation — 28 October 2026

## Automated

21 tests pass: reminder date arithmetic, URL validation, deduplicating saves, exact reply links, missing metadata, concurrent storage writes, account isolation, alarm creation, duplicate notification suppression, completing reminders, preserving reminder schedules, invalid-time rejection, two-stage broadcast fixture, occupied-draft preservation, unconfirmed-reply suppression and backup validation. TypeScript strict checking passes.

The DOM tests use synthetic fixtures informed by a read-only inspection of the current live Chat DOM. They are not evidence of successful live message sending.

## Live Chrome checks

- Loaded unpacked in the existing Chrome profile; extension enabled and toolbar action present.
- Later entry and per-message Save/Remind actions appear in standalone Chat.
- Saved an existing message locally; sender, text and conversation were rendered correctly.
- Context action navigated to the exact selected message.
- Scheduled a near-term custom reminder. Worker inspection confirmed notifications permission `granted`, one notification registered, and the item marked `notified: true`.
- Reloaded extension and opened Google Chat desktop app; saved item and due status persisted.
- No Chat Plus install and no changes to native sections. Subsequent outgoing tests were confined to a newly created private Space with exactly one member (Enrique).

## Remaining live checks

Live broadcast tests are now complete for send-button, Enter-key and occupied-draft recovery paths. Rich-format/attachment broadcasting is intentionally rejected. Reply navigation cannot always open an unstarted thread automatically. Notification banners may also depend on macOS Focus settings even when Chrome reports delivery.


## Live broadcast acceptance

Space: Workbench Lab — Cedar 4827 (`AAQAhLYm8MM`), private, one member verified in Manage members. Parent thread: `l8OzL92dxxk`.

- Initial click probe found Chrome suppresses nested .click() until the originating task ends; fixed by yielding a full task.
- Chat collapses blank lines and converts the arrow emoji to an image; text comparison and extraction now account for both.
- A newly sent root topic can retain data-is-local-only=true after delivery. Confirmation now checks the message timestamp and excludes Sending/Retry/Failed status, rather than trusting the topic-cache flag.
- Broadcast C/D/E and the draft-guard recovery reply appeared in both the thread and root timeline; earlier copies persisted across reloads.
- Enter-key broadcasting worked for Broadcast E. Final send-button recovery posted both messages and returned focus to the reply editor.
- With a nonempty root draft, no message was sent; both root and reply drafts remained intact. Clearing only the test root draft allowed the preserved reply to broadcast normally.
- Early integration failures left the original reply or root draft intact and did not retry automatically.

This remains DOM-level confirmation, not an official API receipt. Google UI changes can require adapter updates.
