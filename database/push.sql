CREATE TABLE IF NOT EXISTS push_subscriptions (
  push_key TEXT PRIMARY KEY,
  management_hash TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  click_base TEXT NOT NULL,
  preview_mode TEXT NOT NULL CHECK (preview_mode IN ('maximum', 'private')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_expires_at_idx
  ON push_subscriptions (expires_at);

CREATE TABLE IF NOT EXISTS push_dedupes (
  push_key TEXT NOT NULL REFERENCES push_subscriptions (push_key) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'delivered')),
  claimed_until TIMESTAMPTZ,
  delivered_until TIMESTAMPTZ,
  PRIMARY KEY (push_key, event_id)
);

CREATE INDEX IF NOT EXISTS push_dedupes_claimed_until_idx
  ON push_dedupes (claimed_until);

CREATE INDEX IF NOT EXISTS push_dedupes_delivered_until_idx
  ON push_dedupes (delivered_until);

CREATE TABLE IF NOT EXISTS push_rate_limits (
  bucket TEXT NOT NULL,
  identity_hash TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (bucket, identity_hash)
);

CREATE INDEX IF NOT EXISTS push_rate_limits_window_started_at_idx
  ON push_rate_limits (window_started_at);

CREATE TABLE IF NOT EXISTS push_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
