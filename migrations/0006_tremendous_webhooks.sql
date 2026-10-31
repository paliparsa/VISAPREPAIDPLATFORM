-- Persist provider webhook delivery state and the latest provider-side order status.
ALTER TABLE provider_events ADD COLUMN resource_type TEXT;
ALTER TABLE provider_events ADD COLUMN resource_id TEXT;
ALTER TABLE provider_events ADD COLUMN order_id TEXT REFERENCES orders(id);
ALTER TABLE provider_events ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'RECEIVED';
ALTER TABLE provider_events ADD COLUMN last_error TEXT;
ALTER TABLE provider_events ADD COLUMN updated_at TEXT;
ALTER TABLE issuance_attempts ADD COLUMN provider_status TEXT;
ALTER TABLE issuance_attempts ADD COLUMN provider_last_event TEXT;
ALTER TABLE issuance_attempts ADD COLUMN provider_last_event_at TEXT;
CREATE INDEX idx_provider_events_status_created ON provider_events(provider, processing_status, created_at DESC);
CREATE INDEX idx_provider_events_order ON provider_events(order_id, created_at DESC);
CREATE INDEX idx_issuance_provider_order ON issuance_attempts(provider, provider_order_id);
