CREATE TABLE IF NOT EXISTS private_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name varchar(150) NOT NULL,
  mime varchar(30) NOT NULL,
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(octet_length(bytes)<=2097152)
);
CREATE INDEX IF NOT EXISTS private_files_owner ON private_files(owner_id);
CREATE TABLE IF NOT EXISTS template_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  mime varchar(30) NOT NULL,
  bytes bytea NOT NULL
);
