# IIIT Matrix — Reddit-ification Recommendations & Status

Constraint: everything implementable with **only the Matrix homeserver (Synapse)** — no extra backend, no custom database.

## Done (2026-08-04)

### 1. Feed pagination — caveat fixed
- Old: feed scanned only the newest 100 events per room, capped at 20 posts/room, 60 total — old (highly-interacted) posts silently vanished, defeating the Recommended formula `(1 + days) × interactions`.
- Now: paged walk of `/messages?dir=b` with `from` tokens, infinite scroll (IntersectionObserver sentinel), all posts kept client-side, deduped by `roomId:eventId`. Refresh (60s) re-fetches only the first page and merges.
- Ceiling: fine to a few thousand posts/room. If the community outgrows it, the next step needs a bot/backend — not before.

### 2. Post titles (first-line convention)
- First line of a message = post title (feed card + post page); rest = body. Works with all existing messages, zero new event types.
- Upgrade path: custom event type `io.iiith.post` with `title`/`body` if a dedicated title field is ever wanted.

### 3. Comment votes + sorting
- Upvote/downvote on comments (reactions, same as posts), score shown inline.
- Top / New sort chips above the comment list. Top = score desc, then oldest first.

### 4. In-app moderation — caveat fixed
- ⋯ menu on every post and comment: Copy Link (share), Pin/Unpin, Delete (redact, power-level gated), Report (native `report` API).
- Caveat remains: the report *review queue* is not in-app — it lives in Synapse's admin API (`/_synapse/admin/v1/event_reports`, admin token only). Mods review reported content + redact from the timeline.

### 5. Client-side search — caveat fixed
- Search box on the Home feed. E2EE rooms can't be indexed server-side, so search pages room history client-side (3 pages/room, 50-result cap), substring match on post title/body. Results render as normal post cards.

### 6. Karma + author profiles
- `/home/profile/:userId` — display name, karma (= Σ up−down over the user's posts found in community rooms), post list (clickable).
- Author names on feed cards and post pages link to the profile.

### 7. Pinned posts
- 📌 badge on pinned posts; Pin/Unpin in the ⋯ menu (`m.room.pinned_events`, power-level gated). Pinned posts sort to the top of every feed tab.

## Server-side items (need admin session, not code)

- [ ] **Space join rule is `knock`** — new users can't join outright, only request membership. Flip to `public`:
  `PUT /_matrix/client/v3/rooms/!y0BHB4cmD2DaPooiNn:matrix.iiit.ac.in/state/m.room.join_rules` with `{"join_rule": "public"}` (admin power in the space).
- [ ] **More subreddits** — the space subtree currently holds only `#general`. Add rooms (Interests, Mess, Language Club…) as `m.space.child` state events on the space; the feed picks them up automatically. Creating a room: `POST /_matrix/client/v3/createRoom` then link it with `PUT .../state/m.space.child/<roomId>`.
- [ ] **Report review** — monitor via Synapse admin API or admin console; not in-app.

## Deferred / known limits

- Feed auto-refresh re-enriches only the newest window; older loaded posts' vote counts refresh when reopened or re-voted.
- Comment counts for search results may miss inline replies outside the scanned window.
- No server-side search (E2EE); client-side only.
- Deleting a post does not cascade-delete its comments (Matrix semantics) — comments keep rendering as orphans; fine for now.
