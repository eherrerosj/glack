# Chat Plus review — 28 October 2026

Inspected Chrome Web Store package `njkkenehdklkfdkmonkagaicllmnfcda`, version **11.14.0**, downloaded from Google's extension update service. This is a static review of relevant modules, not a complete security audit or a claim that every advertised feature works.

## Verdict

Useful as evidence of feasible integration techniques, but not an architecture to reproduce wholesale. Its readable modules made REA unnecessary. No Chat Plus source or assets are included in our extension build.

## Findings

- `manifest.json`: MV3 content scripts on Chat and all Gmail pages, all frames; React-based feature panels are split into modules and extension pages.
- `smartPreview.js`, message-details extraction: obtains thread IDs from `data-local-topic-id` and conversation identifiers from `data-p`. We independently confirmed these attributes in the user's current Google Chat DOM. Exact replies additionally expose `data-id` and `data-message-multiplat-item-id`; our links use the reply ID, not just the parent ID.
- `mainContent.js`, composer event handling: edits the native contenteditable composer and attaches keyboard/send controls. This supports feasibility, not an assurance of delivery. Our broadcasts add reply confirmation, draft checks, context checks and no automatic retries.
- `rules.json`: removes both Content-Security-Policy and Content-Security-Policy-Report-Only response headers on Google Chat and Gmail main/subframes. Our extension does not request declarativeNetRequest and leaves these protections intact.
- `mainContent.js`, addReminder: posts message content, author details, link, space and time to its `/api/reminders/create` backend. Our reminder content remains in account-scoped chrome.storage.local and scheduling uses chrome.alarms.
- `background.js`: several operations route through the active tab. Our writes are centralized and serialized in the worker, and content-script state is separated by account.
- Broad web-accessible resources, clipboardRead and unlimitedStorage permissions are present. These may support its broader feature set; none are required for our scope.

## What we adopted

The browser integration strategy and the existence of useful DOM metadata. We wrote an independent, small extension with scoped styles, local storage and no runtime dependencies or external backend.

## Limits of the comparison

Chat Plus was not installed, authenticated or exercised against live messages. No conclusion is made about its subscription functionality, backend security, or general product reliability. Private DOM attributes remain subject to Google changes in both products.
