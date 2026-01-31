-- ============================================================================
-- Entity Merge Support (Phase 2.3: Entity Resolution)
-- ============================================================================
-- This migration adds entity merge tracking capabilities:
-- 1. Add merge status fields to entities table
-- 2. Create entity_merge_history table for rollback support
-- ============================================================================

-- Add merge tracking columns to entities table
ALTER TABLE entities ADD COLUMN merge_status TEXT DEFAULT 'active' NOT NULL CHECK(merge_status IN ('active', 'merged', 'deleted'));
ALTER TABLE entities ADD COLUMN merged_into TEXT REFERENCES entities(id);

-- Create index on merge_status for faster queries
CREATE INDEX idx_entities_merge_status ON entities(merge_status);
CREATE INDEX idx_entities_merged_into ON entities(merged_into);

-- ============================================================================
-- Entity Merge History Table
-- ============================================================================
-- Tracks all entity merge operations for audit trail and rollback capability
-- Stores complete snapshots of both entities before merge

CREATE TABLE entity_merge_history (
  id TEXT PRIMARY KEY,
  primary_entity_id TEXT NOT NULL REFERENCES entities(id),
  duplicate_entity_id TEXT NOT NULL REFERENCES entities(id),
  merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  merged_by TEXT,
  merge_strategy TEXT NOT NULL, -- 'highest_confidence', 'most_recent', 'manual'
  conflicts_resolved TEXT NOT NULL, -- JSON array of ConflictResolution objects
  original_primary TEXT NOT NULL, -- JSON snapshot of primary entity before merge
  original_duplicate TEXT NOT NULL, -- JSON snapshot of duplicate entity before merge
  relationships_updated INTEGER DEFAULT 0 NOT NULL,
  rollback_possible INTEGER DEFAULT 1 NOT NULL, -- Boolean: 1 = true, 0 = false
  notes TEXT
);

-- Create indexes for merge history queries
CREATE INDEX idx_merge_history_primary ON entity_merge_history(primary_entity_id);
CREATE INDEX idx_merge_history_duplicate ON entity_merge_history(duplicate_entity_id);
CREATE INDEX idx_merge_history_merged_at ON entity_merge_history(merged_at);
CREATE INDEX idx_merge_history_merged_by ON entity_merge_history(merged_by);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN entities.merge_status IS 'Status of entity: active (normal), merged (merged into another), deleted (soft deleted)';
COMMENT ON COLUMN entities.merged_into IS 'ID of entity this was merged into (if merge_status = merged)';

COMMENT ON TABLE entity_merge_history IS 'Complete audit trail of all entity merge operations with rollback capability';
COMMENT ON COLUMN entity_merge_history.merge_strategy IS 'Strategy used for conflict resolution during merge';
COMMENT ON COLUMN entity_merge_history.conflicts_resolved IS 'JSON array documenting how each conflict was resolved';
COMMENT ON COLUMN entity_merge_history.original_primary IS 'Complete JSON snapshot of primary entity state before merge';
COMMENT ON COLUMN entity_merge_history.original_duplicate IS 'Complete JSON snapshot of duplicate entity state before merge';
COMMENT ON COLUMN entity_merge_history.rollback_possible IS 'Whether this merge can be rolled back (false if duplicate was hard deleted)';
