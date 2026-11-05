CREATE TABLE IF NOT EXISTS profiles (
  owner_id uuid PRIMARY KEY,
  preferences jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
