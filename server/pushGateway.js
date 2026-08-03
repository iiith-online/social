import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

const SUBSCRIPTION_TTL = 180 * 24 * 60 * 60;
const DEDUPE_TTL = 24 * 60 * 60;
const DEDUPE_PENDING_TTL = 30;
const RATE_LIMIT_TTL = 60;
const APP_ID = process.env.PUSH_APP_ID || 'org.iiit.matrix.web';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;
let database;
let connectedDatabaseUrl;

const getDatabase = () => {
  const url = databaseUrl();
  if (!url) throw new HttpError(503, 'Push storage is not configured.');
  if (!database || connectedDatabaseUrl !== url) {
    database = neon(url);
    connectedDatabaseUrl = url;
  }
  return database;
};

const databaseQuery = async (operation) => {
  try {
    return await operation(getDatabase());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Push storage failed.');
  }
};

const databaseTransaction = async (operation) => {
  try {
    return await getDatabase().transaction(operation);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Push storage failed.');
  }
};

const parseBody = (req, maxBytes = 16_384) => {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Expected a JSON object.');
  }
  if (Buffer.byteLength(JSON.stringify(body)) > maxBytes) {
    throw new HttpError(413, 'Request body is too large.');
  }
  return body;
};

const requestOrigin = (req) => {
  if (process.env.PUSH_PUBLIC_ORIGIN) return process.env.PUSH_PUBLIC_ORIGIN.replace(/\/$/, '');
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) throw new HttpError(400, 'Missing host.');
  return `${protocol}://${host}`;
};

const rateLimit = async (req, bucket, limit) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const identity = forwarded || req.socket?.remoteAddress || 'unknown';
  const rows = await databaseQuery(
    (sql) => sql`
    INSERT INTO push_rate_limits (bucket, identity_hash, window_started_at, request_count)
    VALUES (${bucket}, ${sha256(identity)}, NOW(), 1)
    ON CONFLICT (bucket, identity_hash) DO UPDATE SET
      request_count = CASE
        WHEN push_rate_limits.window_started_at <= NOW() - ${RATE_LIMIT_TTL} * INTERVAL '1 second'
          THEN 1
        ELSE push_rate_limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN push_rate_limits.window_started_at <= NOW() - ${RATE_LIMIT_TTL} * INTERVAL '1 second'
          THEN NOW()
        ELSE push_rate_limits.window_started_at
      END
    RETURNING request_count
  `,
  );
  const count = Number(rows[0]?.request_count || 0);
  if (count === 1) {
    await databaseQuery(
      (sql) => sql`
        DELETE FROM push_rate_limits
        WHERE window_started_at <= NOW() - ${24 * 60 * 60} * INTERVAL '1 second'
      `,
    ).catch(() => undefined);
  }
  if (count > limit) throw new HttpError(429, 'Too many requests. Try again later.');
};

export const requireSameOrigin = (req) => {
  const origin = req.headers.origin;
  const allowed = new Set(
    (process.env.PUSH_ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  allowed.add(requestOrigin(req));
  if (!origin || !allowed.has(origin)) throw new HttpError(403, 'Origin is not allowed.');
  return origin;
};

const bearerToken = (req) => {
  const match = /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(req.headers.authorization || '');
  if (!match) throw new HttpError(401, 'Missing management token.');
  return match[1];
};

const validateSubscription = (value) => {
  const endpoint = value?.endpoint;
  const p256dh = value?.keys?.p256dh;
  const auth = value?.keys?.auth;
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new HttpError(400, 'Invalid push subscription.');
  }
  if (
    endpointUrl.protocol !== 'https:' ||
    endpoint.length > 2048 ||
    typeof p256dh !== 'string' ||
    p256dh.length > 256 ||
    typeof auth !== 'string' ||
    auth.length > 128
  ) {
    throw new HttpError(400, 'Invalid push subscription.');
  }
  return { endpoint, expirationTime: value.expirationTime ?? null, keys: { p256dh, auth } };
};

const validateClickBase = (value, origin) => {
  if (typeof value !== 'string' || value.length > 1024) {
    throw new HttpError(400, 'Invalid click base.');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, 'Invalid click base.');
  }
  if (url.origin !== origin || url.username || url.password) {
    throw new HttpError(400, 'Invalid click base.');
  }
  return value.replace(/\/$/, '');
};

const PUSH_SELECT = `
  SELECT push_key, subscription, click_base, preview_mode, management_hash, created_at, updated_at
  FROM push_subscriptions
`;

const recordFromRow = (row) => ({
  subscription:
    typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription,
  clickBase: row.click_base,
  previewMode: row.preview_mode,
  managementHash: row.management_hash,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

const loadManagedRecord = async (req) => {
  const token = bearerToken(req);
  const rows = await databaseQuery((db) =>
    db.query(`${PUSH_SELECT} WHERE management_hash = $1 AND expires_at > NOW() LIMIT 1`, [
      sha256(token),
    ]),
  );
  if (rows.length === 0) throw new HttpError(401, 'Invalid management token.');
  return { token, pushKey: rows[0].push_key, record: recordFromRow(rows[0]) };
};

const loadPushRecords = async (pushKeys) => {
  const uniquePushKeys = [...new Set(pushKeys)];
  if (uniquePushKeys.length === 0) return new Map();
  const rows = await databaseQuery((db) =>
    db.query(`${PUSH_SELECT} WHERE push_key = ANY($1::text[]) AND expires_at > NOW()`, [
      uniquePushKeys,
    ]),
  );
  return new Map(rows.map((row) => [row.push_key, recordFromRow(row)]));
};

const saveRecord = async (pushKey, record) => {
  const createdAt = new Date(record.createdAt || Date.now()).toISOString();
  const updatedAt = new Date(record.updatedAt || Date.now()).toISOString();
  const expiresAt = new Date(Date.now() + SUBSCRIPTION_TTL * 1000).toISOString();
  const subscription = JSON.stringify(record.subscription);
  await databaseQuery(
    (sql) => sql`
    INSERT INTO push_subscriptions (
      push_key,
      management_hash,
      subscription,
      click_base,
      preview_mode,
      created_at,
      updated_at,
      expires_at
    ) VALUES (
      ${pushKey},
      ${record.managementHash},
      ${subscription}::jsonb,
      ${record.clickBase},
      ${record.previewMode},
      ${createdAt},
      ${updatedAt},
      ${expiresAt}
    )
    ON CONFLICT (push_key) DO UPDATE SET
      management_hash = EXCLUDED.management_hash,
      subscription = EXCLUDED.subscription,
      click_base = EXCLUDED.click_base,
      preview_mode = EXCLUDED.preview_mode,
      updated_at = EXCLUDED.updated_at,
      expires_at = EXCLUDED.expires_at
  `,
  );
};

const refreshRecord = async (pushKey) => {
  await databaseQuery(
    (sql) => sql`
    UPDATE push_subscriptions
    SET updated_at = NOW(), expires_at = NOW() + ${SUBSCRIPTION_TTL} * INTERVAL '1 second'
    WHERE push_key = ${pushKey}
  `,
  );
};

// ponytail: cleanup is per warm function instance; expiry checks keep delivery correct, and a scheduled job can replace it if state grows.
let lastCleanupAt = 0;
const cleanupExpiredState = async () => {
  if (Date.now() - lastCleanupAt < 60_000) return;
  lastCleanupAt = Date.now();
  await databaseTransaction((sql) => [
    sql`
      DELETE FROM push_dedupes
      WHERE (state = 'pending' AND claimed_until <= NOW())
         OR (state = 'delivered' AND delivered_until <= NOW())
    `,
    sql`DELETE FROM push_subscriptions WHERE expires_at <= NOW()`,
  ]).catch(() => undefined);
};

export const isEnabled = async () => {
  if (!databaseUrl()) return process.env.PUSH_ENABLED === 'true';
  const rows = await databaseQuery(
    (sql) => sql`
    SELECT value FROM push_settings WHERE key = 'enabled' LIMIT 1
  `,
  );
  if (rows.length === 0) return process.env.PUSH_ENABLED === 'true';
  return ['1', 'true', 'on'].includes(String(rows[0].value).toLowerCase());
};

export const getPublicConfig = async (req) => ({
  enabled: await isEnabled(),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  appId: APP_ID,
  notifyUrl: `${requestOrigin(req)}/_matrix/push/v1/notify`,
});

export const upsertSubscription = async (req) => {
  const origin = requireSameOrigin(req);
  if (!(await isEnabled())) throw new HttpError(503, 'Push notifications are disabled.');
  await rateLimit(req, 'subscription', 20);
  const body = parseBody(req);
  const subscription = validateSubscription(body.subscription);
  const clickBase = validateClickBase(body.clickBase, origin);
  const previewMode = body.previewMode === 'maximum' ? 'maximum' : 'private';

  const authorization = req.headers.authorization;
  if (authorization) {
    const managed = await loadManagedRecord(req);
    const record = {
      ...managed.record,
      subscription,
      clickBase,
      previewMode,
      updatedAt: Date.now(),
    };
    await saveRecord(managed.pushKey, record);
    return { pushKey: managed.pushKey, managementToken: managed.token };
  }

  const pushKey = randomBytes(32).toString('base64url');
  const managementToken = randomBytes(32).toString('base64url');
  await saveRecord(pushKey, {
    subscription,
    clickBase,
    previewMode,
    managementHash: sha256(managementToken),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return { pushKey, managementToken };
};

export const deleteSubscription = async (req) => {
  requireSameOrigin(req);
  const { pushKey } = await loadManagedRecord(req);
  await databaseQuery((sql) => sql`DELETE FROM push_subscriptions WHERE push_key = ${pushKey}`);
};

export const sanitizeText = (value, maxLength = 160) =>
  String(value || '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const contentSummary = (notification) => {
  const body = sanitizeText(notification.content?.body);
  if (body) return body;
  if (notification.type === 'm.room.encrypted') return 'Encrypted message';
  if (notification.type === 'm.room.member' && notification.user_is_target) {
    return 'New room invitation';
  }
  const msgtype = notification.content?.msgtype;
  if (['m.text', 'm.notice', 'm.emote'].includes(msgtype)) {
    return body || 'New message';
  }
  return (
    {
      'm.image': 'Sent an image',
      'm.video': 'Sent a video',
      'm.audio': 'Sent an audio message',
      'm.file': 'Sent a file',
    }[msgtype] || 'New message'
  );
};

export const buildClickUrl = (clickBase, roomId, eventId) => {
  if (!roomId || !eventId) return `${clickBase}/inbox/notifications/`;
  return `${clickBase}/recent/${encodeURIComponent(roomId)}/${encodeURIComponent(eventId)}/`;
};

export const renderNotification = (notification, record) => {
  const maximum = record.previewMode === 'maximum';
  const roomName = sanitizeText(notification.room_name, 80);
  const sender = sanitizeText(notification.sender_display_name, 80);
  const summary = contentSummary(notification);
  const body = maximum
    ? sender
      ? `${sender}: ${summary}`
      : summary
    : 'New IIIT social notification';
  const unread = Number.isInteger(notification.counts?.unread)
    ? Math.min(9999, Math.max(0, notification.counts.unread))
    : undefined;

  return {
    title: maximum && roomName ? roomName : 'IIIT social',
    body,
    clickUrl: buildClickUrl(record.clickBase, notification.room_id, notification.event_id),
    tag: notification.room_id ? `room-${sha256(notification.room_id).slice(0, 24)}` : 'matrix',
    roomId: notification.room_id,
    eventId: notification.event_id,
    encrypted: notification.type === 'm.room.encrypted',
    unread,
    priority: notification.prio === 'low' ? 'low' : 'high',
    show: Boolean(notification.event_id),
  };
};

let vapidConfigured = false;
const send = async (record, payload) => {
  if (!vapidConfigured) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      throw new HttpError(503, 'Web Push is not configured.');
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  await webpush.sendNotification(record.subscription, JSON.stringify(payload), {
    TTL: 300,
    urgency: payload.priority === 'low' ? 'low' : 'high',
  });
};

export const sendTest = async (req) => {
  requireSameOrigin(req);
  if (!(await isEnabled())) throw new HttpError(503, 'Push notifications are disabled.');
  await rateLimit(req, 'test', 10);
  const { record } = await loadManagedRecord(req);
  await send(record, {
    title: 'IIIT social',
    body: 'Push notifications are working.',
    clickUrl: `${record.clickBase}/recent/`,
    tag: 'matrix-test',
    priority: 'high',
    show: true,
  });
};

const claimDedupe = async (pushKey, eventId) => {
  const rows = await databaseQuery(
    (sql) => sql`
    INSERT INTO push_dedupes (push_key, event_id, state, claimed_until)
    VALUES (
      ${pushKey},
      ${eventId},
      'pending',
      NOW() + ${DEDUPE_PENDING_TTL} * INTERVAL '1 second'
    )
    ON CONFLICT (push_key, event_id) DO UPDATE SET
      state = 'pending',
      claimed_until = NOW() + ${DEDUPE_PENDING_TTL} * INTERVAL '1 second',
      delivered_until = NULL
    WHERE (
      push_dedupes.state = 'pending'
      AND push_dedupes.claimed_until <= NOW()
    ) OR (
      push_dedupes.state = 'delivered'
      AND push_dedupes.delivered_until <= NOW()
    )
    RETURNING push_key
  `,
  );
  return rows.length > 0;
};

const markDedupeDelivered = async (pushKey, eventId) => {
  await databaseQuery(
    (sql) => sql`
    UPDATE push_dedupes
    SET state = 'delivered',
        claimed_until = NULL,
        delivered_until = NOW() + ${DEDUPE_TTL} * INTERVAL '1 second'
    WHERE push_key = ${pushKey} AND event_id = ${eventId}
  `,
  );
};

const releaseDedupe = async (pushKey, eventId) => {
  await databaseQuery(
    (sql) => sql`
    DELETE FROM push_dedupes
    WHERE push_key = ${pushKey} AND event_id = ${eventId} AND state = 'pending'
  `,
  );
};

const removeExpiredRecord = async (pushKey) => {
  await databaseQuery((sql) => sql`DELETE FROM push_subscriptions WHERE push_key = ${pushKey}`);
};

export const handleMatrixNotify = async (req) => {
  if (!(await isEnabled())) return { rejected: [] };
  await rateLimit(req, 'notify', 120);
  const { notification } = parseBody(req, 65_536);
  if (!notification || !Array.isArray(notification.devices) || notification.devices.length > 50) {
    throw new HttpError(400, 'Invalid Matrix notification.');
  }
  for (const field of ['event_id', 'room_id', 'room_name', 'sender_display_name', 'type']) {
    if (notification[field] !== undefined && typeof notification[field] !== 'string') {
      throw new HttpError(400, 'Invalid Matrix notification.');
    }
    if (notification[field]?.length > 1024) {
      throw new HttpError(400, 'Invalid Matrix notification.');
    }
  }

  await cleanupExpiredState();
  const records = await loadPushRecords(
    notification.devices
      .map((device) => device?.pushkey)
      .filter((pushKey) => typeof pushKey === 'string' && pushKey.length <= 512),
  );
  const rejected = [];
  let transientFailure = false;
  for (const device of notification.devices) {
    const pushKey = device?.pushkey;
    if (typeof pushKey !== 'string' || pushKey.length > 512) continue;
    const record = records.get(pushKey);
    if (!record) {
      rejected.push(pushKey);
      continue;
    }

    const eventId = notification.event_id;
    if (eventId && !(await claimDedupe(pushKey, eventId))) {
      continue;
    }

    let delivered = false;
    try {
      await send(record, renderNotification(notification, record));
      delivered = true;
      if (eventId) await markDedupeDelivered(pushKey, eventId);
      await refreshRecord(pushKey).catch(() => undefined);
    } catch (error) {
      if (eventId && !delivered) await releaseDedupe(pushKey, eventId);
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await removeExpiredRecord(pushKey);
        rejected.push(pushKey);
      } else {
        transientFailure = true;
      }
    }
  }

  if (transientFailure) throw new HttpError(502, 'Temporary push delivery failure.');
  return { rejected };
};

export const handleError = (res, error) => {
  if (error instanceof SyntaxError) return json(res, 400, { error: 'Invalid JSON.' });
  return json(res, error instanceof HttpError ? error.status : 500, {
    error: error instanceof HttpError ? error.message : 'Push request failed.',
  });
};
