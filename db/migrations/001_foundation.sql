CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title varchar(100) NOT NULL CHECK (length(trim(title)) > 0),
  category varchar(30) NOT NULL,
  target numeric NOT NULL CHECK (target > 0 AND target <= 100000),
  unit varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
CREATE INDEX IF NOT EXISTS habits_owner_idx ON habits(owner_id);
CREATE TABLE IF NOT EXISTS check_ins (
  habit_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  local_date date NOT NULL,
  value numeric NOT NULL CHECK (value >= 0 AND value <= 100000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (habit_id, local_date),
  FOREIGN KEY (habit_id, owner_id) REFERENCES habits(id, owner_id) ON DELETE CASCADE
);
