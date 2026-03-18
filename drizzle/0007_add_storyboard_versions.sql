-- 1. Create the new table
CREATE TABLE storyboard_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  version_num INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 2. Add version_id to shots (nullable for backwards compatibility)
ALTER TABLE shots ADD COLUMN version_id TEXT REFERENCES storyboard_versions(id) ON DELETE CASCADE;

-- 3. Backfill: create a V1 version for each project that already has shots
INSERT INTO storyboard_versions (id, project_id, label, version_num, created_at)
SELECT
  lower(hex(randomblob(16))) AS id,
  p.id AS project_id,
  strftime('%Y%m%d', datetime(p.created_at, 'unixepoch')) || '-V1' AS label,
  1 AS version_num,
  p.created_at AS created_at
FROM projects p
WHERE EXISTS (SELECT 1 FROM shots s WHERE s.project_id = p.id);

-- 4. Assign existing shots to their project's V1 version
UPDATE shots
SET version_id = (
  SELECT sv.id FROM storyboard_versions sv
  WHERE sv.project_id = shots.project_id AND sv.version_num = 1
)
WHERE version_id IS NULL;
