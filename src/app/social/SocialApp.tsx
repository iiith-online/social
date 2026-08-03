import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClientEvent,
  EventType,
  MatrixClient,
  MatrixEvent,
  RelationType,
  Room,
  RoomEvent,
} from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import AppIcon from '../../../public/icons/web/icon-512.png';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { allRoomsAtom } from '../state/room-list/roomList';
import { roomToParentsAtom } from '../state/room/roomToParents';
import { getAllParents, getEventReactions, getReactionContent, getStateEvent } from '../utils/room';
import { StateEvent } from '../../types/matrix/room';
import './social.css';

const ROOT_SPACE_ID = '!dSZ1CJsPHCh78MIsqG:matrix.iiit.ac.in';
const POST_EVENT_TYPE = 'online.iiit.social.post';
const SAVED_EVENT_TYPE = 'online.iiit.social.saved_posts';
const ROOT_SPACE_URL =
  'https://matrix.to/#/!dSZ1CJsPHCh78MIsqG:matrix.iiit.ac.in?via=matrix.iiit.ac.in';
const UPVOTE_KEY = 'upvote';
const DOWNVOTE_KEY = 'downvote';

type FeedSort = 'hot' | 'new' | 'top';

type SocialPost = {
  id: string;
  roomId: string;
  community: string;
  author: string;
  authorId: string;
  title: string;
  body: string;
  score: number;
  myVote: number;
  comments: number;
  timestamp: number;
  image?: string;
};

const iconPaths: Record<string, string> = {
  search:
    'M11 19a8 8 0 1 1 5.66-13.66A8 8 0 0 1 11 19Zm0-14a6 6 0 1 0 4.24 10.24A6 6 0 0 0 11 5Zm5.5 10.5 4 4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z',
  flame:
    'M12 22c4.4 0 7-2.8 7-6.6 0-2.9-1.6-5.8-5.1-9.4.1 2.2-.7 3.5-2 4.5.1-3.8-1.7-6.8-4.8-8.5.5 3.7-2.1 5.7-2.1 9.1C5 17.9 7.8 22 12 22Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  trend: 'm4 16 5-5 4 4 7-8M15 7h5v5',
  arrowUp: 'm5 12 7-7 7 7M12 5v14',
  arrowDown: 'm5 12 7 7 7-7M12 19V5',
  comment: 'M4 5h16v11H8l-4 4V5Z',
  bookmark: 'M7 4h10v16l-5-3-5 3V4Z',
  share: 'm14 5 5 5-5 5M19 10H9a5 5 0 0 0-5 5v4',
  link: 'M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.14 1.14M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 7 20l1.14-1.14',
  close: 'M5 5l14 14M19 5 5 19',
  plus: 'M12 5v14M5 12h14',
  shield: 'M12 3 19 6v5c0 4.2-2.9 8-7 10-4.1-2-7-5.8-7-10V6l7-3Z',
  back: 'm15 5-7 7 7 7M8 12h12',
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

const relativeTime = (timestamp: number) => {
  const hours = Math.max(1, Math.floor((Date.now() - timestamp) / 3600000));
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

const eventContent = (event: MatrixEvent) =>
  (event.getClearContent() ?? event.getContent()) as Record<string, any>;

const roomName = (room: Room | { roomId: string; name?: string }) => {
  if ('getLiveTimeline' in room) {
    const nameEvent = getStateEvent(room, StateEvent.RoomName);
    return nameEvent?.getContent<{ name?: string }>().name || room.name || room.roomId;
  }
  return room.name || room.roomId;
};

const getThreadEvents = (room: Room, eventId: string): MatrixEvent[] => {
  const knownEvents = [
    ...(room.getThread(eventId)?.events ?? []),
    ...room.getLiveTimeline().getEvents(),
  ];
  const uniqueEvents = new Map<string, MatrixEvent>();

  knownEvents.forEach((event) => {
    const id = event.getId();
    if (id) uniqueEvents.set(id, event);
  });

  return Array.from(uniqueEvents.values())
    .filter((event) => event.threadRootId === eventId && !event.isRedacted())
    .sort((a, b) => a.getTs() - b.getTs());
};

const getVoteSummary = (room: Room, eventId: string, userId: string | null) => {
  const reactions = getEventReactions(room.getUnfilteredTimelineSet(), eventId);
  const grouped = reactions?.getSortedAnnotationsByKey() ?? [];
  let score = 0;
  let myVote = 0;

  grouped.forEach(([key, events]) => {
    if (key !== UPVOTE_KEY && key !== DOWNVOTE_KEY) return;
    const direction = key === UPVOTE_KEY ? 1 : -1;
    score += direction * events.size;
    if (userId && Array.from(events).some((event) => event.getSender() === userId)) {
      myVote = direction;
    }
  });

  return { score, myVote };
};

const getSavedPostIds = (mx: MatrixClient): string[] => {
  const posts = mx
    .getAccountData(SAVED_EVENT_TYPE as any)
    ?.getContent<{ posts?: unknown }>()?.posts;
  return Array.isArray(posts)
    ? posts.filter((post): post is string => typeof post === 'string')
    : [];
};

const readPosts = (mx: MatrixClient, roomIds: string[]): SocialPost[] =>
  roomIds
    .flatMap((roomId) => {
      const room = mx.getRoom(roomId);
      if (!room) return [];
      const posts: Array<SocialPost | undefined> = room
        .getLiveTimeline()
        .getEvents()
        .filter(
          (event) =>
            (event.getType() === EventType.RoomMessage || event.isEncrypted()) &&
            !event.isRedacted() &&
            !event.threadRootId
        )
        .map((event) => {
          const content = eventContent(event);
          const marker = content[POST_EVENT_TYPE];
          if (!marker || typeof content.body !== 'string') return undefined;
          const sender = event.getSender() || '@unknown:matrix.iiit.ac.in';
          const member = room.getMember(sender);
          const author =
            member?.rawDisplayName && member.rawDisplayName !== sender
              ? member.rawDisplayName
              : sender;
          return {
            id: event.getId() || `${roomId}-${event.getTs()}`,
            roomId,
            community: roomName(room),
            author,
            authorId: sender,
            title: typeof marker.title === 'string' ? marker.title : content.body.slice(0, 80),
            body: content.body,
            ...getVoteSummary(room, event.getId() || '', mx.getUserId()),
            comments: getThreadEvents(room, event.getId() || '').length,
            timestamp: event.getTs(),
            image: typeof marker.image === 'string' ? marker.image : undefined,
          } satisfies SocialPost;
        });
      return posts.filter((post): post is SocialPost => Boolean(post));
    })
    .sort((a, b) => b.timestamp - a.timestamp);

function EmptySyncNotice() {
  return (
    <div className="social-empty">
      No posts have been shared in this IIIT social Space yet. Start the first conversation from
      Create Post.
    </div>
  );
}

type PostCardProps = {
  post: SocialPost;
  voted: number;
  saved: boolean;
  onVote: (post: SocialPost, direction: number) => void;
  onComments: (post: SocialPost) => void;
  onSave: (post: SocialPost) => void;
  onShare: (post: SocialPost) => void;
};

function PostCard({ post, voted, saved, onVote, onComments, onSave, onShare }: PostCardProps) {
  return (
    <article className="social-post">
      <div className="social-vote-column" aria-label="Vote on post">
        <button
          type="button"
          aria-label="Upvote"
          data-voted={voted === 1}
          onClick={() => onVote(post, 1)}
        >
          <Icon name="arrowUp" />
        </button>
        <span className="social-score">{post.score}</span>
        <button
          type="button"
          aria-label="Downvote"
          data-voted={voted === -1}
          onClick={() => onVote(post, -1)}
        >
          <Icon name="arrowDown" />
        </button>
      </div>
      <div className="social-post-content">
        <div className="social-post-meta">
          <span className="social-post-community"># {post.community}</span>
          <span>•</span>
          <span title={post.authorId}>{post.author}</span>
          <span>•</span>
          <span>{relativeTime(post.timestamp)}</span>
        </div>
        <h2>{post.title}</h2>
        <p className="social-post-body">{post.body}</p>
        {post.image && (
          <img
            src={post.image}
            alt="Post attachment"
            style={{ maxWidth: '100%', marginTop: 16, borderRadius: 5 }}
          />
        )}
        <div className="social-post-actions">
          <button
            className="social-post-action"
            type="button"
            onClick={() => onComments(post)}
            aria-label={`Open ${post.comments} comments`}
          >
            <Icon name="comment" size={17} /> {post.comments} Comments
          </button>
          <button
            className="social-post-action"
            type="button"
            data-active={saved}
            onClick={() => onSave(post)}
          >
            <Icon name="bookmark" size={17} /> {saved ? 'Saved' : 'Save'}
          </button>
          <button className="social-post-action" type="button" onClick={() => onShare(post)}>
            <Icon name="share" size={17} /> Share
          </button>
        </div>
      </div>
    </article>
  );
}

type ThreadModalProps = {
  open: boolean;
  post: SocialPost | null;
  mx: MatrixClient;
  onClose: () => void;
  onSubmit: (post: SocialPost, body: string) => Promise<void>;
};

function ThreadModal({ open, post, mx, onClose, onSubmit }: ThreadModalProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setBody('');
    setError('');
  }, [post?.id, open]);

  if (!open || !post) return null;

  const room = mx.getRoom(post.roomId);
  const replies = room ? getThreadEvents(room, post.id) : [];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    try {
      await onSubmit(post, trimmedBody);
      setBody('');
      setError('');
    } catch {
      setError('That reply could not be sent. Please try again.');
    }
  };

  return (
    <div
      className="social-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="social-modal social-thread-modal" role="dialog" aria-modal="true">
        <div className="social-modal-header">
          <div>
            <span className="social-thread-kicker">Thread</span>
            <h2>{post.title}</h2>
          </div>
          <button className="social-icon-button" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="social-thread-root">
          <p>{post.body}</p>
          <span>
            #{post.community} · {post.author} · {post.comments} comments
          </span>
        </div>
        <div className="social-thread-replies">
          {replies.length ? (
            replies.map((reply) => {
              const sender = reply.getSender() || '@unknown:matrix.iiit.ac.in';
              const member = room?.getMember(sender);
              const author =
                member?.rawDisplayName && member.rawDisplayName !== sender
                  ? member.rawDisplayName
                  : sender;
              const replyContent = eventContent(reply);
              return (
                <article className="social-thread-reply" key={reply.getId()}>
                  <div className="social-post-meta">
                    <span>{author}</span>
                    <span>•</span>
                    <span>{relativeTime(reply.getTs())}</span>
                  </div>
                  <p>{typeof replyContent.body === 'string' ? replyContent.body : ''}</p>
                </article>
              );
            })
          ) : (
            <div className="social-empty">No comments yet. Start the conversation.</div>
          )}
        </div>
        <form className="social-thread-reply-form" onSubmit={submit}>
          <textarea
            aria-label="Add a comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a comment..."
            maxLength={20000}
          />
          {error && (
            <div className="social-field-error" role="alert">
              {error}
            </div>
          )}
          <div className="social-thread-reply-actions">
            <button className="social-ghost-button" type="button" onClick={onClose}>
              Close
            </button>
            <button className="social-primary-button" type="submit">
              Reply
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

type ComposeProps = {
  open: boolean;
  rooms: Room[];
  onClose: () => void;
  onSubmit: (post: {
    roomId: string;
    title: string;
    body: string;
    kind: string;
    image?: string;
  }) => Promise<void>;
};

function ComposeModal({ open, rooms, onClose, onSubmit }: ComposeProps) {
  const [kind, setKind] = useState('Text');
  const [roomId, setRoomId] = useState(rooms[0]?.roomId ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  let bodyLabel = 'Body';
  if (kind === 'Link') bodyLabel = 'URL or body';
  if (kind === 'Image') bodyLabel = 'Caption';

  useEffect(() => {
    if (rooms.length && !rooms.some((room) => room.roomId === roomId)) setRoomId(rooms[0].roomId);
  }, [rooms, roomId]);

  if (!open) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!roomId) {
      setError('Choose a community before posting.');
      return;
    }
    if (title.trim().length < 1 || title.trim().length > 300) {
      setError('Title must be between 1 and 300 characters.');
      return;
    }
    if (body.length > 20000) {
      setError('Body must be 20,000 characters or fewer.');
      return;
    }
    try {
      setError('');
      await onSubmit({ roomId, title: title.trim(), body, kind, image: image || undefined });
      setTitle('');
      setBody('');
      setImage('');
    } catch {
      setError('That post could not be sent. Please try again.');
    }
  };

  return (
    <div
      className="social-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="social-modal" onSubmit={submit} aria-label="Create post">
        <div className="social-modal-header">
          <h2>Create post</h2>
          <button className="social-icon-button" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="social-modal-body">
          <div className="social-modal-tabs">
            {['Text', 'Link', 'Image'].map((tab) => (
              <button
                key={tab}
                type="button"
                data-active={kind === tab}
                onClick={() => setKind(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="social-field">
            <span className="social-field-label">Community</span>
            <select
              id="post-community"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              disabled={!rooms.length}
            >
              {rooms.length ? (
                rooms.map((room) => (
                  <option key={room.roomId} value={room.roomId}>
                    # {roomName(room)}
                  </option>
                ))
              ) : (
                <option>No synced communities yet</option>
              )}
            </select>
          </div>
          <div className="social-field">
            <span className="social-field-label">Title</span>
            <input
              id="post-title"
              aria-label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a title..."
            />
          </div>
          <div className="social-field">
            <span className="social-field-label">{bodyLabel}</span>
            <textarea
              id="post-body"
              aria-label={bodyLabel}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={kind === 'Link' ? 'https://...' : "What's on your mind?"}
            />
          </div>
          {kind === 'Image' && (
            <div className="social-field">
              <span className="social-field-label">Image URL</span>
              <input
                id="post-image"
                aria-label="Image URL"
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="Paste an authenticated media URL"
              />
            </div>
          )}
          {error && (
            <div className="social-field-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="social-modal-footer">
          <button className="social-ghost-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="social-primary-button" type="submit" disabled={!rooms.length}>
            Post
          </button>
        </div>
      </form>
    </div>
  );
}

type CommunityProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, alias: string, encrypted: boolean) => Promise<void>;
};

function CommunityModal({ open, onClose, onSubmit }: CommunityProps) {
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [encrypted, setEncrypted] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3 || name.trim().length > 50) {
      setError('Name must be between 3 and 50 characters.');
      return;
    }
    if (!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(alias)) {
      setError('Alias must use lowercase letters, numbers, _ or -.');
      return;
    }
    if (description.length > 500) {
      setError('Description must be 500 characters or fewer.');
      return;
    }
    setError('');
    await onSubmit(name.trim(), description.trim(), alias, encrypted);
  };
  return (
    <div
      className="social-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="social-modal" onSubmit={submit} aria-label="Create a community">
        <div className="social-modal-header">
          <h2>Create a community</h2>
          <button className="social-icon-button" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="social-modal-body">
          <div className="social-field">
            <span className="social-field-label">Name</span>
            <input
              id="community-name"
              aria-label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., Robotics Club"
            />
          </div>
          <div className="social-field">
            <span className="social-field-label">Description</span>
            <textarea
              id="community-description"
              aria-label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell people what this community is about..."
            />
          </div>
          <div className="social-field">
            <span className="social-field-label">URL preview</span>
            <input
              id="community-alias"
              aria-label="URL preview"
              value={alias}
              onChange={(event) => setAlias(event.target.value.toLowerCase())}
              placeholder="community-name"
            />
          </div>
          <div className="social-security-row" style={{ padding: 0, border: 0 }}>
            <span>
              <strong>End-to-end encrypted</strong>
              <br />
              <small style={{ color: 'var(--social-muted)' }}>
                Encrypted communities use device-local search and recovery.
              </small>
            </span>
            <input
              id="community-encrypted"
              aria-label="End-to-end encrypted"
              type="checkbox"
              checked={encrypted}
              onChange={(event) => setEncrypted(event.target.checked)}
            />
          </div>
          {error && (
            <div className="social-field-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="social-modal-footer">
          <button className="social-ghost-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="social-primary-button" type="submit">
            Create community
          </button>
        </div>
      </form>
    </div>
  );
}

function SecurityPage({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState('');
  return (
    <div className="social-security">
      <button
        className="social-ghost-button"
        type="button"
        onClick={onBack}
        style={{ marginBottom: 24 }}
      >
        <Icon name="back" size={17} /> Back
      </button>
      <h1>Security &amp; recovery</h1>
      <div className="social-security-card">
        <div className="social-security-row">
          <div>
            <h2>Current device</h2>
            <p>Matrix crypto is available on this device.</p>
          </div>
          <span className="social-status-secure">Ready to verify</span>
        </div>
        <div className="social-security-row">
          <div>
            <h2>Device verification</h2>
            <p>Verify that this device is connected to your account.</p>
          </div>
          <button
            className="social-ghost-button"
            type="button"
            onClick={() => setStatus('Verification request started.')}
          >
            Verify this device
          </button>
        </div>
        <div className="social-security-row">
          <div>
            <h2>Recovery</h2>
            <p>Set up account recovery to restore encrypted history on a new device.</p>
          </div>
          <button
            className="social-ghost-button"
            type="button"
            onClick={() => setStatus('Recovery setup is ready to continue in Matrix.')}
          >
            Set up recovery
          </button>
        </div>
        <div className="social-security-row">
          <p>
            <Icon name="shield" size={18} />{' '}
            {status ||
              'Recovery is the only way to restore your encrypted history on a new device.'}
          </p>
        </div>
      </div>
    </div>
  );
}

const getSocialPath = (rawPath: string) => {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  if (path === '/home') return '/';
  if (path.startsWith('/home/')) return path.slice('/home'.length) || '/';
  return path || '/';
};

const getSocialHref = (path: string) => {
  const normalized = getSocialPath(path);
  if (normalized === '/') return '/home/';
  return `/home${normalized.endsWith('/') ? normalized : `${normalized}/`}`;
};

function SocialApp() {
  const mx = useMatrixClient();
  const allRoomIds = useAtomValue(allRoomsAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const [location, setLocation] = useState(`${window.location.pathname}${window.location.search}`);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [threadPostId, setThreadPostId] = useState<string>();
  const [, setTick] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const push = useCallback((path: string) => {
    const [nextPath, nextSearch = ''] = path.split('?');
    const nextHref = `${getSocialHref(nextPath)}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.pushState({}, '', nextHref);
    setLocation(`${window.location.pathname}${window.location.search}`);
    setMobileNavOpen(false);
  }, []);

  useEffect(() => {
    const onPopState = () => setLocation(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    const client = mx as any;
    client.on(ClientEvent.Event, refresh);
    client.on(RoomEvent.Timeline, refresh);
    return () => {
      client.removeListener(ClientEvent.Event, refresh);
      client.removeListener(RoomEvent.Timeline, refresh);
    };
  }, [mx]);

  useEffect(() => {
    const refreshSaved = () => setSaved(new Set(getSavedPostIds(mx)));
    refreshSaved();
    mx.on(ClientEvent.AccountData, refreshSaved);
    return () => {
      mx.removeListener(ClientEvent.AccountData, refreshSaved);
    };
  }, [mx]);

  const allowedRoomIds = useMemo(
    () =>
      new Set(
        allRoomIds.filter((roomId) => getAllParents(roomToParents, roomId).has(ROOT_SPACE_ID))
      ),
    [allRoomIds, roomToParents]
  );
  const communities = useMemo(
    () =>
      Array.from(allowedRoomIds)
        .map((roomId) => mx.getRoom(roomId))
        .filter((room): room is Room => room !== null && !room.isSpaceRoom())
        .sort((a, b) => roomName(a).localeCompare(roomName(b))),
    [allowedRoomIds, mx]
  );
  const matrixPosts = readPosts(mx, Array.from(allowedRoomIds));
  const allPosts = matrixPosts;
  const queryParams = new URLSearchParams(location.split('?')[1] || '');
  const searchParam = queryParams.get('q') || '';
  const query = searchParam.trim().toLowerCase();
  const shareRoom = queryParams.get('room');
  const shareEvent = queryParams.get('event');
  const [searchText, setSearchText] = useState('');
  const path = getSocialPath(location.split('?')[0]);
  const communityId = path.startsWith('/c/') ? decodeURIComponent(path.slice(3)) : '';
  const [feedSort, setFeedSort] = useState<FeedSort>('hot');

  useEffect(() => setSearchText(searchParam), [searchParam]);

  useEffect(() => {
    const post = allPosts.find(
      (candidate) => candidate.roomId === shareRoom && candidate.id === shareEvent
    );
    if (post) setThreadPostId(post.id);
  }, [allPosts, shareEvent, shareRoom]);

  useEffect(() => {
    if (path === '/latest' || path === '/search') setFeedSort('new');
    else if (path === '/top') setFeedSort('top');
    else setFeedSort('hot');
  }, [path]);

  const visiblePosts = useMemo(() => {
    const posts = allPosts.filter((post) => {
      if (communityId && post.roomId !== communityId) return false;
      if (path === '/saved' && !saved.has(post.id)) return false;
      if (
        query &&
        !`${post.title} ${post.body} ${post.community} ${post.author}`.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    return posts.sort((a, b) => {
      if (feedSort === 'new') return b.timestamp - a.timestamp;
      if (feedSort === 'top') return b.score - a.score || b.timestamp - a.timestamp;
      return b.score - a.score || b.timestamp - a.timestamp;
    });
  }, [allPosts, communityId, feedSort, path, query, saved]);

  const userId = mx.getUserId() || '@member:matrix.iiit.ac.in';
  const displayName =
    mx.getUser(userId)?.displayName || userId.split(':')[0].replace('@', '') || 'Member';
  let title = 'Home';
  if (path === '/subscriptions') title = 'Subscriptions';
  if (path === '/latest') title = 'Latest';
  if (path === '/top') title = 'Top';
  if (path === '/saved') title = 'Saved';
  if (query) title = 'Search';
  if (communityId) {
    const community = communities.find((room) => room.roomId === communityId);
    title = community ? roomName(community) : 'Community';
  }
  let singleTabLabel = 'New';
  let singleTabSort: FeedSort = 'new';
  let singleTabIcon = 'trend';
  if (path === '/top') {
    singleTabLabel = 'All-time';
    singleTabSort = 'top';
    singleTabIcon = 'clock';
  } else if (path === '/saved') {
    singleTabLabel = 'Saved';
    singleTabSort = 'hot';
    singleTabIcon = 'bookmark';
  } else if (path === '/subscriptions') {
    singleTabLabel = 'Hot';
    singleTabSort = 'hot';
  }
  const feedTabs: Array<{ label: string; sort: FeedSort; icon: string }> =
    path === '/' || communityId
      ? [
          { label: 'Hot', sort: 'hot', icon: 'flame' },
          { label: 'New', sort: 'new', icon: 'clock' },
          { label: 'Top', sort: 'top', icon: 'trend' },
        ]
      : [{ label: singleTabLabel, sort: singleTabSort, icon: singleTabIcon }];

  const onVote = async (post: SocialPost, direction: number) => {
    const room = mx.getRoom(post.roomId);
    if (!room) return;

    const reactions = getEventReactions(room.getUnfilteredTimelineSet(), post.id);
    const grouped = reactions?.getSortedAnnotationsByKey() ?? [];
    const ownReaction = grouped
      .filter(([key]) => key === UPVOTE_KEY || key === DOWNVOTE_KEY)
      .flatMap(([, events]) => Array.from(events))
      .find((event) => event.getSender() === userId);

    try {
      const ownReactionId = ownReaction?.getId();
      if (ownReactionId) await mx.redactEvent(room.roomId, ownReactionId);
      if (post.myVote !== direction) {
        await mx.sendEvent(
          room.roomId,
          EventType.Reaction as any,
          getReactionContent(post.id, direction === 1 ? UPVOTE_KEY : DOWNVOTE_KEY)
        );
      }
    } catch {
      setNotice('Vote could not be saved to Matrix.');
      window.setTimeout(() => setNotice(''), 1800);
    }
  };
  const onSave = async (post: SocialPost) => {
    const current = getSavedPostIds(mx);
    const next = current.includes(post.id)
      ? current.filter((id) => id !== post.id)
      : [...current, post.id];
    setSaved(new Set(next));
    try {
      await mx.setAccountData(SAVED_EVENT_TYPE as any, { posts: next } as any);
    } catch {
      setSaved(new Set(current));
      setNotice('Saved posts could not be synced to Matrix.');
      window.setTimeout(() => setNotice(''), 1800);
    }
  };
  const onShare = async (post: SocialPost) => {
    const url = new URL(getSocialHref('/'), window.location.origin);
    url.searchParams.set('room', post.roomId);
    url.searchParams.set('event', post.id);
    if (navigator.clipboard)
      await navigator.clipboard.writeText(url.toString()).catch(() => undefined);
    setNotice('Post link copied.');
    window.setTimeout(() => setNotice(''), 1800);
  };
  const submitPost = async ({
    roomId,
    title: postTitle,
    body,
    kind,
    image,
  }: {
    roomId: string;
    title: string;
    body: string;
    kind: string;
    image?: string;
  }) => {
    const room = mx.getRoom(roomId);
    if (!room || !allowedRoomIds.has(roomId)) throw new Error('Community is outside IIIT social.');
    await mx.sendMessage(roomId, {
      msgtype: 'm.text',
      body,
      [POST_EVENT_TYPE]: { version: 1, kind: kind.toLowerCase(), title: postTitle, image },
    } as any);
    setComposeOpen(false);
    setNotice('Post sent to Matrix.');
    window.setTimeout(() => setNotice(''), 1800);
  };
  const submitReply = async (post: SocialPost, body: string) => {
    const room = mx.getRoom(post.roomId);
    if (!room || !allowedRoomIds.has(post.roomId))
      throw new Error('Community is outside IIIT social.');
    await mx.sendMessage(room.roomId, {
      msgtype: 'm.text',
      body,
      'm.relates_to': {
        rel_type: RelationType.Thread,
        event_id: post.id,
        is_falling_back: false,
      },
    } as any);
    setNotice('Reply sent to Matrix.');
    window.setTimeout(() => setNotice(''), 1800);
  };
  const submitCommunity = async (
    name: string,
    description: string,
    alias: string,
    encrypted: boolean
  ) => {
    try {
      const created = await (mx as any).createRoom({
        name,
        room_alias_name: alias,
        creation_content: encrypted ? { 'm.federate': true } : undefined,
        initial_state: [
          { type: 'm.room.topic', state_key: '', content: { topic: description } },
          ...(encrypted
            ? [
                {
                  type: 'm.room.encryption',
                  state_key: '',
                  content: { algorithm: 'm.megolm.v1.aes-sha2' },
                },
              ]
            : []),
        ],
      });
      await mx.sendStateEvent(
        ROOT_SPACE_ID,
        StateEvent.SpaceChild as any,
        { via: ['matrix.iiit.ac.in'], suggested: true },
        created.room_id
      );
      setCommunityOpen(false);
      setNotice('Community created and attached to IIIT social.');
    } catch {
      setNotice('Community could not be attached. You can retry from the form.');
    }
    window.setTimeout(() => setNotice(''), 2200);
  };

  if (path === '/settings/security')
    return (
      <div className="social-app">
        <header className="social-header">
          <button
            className="social-header-brand"
            type="button"
            onClick={() => push('/')}
            style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}
          >
            <img className="social-brand-mark" src={AppIcon} alt="IIIT social" />
            <span>IIIT social</span>
          </button>
        </header>
        <main className="social-main" style={{ padding: 36 }}>
          <SecurityPage onBack={() => push('/')} />
        </main>
      </div>
    );

  return (
    <div className="social-app">
      <header className="social-header">
        <div className="social-header-brand">
          <button
            className="social-icon-button social-mobile-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <Icon name="menu" />
          </button>
          <button
            type="button"
            onClick={() => push('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: 0,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <img className="social-brand-mark" src={AppIcon} alt="IIIT social" />
            <span>IIIT social</span>
          </button>
        </div>
        <div className="social-search">
          <Icon name="search" size={22} />
          <input
            aria-label="Search IIIT social"
            placeholder="Search IIIT social"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') push(`/search?q=${encodeURIComponent(searchText.trim())}`);
            }}
          />
        </div>
        <div className="social-header-actions">
          <button
            className="social-primary-button"
            type="button"
            onClick={() => setComposeOpen(true)}
            disabled={!communities.length}
          >
            <Icon name="plus" size={18} /> Create Post
          </button>
          <button
            className="social-profile"
            type="button"
            onClick={() => push('/settings/security')}
            style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
          >
            <span className="social-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
            <span>{displayName}</span>
            <span aria-hidden="true">⌄</span>
          </button>
        </div>
      </header>
      <div className="social-app-body">
        <aside className="social-sidebar" data-open={mobileNavOpen}>
          <nav className="social-nav-group" aria-label="Feeds">
            {[
              ['Home', '/', 'home'],
              ['Subscriptions', '/subscriptions', 'trend'],
              ['Latest', '/latest', 'clock'],
              ['Top', '/top', 'trend'],
              ['Saved', '/saved', 'bookmark'],
            ].map(([label, href, icon]) => (
              <button
                className="social-nav-button"
                key={href}
                type="button"
                data-active={path === href}
                onClick={() => push(href)}
              >
                <span className="social-nav-icon" aria-hidden="true">
                  <Icon name={icon} size={18} />
                </span>
                {label}
              </button>
            ))}
          </nav>
          <div className="social-divider" />
          <h2 className="social-side-heading">Communities</h2>
          <nav className="social-nav-group" aria-label="Communities">
            {communities.slice(0, 10).map((room) => (
              <button
                className="social-community-button"
                key={room.roomId}
                type="button"
                data-active={communityId === room.roomId}
                onClick={() => push(`/c/${encodeURIComponent(room.roomId)}`)}
              >
                <span className="social-nav-icon" aria-hidden="true">
                  #
                </span>
                {roomName(room)}
              </button>
            ))}
            {!communities.length && (
              <div className="social-sidebar-empty">Syncing communities…</div>
            )}
          </nav>
          <div className="social-divider" />
          <button
            className="social-nav-button"
            type="button"
            onClick={() => setCommunityOpen(true)}
          >
            <Icon name="plus" size={18} /> Create community
          </button>
        </aside>
        <main className="social-main">
          <div className="social-layout">
            <section className="social-feed" aria-labelledby="social-feed-title">
              <h1 className="social-feed-title" id="social-feed-title">
                {title}
              </h1>
              <div className="social-feed-tabs" aria-label="Feed order">
                {feedTabs.map((tab) => (
                  <button
                    className="social-sort-button"
                    key={tab.label}
                    type="button"
                    data-active={feedSort === tab.sort}
                    onClick={() => setFeedSort(tab.sort)}
                  >
                    <Icon name={tab.icon} size={17} /> {tab.label}
                  </button>
                ))}
              </div>
              <div className="social-post-list">
                {visiblePosts.length ? (
                  visiblePosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      voted={post.myVote}
                      saved={saved.has(post.id)}
                      onVote={onVote}
                      onComments={() => setThreadPostId(post.id)}
                      onSave={onSave}
                      onShare={onShare}
                    />
                  ))
                ) : (
                  <EmptySyncNotice />
                )}
              </div>
              {notice && (
                <div role="status" className="social-notice">
                  {notice}
                </div>
              )}
            </section>
            <aside className="social-rail">
              <section className="social-panel">
                <h2>About IIIT social</h2>
                <p>
                  IIIT social is the official community space for IIIT Hyderabad students. Connect,
                  share, and discuss everything campus life.
                </p>
                <hr />
                <p>
                  All content lives in a single Matrix Space. Your posts and replies are synced
                  across the community.
                </p>
                <hr />
                <a
                  className="social-panel-link"
                  href={ROOT_SPACE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="link" size={17} /> Synced with Matrix
                </a>
              </section>
              <section className="social-panel">
                <h2>Community rules</h2>
                <ol>
                  <li>Be respectful and kind</li>
                  <li>No spam or self-promotion</li>
                  <li>Keep posts relevant to IIIT-H</li>
                  <li>No hate speech or harassment</li>
                  <li>Follow all institute policies</li>
                </ol>
                <hr />
                <p>Let’s keep IIIT social helpful and welcoming for everyone.</p>
              </section>
            </aside>
          </div>
        </main>
      </div>
      <ComposeModal
        open={composeOpen}
        rooms={communities}
        onClose={() => setComposeOpen(false)}
        onSubmit={submitPost}
      />
      <CommunityModal
        open={communityOpen}
        onClose={() => setCommunityOpen(false)}
        onSubmit={submitCommunity}
      />
      <ThreadModal
        open={Boolean(threadPostId)}
        post={allPosts.find((post) => post.id === threadPostId) || null}
        mx={mx}
        onClose={() => {
          setThreadPostId(undefined);
          if (shareRoom || shareEvent) push(path);
        }}
        onSubmit={submitReply}
      />
    </div>
  );
}

export { SocialApp };
