/*
# Add overall rating column to ratings table

1. Modified Tables
- `ratings`: adds `overall` smallint column (nullable, CHECK 1-5) so users can submit
  their own explicit 1-5 overall score alongside the 3 sub-criteria.
- Existing rows keep NULL — backward compatible.
2. Security
- No policy changes needed: existing CRUD policies on `ratings` already allow
  anon/authenticated to read/insert/update/delete, and column-level access is
  covered by the existing table-level grants.
*/

ALTER TABLE ratings ADD COLUMN IF NOT EXISTS overall smallint CHECK (overall IS NULL OR overall BETWEEN 1 AND 5);
