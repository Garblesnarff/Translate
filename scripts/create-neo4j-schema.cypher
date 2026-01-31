// ============================================================================
// Neo4j Knowledge Graph Schema Creation Script
// Tibetan Buddhist Knowledge Graph - Phase 4, Task 4.2
// ============================================================================
//
// This script creates the complete schema for the Tibetan Buddhist Knowledge
// Graph including:
// - Node labels with properties
// - Uniqueness and existence constraints
// - Property and composite indexes
// - Full-text search indexes
//
// USAGE:
// 1. Ensure Neo4j database is running
// 2. Execute in Neo4j Browser or via cypher-shell:
//    cat create-neo4j-schema.cypher | cypher-shell -u neo4j -p password
// 3. Verify with: SHOW CONSTRAINTS; SHOW INDEXES;
//
// IMPORTANT NOTES:
// - Create constraints BEFORE loading data
// - Constraints may fail if data violates rules
// - Some indexes are automatically created with constraints
// - Full-text indexes require separate syntax
//
// ============================================================================

// ============================================================================
// SECTION 1: UNIQUENESS CONSTRAINTS
// ============================================================================
// These create both constraints AND indexes for fast lookups

// Entity ID Uniqueness (Base Label)
// ----------------------------------------------------------------------------
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (e:Entity) REQUIRE e.id IS UNIQUE;

// Entity Type-Specific ID Uniqueness
// ----------------------------------------------------------------------------
CREATE CONSTRAINT person_id_unique IF NOT EXISTS
FOR (p:Person) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT place_id_unique IF NOT EXISTS
FOR (p:Place) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT text_id_unique IF NOT EXISTS
FOR (t:Text) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT event_id_unique IF NOT EXISTS
FOR (e:Event) REQUIRE e.id IS UNIQUE;

CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (c:Concept) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT institution_id_unique IF NOT EXISTS
FOR (i:Institution) REQUIRE i.id IS UNIQUE;

CREATE CONSTRAINT deity_id_unique IF NOT EXISTS
FOR (d:Deity) REQUIRE d.id IS UNIQUE;

CREATE CONSTRAINT lineage_id_unique IF NOT EXISTS
FOR (l:Lineage) REQUIRE l.id IS UNIQUE;

// ============================================================================
// SECTION 2: EXISTENCE CONSTRAINTS (Required Properties)
// ============================================================================

// Entity Base Properties
// ----------------------------------------------------------------------------
CREATE CONSTRAINT entity_canonical_name_exists IF NOT EXISTS
FOR (e:Entity) REQUIRE e.canonical_name IS NOT NULL;

CREATE CONSTRAINT entity_type_exists IF NOT EXISTS
FOR (e:Entity) REQUIRE e.entity_type IS NOT NULL;

CREATE CONSTRAINT entity_confidence_exists IF NOT EXISTS
FOR (e:Entity) REQUIRE e.confidence IS NOT NULL;

CREATE CONSTRAINT entity_verified_exists IF NOT EXISTS
FOR (e:Entity) REQUIRE e.verified IS NOT NULL;

CREATE CONSTRAINT entity_extraction_method_exists IF NOT EXISTS
FOR (e:Entity) REQUIRE e.extraction_method IS NOT NULL;

CREATE CONSTRAINT entity_created_at_exists IF NOT EXISTS
FOR (e:Entity) REQUIRE e.created_at IS NOT NULL;

CREATE CONSTRAINT entity_created_by_exists IF NOT EXISTS
FOR (e:Entity) REQUIRE e.created_by IS NOT NULL;

// Type-Specific Required Properties
// ----------------------------------------------------------------------------
CREATE CONSTRAINT place_type_exists IF NOT EXISTS
FOR (p:Place) REQUIRE p.place_type IS NOT NULL;

CREATE CONSTRAINT text_type_exists IF NOT EXISTS
FOR (t:Text) REQUIRE t.text_type IS NOT NULL;

CREATE CONSTRAINT event_type_exists IF NOT EXISTS
FOR (e:Event) REQUIRE e.event_type IS NOT NULL;

CREATE CONSTRAINT concept_type_exists IF NOT EXISTS
FOR (c:Concept) REQUIRE c.concept_type IS NOT NULL;

CREATE CONSTRAINT institution_type_exists IF NOT EXISTS
FOR (i:Institution) REQUIRE i.institution_type IS NOT NULL;

CREATE CONSTRAINT deity_type_exists IF NOT EXISTS
FOR (d:Deity) REQUIRE d.deity_type IS NOT NULL;

CREATE CONSTRAINT lineage_type_exists IF NOT EXISTS
FOR (l:Lineage) REQUIRE l.lineage_type IS NOT NULL;

// ============================================================================
// SECTION 3: PROPERTY INDEXES (Single Property)
// ============================================================================

// Name Indexes
// ----------------------------------------------------------------------------
CREATE INDEX entity_canonical_name_index IF NOT EXISTS
FOR (e:Entity) ON (e.canonical_name);

CREATE INDEX entity_tibetan_name_index IF NOT EXISTS
FOR (e:Entity) ON (e.tibetan_name);

CREATE INDEX entity_wylie_name_index IF NOT EXISTS
FOR (e:Entity) ON (e.wylie_name);

// Temporal Indexes
// ----------------------------------------------------------------------------
CREATE INDEX person_birth_year_index IF NOT EXISTS
FOR (p:Person) ON (p.birth_year);

CREATE INDEX person_death_year_index IF NOT EXISTS
FOR (p:Person) ON (p.death_year);

CREATE INDEX text_composed_year_index IF NOT EXISTS
FOR (t:Text) ON (t.composed_year);

CREATE INDEX event_occurred_year_index IF NOT EXISTS
FOR (e:Event) ON (e.occurred_year);

CREATE INDEX institution_founded_year_index IF NOT EXISTS
FOR (i:Institution) ON (i.founded_year);

CREATE INDEX place_founded_year_index IF NOT EXISTS
FOR (p:Place) ON (p.founded_year);

// Type and Category Indexes
// ----------------------------------------------------------------------------
CREATE INDEX entity_type_index IF NOT EXISTS
FOR (e:Entity) ON (e.entity_type);

CREATE INDEX person_tradition_index IF NOT EXISTS
FOR (p:Person) ON (p.tradition);

CREATE INDEX person_roles_index IF NOT EXISTS
FOR (p:Person) ON (p.roles);

CREATE INDEX place_type_index IF NOT EXISTS
FOR (p:Place) ON (p.place_type);

CREATE INDEX place_region_index IF NOT EXISTS
FOR (p:Place) ON (p.region);

CREATE INDEX place_country_index IF NOT EXISTS
FOR (p:Place) ON (p.modern_country);

CREATE INDEX text_type_index IF NOT EXISTS
FOR (t:Text) ON (t.text_type);

CREATE INDEX text_language_index IF NOT EXISTS
FOR (t:Text) ON (t.language);

CREATE INDEX event_type_index IF NOT EXISTS
FOR (e:Event) ON (e.event_type);

CREATE INDEX concept_type_index IF NOT EXISTS
FOR (c:Concept) ON (c.concept_type);

CREATE INDEX institution_type_index IF NOT EXISTS
FOR (i:Institution) ON (i.institution_type);

CREATE INDEX deity_type_index IF NOT EXISTS
FOR (d:Deity) ON (d.deity_type);

CREATE INDEX lineage_type_index IF NOT EXISTS
FOR (l:Lineage) ON (l.lineage_type);

// Quality and Verification Indexes
// ----------------------------------------------------------------------------
CREATE INDEX entity_confidence_index IF NOT EXISTS
FOR (e:Entity) ON (e.confidence);

CREATE INDEX entity_verified_index IF NOT EXISTS
FOR (e:Entity) ON (e.verified);

CREATE INDEX entity_extraction_method_index IF NOT EXISTS
FOR (e:Entity) ON (e.extraction_method);

// Source Tracking Indexes
// ----------------------------------------------------------------------------
CREATE INDEX entity_source_document_index IF NOT EXISTS
FOR (e:Entity) ON (e.source_document_id);

CREATE INDEX entity_created_at_index IF NOT EXISTS
FOR (e:Entity) ON (e.created_at);

// ============================================================================
// SECTION 4: COMPOSITE INDEXES (Multi-Property)
// ============================================================================

// Date Range Queries
// ----------------------------------------------------------------------------
CREATE INDEX person_dates_composite IF NOT EXISTS
FOR (p:Person) ON (p.birth_year, p.death_year);

// Type + Quality Filters
// ----------------------------------------------------------------------------
CREATE INDEX entity_type_confidence_composite IF NOT EXISTS
FOR (e:Entity) ON (e.entity_type, e.confidence);

// Tradition + Temporal Queries
// ----------------------------------------------------------------------------
CREATE INDEX person_tradition_dates_composite IF NOT EXISTS
FOR (p:Person) ON (p.tradition, p.birth_year, p.death_year);

// Geographic Queries
// ----------------------------------------------------------------------------
CREATE INDEX place_coordinates_composite IF NOT EXISTS
FOR (p:Place) ON (p.latitude, p.longitude);

CREATE INDEX place_type_region_composite IF NOT EXISTS
FOR (p:Place) ON (p.place_type, p.region);

// Text Filtering
// ----------------------------------------------------------------------------
CREATE INDEX text_type_language_composite IF NOT EXISTS
FOR (t:Text) ON (t.text_type, t.language);

// Institution Filtering
// ----------------------------------------------------------------------------
CREATE INDEX institution_type_tradition_composite IF NOT EXISTS
FOR (i:Institution) ON (i.institution_type, i.tradition);

// ============================================================================
// SECTION 5: FULL-TEXT SEARCH INDEXES
// ============================================================================

// Entity Names (All Languages)
// ----------------------------------------------------------------------------
CREATE FULLTEXT INDEX entity_names_fulltext IF NOT EXISTS
FOR (e:Entity)
ON EACH [e.canonical_name, e.tibetan_name, e.wylie_name, e.phonetic_name, e.alternate_names];

// Person Biography and Titles
// ----------------------------------------------------------------------------
CREATE FULLTEXT INDEX person_biography_fulltext IF NOT EXISTS
FOR (p:Person)
ON EACH [p.biography, p.canonical_name, p.titles];

// Text Content (Topics and Practices)
// ----------------------------------------------------------------------------
CREATE FULLTEXT INDEX text_content_fulltext IF NOT EXISTS
FOR (t:Text)
ON EACH [t.canonical_name, t.topics, t.practices];

// Place Descriptions
// ----------------------------------------------------------------------------
CREATE FULLTEXT INDEX place_description_fulltext IF NOT EXISTS
FOR (p:Place)
ON EACH [p.canonical_name, p.description, p.significance];

// Concept Definitions
// ----------------------------------------------------------------------------
CREATE FULLTEXT INDEX concept_definition_fulltext IF NOT EXISTS
FOR (c:Concept)
ON EACH [c.canonical_name, c.short_definition, c.sanskrit_term, c.pali_term];

// ============================================================================
// SECTION 6: RELATIONSHIP CONSTRAINTS
// ============================================================================

// Relationship ID Uniqueness
// ----------------------------------------------------------------------------
CREATE CONSTRAINT teacher_of_id_unique IF NOT EXISTS
FOR ()-[r:TEACHER_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT student_of_id_unique IF NOT EXISTS
FOR ()-[r:STUDENT_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT wrote_id_unique IF NOT EXISTS
FOR ()-[r:WROTE]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT lived_at_id_unique IF NOT EXISTS
FOR ()-[r:LIVED_AT]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT incarnation_of_id_unique IF NOT EXISTS
FOR ()-[r:INCARNATION_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT translated_id_unique IF NOT EXISTS
FOR ()-[r:TRANSLATED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT compiled_id_unique IF NOT EXISTS
FOR ()-[r:COMPILED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT visited_id_unique IF NOT EXISTS
FOR ()-[r:VISITED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT founded_id_unique IF NOT EXISTS
FOR ()-[r:FOUNDED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT born_in_id_unique IF NOT EXISTS
FOR ()-[r:BORN_IN]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT died_in_id_unique IF NOT EXISTS
FOR ()-[r:DIED_IN]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT attended_id_unique IF NOT EXISTS
FOR ()-[r:ATTENDED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT organized_id_unique IF NOT EXISTS
FOR ()-[r:ORGANIZED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT sponsored_id_unique IF NOT EXISTS
FOR ()-[r:SPONSORED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT member_of_id_unique IF NOT EXISTS
FOR ()-[r:MEMBER_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT abbot_of_id_unique IF NOT EXISTS
FOR ()-[r:ABBOT_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT patron_of_id_unique IF NOT EXISTS
FOR ()-[r:PATRON_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT commentary_on_id_unique IF NOT EXISTS
FOR ()-[r:COMMENTARY_ON]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT cites_id_unique IF NOT EXISTS
FOR ()-[r:CITES]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT part_of_id_unique IF NOT EXISTS
FOR ()-[r:PART_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT contains_id_unique IF NOT EXISTS
FOR ()-[r:CONTAINS]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT mentions_id_unique IF NOT EXISTS
FOR ()-[r:MENTIONS]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT received_transmission_id_unique IF NOT EXISTS
FOR ()-[r:RECEIVED_TRANSMISSION]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT gave_empowerment_id_unique IF NOT EXISTS
FOR ()-[r:GAVE_EMPOWERMENT]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT transmitted_to_id_unique IF NOT EXISTS
FOR ()-[r:TRANSMITTED_TO]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT debated_with_id_unique IF NOT EXISTS
FOR ()-[r:DEBATED_WITH]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT refuted_id_unique IF NOT EXISTS
FOR ()-[r:REFUTED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT agreed_with_id_unique IF NOT EXISTS
FOR ()-[r:AGREED_WITH]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT parent_of_id_unique IF NOT EXISTS
FOR ()-[r:PARENT_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT child_of_id_unique IF NOT EXISTS
FOR ()-[r:CHILD_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT sibling_of_id_unique IF NOT EXISTS
FOR ()-[r:SIBLING_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT spouse_of_id_unique IF NOT EXISTS
FOR ()-[r:SPOUSE_OF]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT within_id_unique IF NOT EXISTS
FOR ()-[r:WITHIN]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT near_id_unique IF NOT EXISTS
FOR ()-[r:NEAR]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT practiced_id_unique IF NOT EXISTS
FOR ()-[r:PRACTICED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT held_view_id_unique IF NOT EXISTS
FOR ()-[r:HELD_VIEW]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT taught_concept_id_unique IF NOT EXISTS
FOR ()-[r:TAUGHT_CONCEPT]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT preceded_id_unique IF NOT EXISTS
FOR ()-[r:PRECEDED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT followed_id_unique IF NOT EXISTS
FOR ()-[r:FOLLOWED]-() REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT contemporary_with_id_unique IF NOT EXISTS
FOR ()-[r:CONTEMPORARY_WITH]-() REQUIRE r.id IS UNIQUE;

// Relationship Required Properties
// ----------------------------------------------------------------------------
CREATE CONSTRAINT teacher_of_confidence_exists IF NOT EXISTS
FOR ()-[r:TEACHER_OF]-() REQUIRE r.confidence IS NOT NULL;

CREATE CONSTRAINT teacher_of_created_at_exists IF NOT EXISTS
FOR ()-[r:TEACHER_OF]-() REQUIRE r.created_at IS NOT NULL;

// ============================================================================
// SECTION 7: VERIFICATION QUERIES
// ============================================================================

// Check that all constraints were created successfully
// Run these queries manually after script execution:

// List all constraints
// SHOW CONSTRAINTS;

// List all indexes
// SHOW INDEXES;

// Count constraints by type
// SHOW CONSTRAINTS YIELD type, entityType
// RETURN type, count(*) as count
// ORDER BY count DESC;

// Verify specific constraint exists
// SHOW CONSTRAINTS WHERE name = 'entity_id_unique';

// ============================================================================
// SECTION 8: CLEANUP SCRIPT (Use with Caution)
// ============================================================================
// Uncomment the following section if you need to drop all schema

/*
// WARNING: This will drop ALL constraints and indexes
// Use only for schema reset during development

// Drop all constraints
DROP CONSTRAINT entity_id_unique IF EXISTS;
DROP CONSTRAINT person_id_unique IF EXISTS;
DROP CONSTRAINT place_id_unique IF EXISTS;
DROP CONSTRAINT text_id_unique IF EXISTS;
DROP CONSTRAINT event_id_unique IF EXISTS;
DROP CONSTRAINT concept_id_unique IF EXISTS;
DROP CONSTRAINT institution_id_unique IF EXISTS;
DROP CONSTRAINT deity_id_unique IF EXISTS;
DROP CONSTRAINT lineage_id_unique IF EXISTS;

DROP CONSTRAINT entity_canonical_name_exists IF EXISTS;
DROP CONSTRAINT entity_type_exists IF EXISTS;
DROP CONSTRAINT entity_confidence_exists IF EXISTS;
DROP CONSTRAINT entity_verified_exists IF EXISTS;
DROP CONSTRAINT entity_extraction_method_exists IF EXISTS;
DROP CONSTRAINT entity_created_at_exists IF EXISTS;
DROP CONSTRAINT entity_created_by_exists IF EXISTS;

DROP CONSTRAINT place_type_exists IF EXISTS;
DROP CONSTRAINT text_type_exists IF EXISTS;
DROP CONSTRAINT event_type_exists IF EXISTS;
DROP CONSTRAINT concept_type_exists IF EXISTS;
DROP CONSTRAINT institution_type_exists IF EXISTS;
DROP CONSTRAINT deity_type_exists IF EXISTS;
DROP CONSTRAINT lineage_type_exists IF EXISTS;

// Drop all indexes (non-constraint indexes)
DROP INDEX entity_canonical_name_index IF EXISTS;
DROP INDEX entity_tibetan_name_index IF EXISTS;
DROP INDEX entity_wylie_name_index IF EXISTS;
DROP INDEX person_birth_year_index IF EXISTS;
DROP INDEX person_death_year_index IF EXISTS;
DROP INDEX text_composed_year_index IF EXISTS;
DROP INDEX event_occurred_year_index IF EXISTS;
DROP INDEX institution_founded_year_index IF EXISTS;
DROP INDEX place_founded_year_index IF EXISTS;
DROP INDEX entity_type_index IF EXISTS;
DROP INDEX person_tradition_index IF EXISTS;
DROP INDEX person_roles_index IF EXISTS;
DROP INDEX place_type_index IF EXISTS;
DROP INDEX place_region_index IF EXISTS;
DROP INDEX place_country_index IF EXISTS;
DROP INDEX text_type_index IF EXISTS;
DROP INDEX text_language_index IF EXISTS;
DROP INDEX event_type_index IF EXISTS;
DROP INDEX concept_type_index IF EXISTS;
DROP INDEX institution_type_index IF EXISTS;
DROP INDEX deity_type_index IF EXISTS;
DROP INDEX lineage_type_index IF EXISTS;
DROP INDEX entity_confidence_index IF EXISTS;
DROP INDEX entity_verified_index IF EXISTS;
DROP INDEX entity_extraction_method_index IF EXISTS;
DROP INDEX entity_source_document_index IF EXISTS;
DROP INDEX entity_created_at_index IF EXISTS;
DROP INDEX person_dates_composite IF EXISTS;
DROP INDEX entity_type_confidence_composite IF EXISTS;
DROP INDEX person_tradition_dates_composite IF EXISTS;
DROP INDEX place_coordinates_composite IF EXISTS;
DROP INDEX place_type_region_composite IF EXISTS;
DROP INDEX text_type_language_composite IF EXISTS;
DROP INDEX institution_type_tradition_composite IF EXISTS;
DROP INDEX entity_names_fulltext IF EXISTS;
DROP INDEX person_biography_fulltext IF EXISTS;
DROP INDEX text_content_fulltext IF EXISTS;
DROP INDEX place_description_fulltext IF EXISTS;
DROP INDEX concept_definition_fulltext IF EXISTS;

// Drop all relationship constraints
DROP CONSTRAINT teacher_of_id_unique IF EXISTS;
DROP CONSTRAINT student_of_id_unique IF EXISTS;
DROP CONSTRAINT wrote_id_unique IF EXISTS;
DROP CONSTRAINT lived_at_id_unique IF EXISTS;
DROP CONSTRAINT incarnation_of_id_unique IF EXISTS;
// ... (add all other relationship constraints)

*/

// ============================================================================
// SCHEMA CREATION COMPLETE
// ============================================================================
//
// Next Steps:
// 1. Verify schema: SHOW CONSTRAINTS; SHOW INDEXES;
// 2. Load data from PostgreSQL
// 3. Create vector embeddings (optional)
// 4. Test queries
//
// ============================================================================
