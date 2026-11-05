CREATE TABLE IF NOT EXISTS habit_versions (
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  plan jsonb NOT NULL,
  PRIMARY KEY(habit_id,effective_date)
);
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS fallback boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS planning_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('task','goal','annotation','preferences')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planning_records_owner ON planning_records(owner_id,kind);
CREATE TABLE IF NOT EXISTS routine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title varchar(100) NOT NULL,
  description varchar(1000) NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  moderated boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS template_versions (
  template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL,
  PRIMARY KEY(template_id,version)
);
CREATE TABLE IF NOT EXISTS template_feedback (
  template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  bookmarked boolean NOT NULL DEFAULT false,
  rating integer CHECK(rating BETWEEN 1 AND 5),
  PRIMARY KEY(template_id,owner_id)
);
CREATE TABLE IF NOT EXISTS template_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason varchar(1000) NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
