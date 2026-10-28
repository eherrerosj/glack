# Validation — 28 October 2026

## Automated

17 tests pass: reminder date arithmetic, URL validation, deduplicating saves, exact reply links, missing metadata, concurrent storage writes, account isolation, alarm creation, duplicate notification suppression, completing reminders, preserving reminder schedules, invalid-time rejection, two-stage broadcast fixture, occupied-draft preservation, unconfirmed-reply suppression and backup validation. TypeScript strict checking passes.

The DOM tests use synthetic fixtures informed by a read-only inspection of the current live Chat DOM. They are not evidence of successful live message sending.

## Live Chrome checks

- Loaded unpacked in the existing Chrome profile; extension enabled and toolbar action present.
- Later entry and per-message Save/Remind actions appear in standalone Chat.
- Saved an existing message locally; sender, text and conversation were rendered correctly.
- Context action navigated to the exact selected message.
- Scheduled a near-term custom reminder. Worker inspection confirmed notifications permission `granted`, one notification registered, and the item marked `notified: true`.
- Reloaded extension and opened Google Chat desktop app; saved item and due status persisted.
- No Chat Plus install, no outgoing Chat messages, no changes to native sections.

## Remaining live checks

Thread broadcast success and second-send failure require an authorized test Space. Rich-format/attachment broadcasting is intentionally rejected. Reply navigation cannot always open an unstarted thread automatically. Notification banners may also depend on macOS Focus settings even when Chrome reports delivery.
