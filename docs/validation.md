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

## 0.2 productivity additions

- 29 tests pass; strict TypeScript check and production build pass.
- Live PWA: Cmd+K fuzzy query `ced4827` finds the private Space; themes and radar preferences survive reloads; code sample sent in the private Space, confirmed delivered, viewer opened and Copy changed to Copied.
- Screenshot review found and fixed sidebar clipping, native bubble alignment, dark-theme token specificity, hard-coded white header/composer surfaces, and DM discovery (individual DMs expose data-group-id on their list item).
- Temporary keyword `Workbench test` and alert opt-in were removed after testing. Labelled private code sample remains available for user testing.
- Notification dedupe, account isolation, media exclusion/reveal, and malicious code text rendering have automated fixture coverage. OS notification display and real attachment collapse were not independently visually verified in this pass.

## 0.2.1 visual polish

Reviewed the installed PWA at its actual window size in Aubergine, Paper, Midnight, Ocean and Google original. Reviewed both outgoing private-test messages and received messages in general, without sending messages there. Tested draft entry and cleared the labelled test draft without sending it.

Fixed:
- Reused Google layout classes were applying sidebar margins/backgrounds to the main pane, creating an extra gutter and coloured corner.
- Section sizing overrides were expanding every sidebar section, pushing Spaces out of view; only the injected shortcuts section now expands, including in Google original mode.
- Added consistent SVG rail/sidebar icons, visible sender headers, initials and timestamps; fixed sender lookup choosing empty incoming-avatar chips and removed the leftover avatar indent.
- Unified normal, focused and lazy-thread composers; removed nested borders, native pill backgrounds and the phantom rounded-corner outline. Scope is restricted to the nearest composer, with a regression test preventing whole-conversation styling.
- Fixed New chat overlap with the rail, selected-conversation contrast, search gradient, dark-mode colours, received-message text alignment and sidebar section backgrounds.
- Resized preferences dialog so its footer remains visible, compacted theme selection, constrained switcher scrolling, and restyled Later/reminders/collections with shared theme colours and clearer titles.

Validation: 32 tests, strict TypeScript, build and whitespace checks pass. Latest unpacked version is 0.2.1. Aubergine is left active. No new permissions or dependencies.

## 0.2.2 screenshot-targeted corrections

The user screenshot exposed duplicate broadcast headings, large whitespace, a native curved reply connector, raw thread URLs, placeholder initials and a white-on-white status control.

- Recognised Workbench broadcast messages now have one compact context quote, the reply text and a labelled View thread link. The original Google message body remains in the DOM, unchanged, for saving, broadcasting confirmation and native-theme fallback. Rendering uses text nodes and validated Chat URLs; edited/non-matching messages revert to the original view.
- Removed the empty native reply connector, retained the clickable reply count, tightened topic spacing and corrected status-control contrast.
- Used existing native profile images where available, with initials as fallback. Avatar images are excluded from media collapse.
- Shifted native hover actions to the right so they do not cover the author header.

Validation: 34 automated tests pass, including broadcast parsing, malicious-text rendering, source-text preservation and edited-message cleanup. Type check/build pass. Live PWA verified the exact parent/broadcast area, working short link opening the correct thread drawer, profile photos, status icons and hover-action placement. No messages were sent or edited during this pass.
