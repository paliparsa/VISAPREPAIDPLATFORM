-- General-purpose Tremendous event intelligence. Keeps raw verified payloads for audit and future event types.
ALTER TABLE provider_events ADD COLUMN payload_json TEXT;
ALTER TABLE provider_events ADD COLUMN event_category TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE provider_events ADD COLUMN action_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_events ADD COLUMN resource_created_utc TEXT;

CREATE INDEX idx_provider_events_category_created
  ON provider_events(provider, event_category, created_at DESC);
CREATE INDEX idx_provider_events_resource
  ON provider_events(provider, resource_type, resource_id);

CREATE TABLE provider_event_attempts (
  id TEXT PRIMARY KEY,
  provider_event_row_id TEXT NOT NULL REFERENCES provider_events(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROCESSING','SUCCEEDED','FAILED')),
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
CREATE INDEX idx_provider_event_attempts_event
  ON provider_event_attempts(provider_event_row_id, started_at DESC);

CREATE TABLE provider_alerts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_row_id TEXT NOT NULL REFERENCES provider_events(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('INFO','WARNING','CRITICAL')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TEXT,
  acknowledged_by TEXT REFERENCES users(id),
  UNIQUE(provider_event_row_id, alert_type)
);
CREATE INDEX idx_provider_alerts_status_created
  ON provider_alerts(provider, status, created_at DESC);
