CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE user_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id), country_of_residence TEXT,
 first_name TEXT, last_name TEXT, eligibility_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE admin_users (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('OWNER','ADMIN','SUPPORT','FINANCE')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE products (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_product_id TEXT,
 name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD',
 face_value_minor INTEGER NOT NULL CHECK(face_value_minor > 0),
 enabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE orders (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 product_id TEXT NOT NULL REFERENCES products(id), status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
 recipient_name TEXT NOT NULL, recipient_email TEXT NOT NULL,
 face_value_minor INTEGER NOT NULL, sale_price_minor INTEGER NOT NULL,
 currency TEXT NOT NULL DEFAULT 'USD', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE deposit_addresses (
 id TEXT PRIMARY KEY, chain TEXT NOT NULL CHECK(chain IN ('TRON','ETHEREUM','BSC')),
 address TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'AVAILABLE',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(chain,address)
);
CREATE TABLE payments (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
 chain TEXT NOT NULL CHECK(chain IN ('TRON','ETHEREUM','BSC')),
 deposit_address_id TEXT NOT NULL REFERENCES deposit_addresses(id),
 expected_amount_atomic TEXT NOT NULL, received_amount_atomic TEXT NOT NULL DEFAULT '0',
 status TEXT NOT NULL DEFAULT 'AWAITING', expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE payment_events (
 id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id), chain TEXT NOT NULL,
 tx_hash TEXT NOT NULL, log_index TEXT NOT NULL DEFAULT '0', amount_atomic TEXT NOT NULL,
 block_number TEXT NOT NULL, confirmations INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'OBSERVED', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(chain,tx_hash,log_index)
);
CREATE TABLE issuance_attempts (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL,
 external_id TEXT NOT NULL UNIQUE, provider_order_id TEXT, status TEXT NOT NULL DEFAULT 'QUEUED',
 error_code TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE provider_events (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_event_id TEXT NOT NULL,
 event_type TEXT NOT NULL, processed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(provider,provider_event_id)
);
CREATE TABLE audit_logs (
 id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata_json TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_orders_user_created ON orders(user_id,created_at);
CREATE INDEX idx_orders_status_created ON orders(status,created_at);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_deposit_addresses_status ON deposit_addresses(chain,status);
CREATE INDEX idx_payment_events_payment ON payment_events(payment_id);