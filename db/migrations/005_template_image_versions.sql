ALTER TABLE template_images ADD COLUMN IF NOT EXISTS version integer;
UPDATE template_images i SET version=t.version FROM routine_templates t WHERE i.template_id=t.id AND i.version IS NULL;
ALTER TABLE template_images ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE template_images ALTER COLUMN version SET NOT NULL;
CREATE INDEX IF NOT EXISTS template_images_version ON template_images(template_id,version);
