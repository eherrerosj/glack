# Chat Workbench implementation plan

Build a local-first MV3 Chrome extension, inspect Chat Plus before choosing integration details, install into the existing Chrome profile, and validate in standalone Chat and its installed desktop app.

## Decisions

- Use DOM integration with stable data attributes observed in the live app. No private network APIs, auth-token extraction, backend or CSP changes.
- Use native Google Chat sidebar sections for primary organization; provide additional local shortcut collections without moving native conversations.
- Save message snapshots and exact links in account-scoped local extension storage. All mutations pass through a serialized service worker.
- Use Chrome alarms/notifications and an in-app reminder queue, with startup recovery.
- Broadcast plain-text replies as two sequential messages: original thread reply, then root message with parent excerpt and thread link. Never silently retry ambiguous sends.
- Keep injected controls scoped; use a shadow root for the panel.

## Milestones

1. Live DOM and Chat Plus inspection: complete; findings in ../chat-plus-review.md.
2. Extension build and local fixtures: complete.
3. Later/reminders/storage validation: complete for documented tests.
4. Native section compatibility and local collections: implemented; no aggregate unread enhancement.
5. Load into Chrome and desktop app: complete.
6. Live outbound broadcast validation: complete in a private owner-only test Space, including keyboard send and occupied-draft recovery.
7. Independent inline reply composer, mobile sync and native bot reminders: beyond the local build; native reply navigation/local notifications substitute as disclosed in README.

The installed build is a usable local preview, not a claim of complete RFC parity. Broadcasting has been verified live within its documented plain-text scope.
