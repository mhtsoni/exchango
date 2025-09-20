-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE,
  username TEXT,
  display_name TEXT,
  email TEXT,
  kyc_status TEXT DEFAULT 'none',
  rating INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price_cents INT NOT NULL,
  currency TEXT DEFAULT 'usd',
  delivery_type TEXT NOT NULL, -- code | file | manual
  proof_s3_key TEXT,
  code_encrypted BYTEA, -- encrypted code blob (nullable)
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  status TEXT DEFAULT 'pending_verification', -- pending_verification | active | sold | removed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_cents INT NOT NULL,
  currency TEXT DEFAULT 'usd',
  stripe_session_id TEXT,
  escrow_status TEXT DEFAULT 'held', -- held | released | refunded
  status TEXT DEFAULT 'pending_payment', -- pending_payment | paid | delivered | completed | disputed | refunded
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- deliveries
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  delivery_s3_key TEXT,
  delivery_data_encrypted BYTEA, -- encrypted code if needed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- disputes
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  opener_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'open', -- open | resolved | rejected
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
