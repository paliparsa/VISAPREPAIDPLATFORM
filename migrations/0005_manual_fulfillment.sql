ALTER TABLE orders ADD COLUMN manual_payment_reference TEXT;
ALTER TABLE orders ADD COLUMN manual_payment_note TEXT;

ALTER TABLE issuance_attempts ADD COLUMN delivery_url TEXT;
ALTER TABLE issuance_attempts ADD COLUMN admin_note TEXT;
ALTER TABLE issuance_attempts ADD COLUMN processed_by TEXT REFERENCES users(id);
ALTER TABLE issuance_attempts ADD COLUMN updated_at TEXT;
CREATE UNIQUE INDEX idx_manual_issuance_provider_order_id
  ON issuance_attempts(provider_order_id)
  WHERE provider='TREMENDOUS_MANUAL' AND provider_order_id IS NOT NULL;
