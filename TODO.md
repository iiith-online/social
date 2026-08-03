# IIIT social TODO

## High priority

- [ ] Redesign threads around a dedicated, reliable thread panel or route.
  - Open the correct root message every time, including from notifications and search.
  - Show reply counts, participants, unread replies, and clear loading/error states.
  - Keep thread pagination, E2EE decryption, composer mode, and back navigation consistent.
  - Handle rooms or servers where thread support is unavailable without broken UI.
- [ ] Add interaction tests for opening rooms, sending replies, jumping to a thread, and returning to the room timeline.
- [ ] Improve reconnect handling with a retry action, last-sync time, and a clear distinction between cached content and live content.
- [ ] Finish the dependency security upgrade plan, especially the remaining `tar`, React Router, and i18next advisories.

## Messaging and navigation

- [ ] Add message actions for edit, redact, copy, permalink, and “jump to latest” with consistent keyboard support.
- [ ] Make search support filters such as sender, room, date range, links, media, and mentions.
- [ ] Improve drafts so they persist per room and device without storing sensitive data in shared browser storage.
- [ ] Add a compact room-details panel with members, permissions, encryption state, and notification settings.
- [ ] Make unread markers and mention badges reliable across reloads, direct messages, and thread replies.

## PWA, accessibility, and polish

- [ ] Add offline-friendly shell behavior and a visible queued-message/retry state.
- [ ] Verify install/update flows across Chrome, Android, and iOS Safari.
- [ ] Audit keyboard navigation, focus restoration, reduced motion, contrast, and screen-reader labels.
- [ ] Add responsive improvements for narrow mobile headers, media previews, and long room names.
- [ ] Add automated smoke checks for login, recent rooms, community exploration, room navigation, and logout.

## Cleaner look

- [ ] Add a lot more toggles to make the interface cleaner and more compact. while being customisable but still very ready to use ootb for anyone.
