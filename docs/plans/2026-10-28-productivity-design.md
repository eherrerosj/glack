# Workbench 0.2: Slack-inspired appearance and productivity

User authorised all five additions, with a close Slack-inspired visual design and theme selection.

- Account-scoped preferences and up to 80 recent conversations in extension-local storage. Existing saved items and reminders are preserved.
- Cmd/Ctrl+K opens an accessible fuzzy switcher over discovered sidebar DMs, groups and Spaces, plus previously visited conversations. Arrow keys, Enter and Escape supported. Native routes retain authuser.
- Appearance uses reversible document-scoped CSS and locally bundled UI: Aubergine, Paper, Midnight, Ocean, and Google original. Adds a workspace rail, flattened messages, compact spacing and themed navigation. Google retains message delivery and its layout structure. This is a Slack-inspired skin, not a replacement Slack client or a pixel-identical implementation.
- Keyword radar highlights rendered messages using literal case-insensitive phrases. Optional Chrome notifications are sent only for newly observed messages newer than the current conversation's observation baseline. Session storage deduplicates across tabs. No historical crawl, backend or closed-tab monitoring.
- Code viewer renders text nodes, never HTML. Lightweight lexical highlighting for common code/log tokens, plain-text mode, line numbers, wrapping and copy. Native pre/code blocks and heuristic multiline logs/fenced messages are supported; not a full language parser.
- Media collapse hides detected images/video/iframe/attachment elements, excluding small images and emoji/avatar markers. Per-message reveal and global Alt+Shift+M. Unrecognised Google preview containers can remain visible.

Validation: strict TypeScript, 29 automated tests (including existing broadcast regression tests). Live Chrome checks: switcher fuzzy matching, theme persistence, native layout, radar highlights, labelled code message in private Workbench Lab, viewer and clipboard copying. Media reveal and alert deduplication validated with DOM/background fixtures. No new permissions or production dependencies.
