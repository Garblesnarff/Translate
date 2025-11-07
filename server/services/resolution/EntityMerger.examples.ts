/**
 * Entity Merger Examples
 *
 * Practical examples demonstrating entity merging workflows
 *
 * @examples
 * - Merging duplicate person entities
 * - Previewing merges before committing
 * - Handling conflicts manually
 * - Rolling back merges
 * - Batch merging multiple duplicates
 */

import { EntityMerger } from './EntityMerger';
import type { PersonEntity, PlaceEntity } from '../../types/entities';

// ============================================================================
// Example 1: Basic Entity Merge
// ============================================================================

async function example1_basicMerge() {
  console.log('\n=== Example 1: Basic Entity Merge ===\n');

  const merger = new EntityMerger();

  // Two entities that are clearly the same person
  const marpa1: PersonEntity = {
    id: 'marpa-001',
    type: 'person',
    canonicalName: 'Marpa Lotsawa',
    names: {
      tibetan: ['མར་པ་ལོ་ཙཱ་བ'],
      english: ['Marpa the Translator'],
      phonetic: ['Marpa Lotsawa'],
      wylie: ['mar pa lo tsa ba'],
    },
    attributes: {
      titles: ['Lotsawa', 'Marpa the Translator'],
      roles: ['translator', 'teacher'],
      tradition: ['Kagyu'],
      gender: 'male',
      biography: 'One of the founders of the Kagyu lineage',
    },
    dates: {
      birth: {
        year: 1012,
        precision: 'circa',
        confidence: 0.8,
      },
      death: {
        year: 1097,
        precision: 'circa',
        confidence: 0.8,
      },
    },
    confidence: 0.9,
    verified: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: 'curator-1',
    verifiedBy: 'curator-1',
    verifiedAt: new Date('2024-01-15'),
  };

  const marpa2: PersonEntity = {
    id: 'marpa-002',
    type: 'person',
    canonicalName: 'Mar-pa',
    names: {
      tibetan: [],
      english: ['Marpa', 'Marpa of Lhodrak'],
      phonetic: ['Mar-pa'],
      wylie: ['mar pa'],
    },
    attributes: {
      roles: ['yogi', 'teacher'],
      affiliations: ['Kagyu Lineage'],
      alternateNames: ['Marpa of Lhodrak'],
    },
    dates: {
      birth: {
        year: 1012,
        precision: 'exact',
        confidence: 0.95,
        source: 'The Life of Marpa',
      },
    },
    confidence: 0.75,
    verified: false,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    createdBy: 'ai',
  };

  try {
    // Merge the entities
    const result = await merger.mergeEntities('marpa-001', 'marpa-002', {
      conflictStrategy: 'highest_confidence',
      mergedBy: 'curator-2',
      notes: 'Merging duplicate Marpa entities found in different source texts',
    });

    console.log('✓ Merge successful!');
    console.log(`  Merged entity ID: ${result.mergedEntityId}`);
    console.log(`  Duplicate entity ID: ${result.duplicateEntityId}`);
    console.log(`  Relationships updated: ${result.relationshipsUpdated}`);
    console.log(`  Conflicts resolved: ${result.conflictsResolved.length}`);
    console.log(`  Final confidence: ${result.mergedEntity.confidence.toFixed(2)}`);

    if (result.warnings && result.warnings.length > 0) {
      console.log('\n  Warnings:');
      result.warnings.forEach(w => console.log(`    - ${w}`));
    }

    console.log('\n  Merged entity names:');
    console.log(`    Canonical: ${result.mergedEntity.canonicalName}`);
    console.log(`    English: ${result.mergedEntity.names.english.join(', ')}`);
    console.log(`    Tibetan: ${result.mergedEntity.names.tibetan.join(', ')}`);

    if (result.conflictsResolved.length > 0) {
      console.log('\n  Conflicts resolved:');
      result.conflictsResolved.forEach(conflict => {
        console.log(`    - ${conflict.attribute}: ${conflict.strategy}`);
        console.log(`      Reason: ${conflict.reason}`);
      });
    }
  } catch (error) {
    console.error('✗ Merge failed:', error);
  }
}

// ============================================================================
// Example 2: Preview Merge Before Committing
// ============================================================================

async function example2_previewMerge() {
  console.log('\n=== Example 2: Preview Merge Before Committing ===\n');

  const merger = new EntityMerger();

  try {
    // Preview what the merge would produce
    const preview = await merger.previewMerge('entity-123', 'entity-456');

    console.log('Merge Preview:');
    console.log(`  Combined name: ${preview.combinedEntity.canonicalName}`);
    console.log(`  Estimated confidence: ${preview.estimatedConfidence.toFixed(2)}`);
    console.log(`  Relationships to update: ${preview.relationshipsToUpdate}`);
    console.log(`  Extraction jobs to update: ${preview.extractionJobsToUpdate}`);
    console.log(`  Conflicts detected: ${preview.conflicts.length}`);

    console.log('\n  Quality Assessment:');
    console.log(`    Data completeness: ${(preview.qualityAssessment.dataCompleteness * 100).toFixed(0)}%`);
    console.log(`    Consistency score: ${(preview.qualityAssessment.consistencyScore * 100).toFixed(0)}%`);
    console.log(`    Source reliability: ${(preview.qualityAssessment.sourceReliability * 100).toFixed(0)}%`);

    if (preview.conflicts.length > 0) {
      console.log('\n  Conflicts:');
      preview.conflicts.forEach(conflict => {
        console.log(`    [${conflict.severity.toUpperCase()}] ${conflict.attribute}`);
        console.log(`      Primary: ${JSON.stringify(conflict.primaryValue)}`);
        console.log(`      Duplicate: ${JSON.stringify(conflict.duplicateValue)}`);
        console.log(`      Recommendation: ${conflict.recommendation}`);
      });

      // Curator decides whether to proceed
      const highSeverityConflicts = preview.conflicts.filter(c => c.severity === 'high');
      if (highSeverityConflicts.length > 0) {
        console.log(`\n  ⚠ Warning: ${highSeverityConflicts.length} high-severity conflicts detected`);
        console.log('  Consider manual review before merging');
      } else {
        console.log('\n  ✓ Safe to proceed with automatic merge');
      }
    }
  } catch (error) {
    console.error('✗ Preview failed:', error);
  }
}

// ============================================================================
// Example 3: Manual Conflict Resolution
// ============================================================================

async function example3_manualConflictResolution() {
  console.log('\n=== Example 3: Manual Conflict Resolution ===\n');

  const merger = new EntityMerger();

  // First, preview to see conflicts
  const preview = await merger.previewMerge('tsongkhapa-001', 'tsongkhapa-002');

  console.log(`Found ${preview.conflicts.length} conflicts requiring manual resolution`);

  // Curator reviews conflicts and makes decisions
  const manualResolutions: Record<string, any> = {};

  preview.conflicts.forEach(conflict => {
    console.log(`\nResolving conflict for: ${conflict.attribute}`);
    console.log(`  Primary: ${JSON.stringify(conflict.primaryValue)}`);
    console.log(`  Duplicate: ${JSON.stringify(conflict.duplicateValue)}`);

    // Curator chooses which value to keep
    // In a real UI, this would be an interactive choice
    if (conflict.severity === 'high') {
      // For high severity, prefer higher confidence
      if ((conflict.primaryConfidence || 0) > (conflict.duplicateConfidence || 0)) {
        manualResolutions[conflict.attribute] = conflict.primaryValue;
        console.log(`  Decision: Keep primary (higher confidence)`);
      } else {
        manualResolutions[conflict.attribute] = conflict.duplicateValue;
        console.log(`  Decision: Keep duplicate (higher confidence)`);
      }
    } else {
      // For low/medium severity, keep primary by default
      manualResolutions[conflict.attribute] = conflict.primaryValue;
      console.log(`  Decision: Keep primary (default)`);
    }
  });

  try {
    // Perform merge with manual resolutions
    const result = await merger.mergeEntities('tsongkhapa-001', 'tsongkhapa-002', {
      conflictStrategy: 'manual',
      manualResolutions,
      mergedBy: 'curator-3',
      notes: 'Manually reviewed and resolved all conflicts',
    });

    console.log('\n✓ Merge with manual resolutions successful!');
    console.log(`  Conflicts manually resolved: ${result.conflictsResolved.length}`);
  } catch (error) {
    console.error('✗ Merge failed:', error);
  }
}

// ============================================================================
// Example 4: Rollback a Merge
// ============================================================================

async function example4_rollbackMerge() {
  console.log('\n=== Example 4: Rollback a Merge ===\n');

  const merger = new EntityMerger();

  // First perform a merge
  const result = await merger.mergeEntities('entity-111', 'entity-222', {
    conflictStrategy: 'highest_confidence',
    softDelete: true, // Required for rollback
    mergedBy: 'curator-4',
  });

  console.log(`✓ Merge completed with history ID: ${result.mergeHistoryId}`);

  // Later, curator decides the merge was wrong
  console.log('\nCurator decides to undo the merge...');

  try {
    const rollbackSuccess = await merger.undoMerge(result.mergeHistoryId);

    if (rollbackSuccess) {
      console.log('✓ Merge successfully rolled back');
      console.log('  Both entities restored to original state');
      console.log('  Relationships reverted');
    }
  } catch (error) {
    console.error('✗ Rollback failed:', error);
  }
}

// ============================================================================
// Example 5: Batch Merge Multiple Duplicates
// ============================================================================

async function example5_batchMerge() {
  console.log('\n=== Example 5: Batch Merge Multiple Duplicates ===\n');

  const merger = new EntityMerger();

  // Array of duplicate pairs identified by duplicate detection system
  const duplicatePairs = [
    { primary: 'person-001', duplicate: 'person-101' },
    { primary: 'person-002', duplicate: 'person-102' },
    { primary: 'person-003', duplicate: 'person-103' },
    { primary: 'place-001', duplicate: 'place-101' },
    { primary: 'place-002', duplicate: 'place-102' },
  ];

  const results = {
    successful: 0,
    failed: 0,
    totalConflicts: 0,
  };

  console.log(`Processing ${duplicatePairs.length} merge operations...`);

  for (const pair of duplicatePairs) {
    try {
      // Preview first to check for high-severity conflicts
      const preview = await merger.previewMerge(pair.primary, pair.duplicate);
      const highConflicts = preview.conflicts.filter(c => c.severity === 'high');

      if (highConflicts.length > 0) {
        console.log(`  ⚠ Skipping ${pair.primary} ↔ ${pair.duplicate} (${highConflicts.length} high-severity conflicts)`);
        results.failed++;
        continue;
      }

      // Proceed with merge
      const result = await merger.mergeEntities(pair.primary, pair.duplicate, {
        conflictStrategy: 'highest_confidence',
        mergedBy: 'batch-process',
      });

      console.log(`  ✓ Merged ${pair.primary} ↔ ${pair.duplicate} (${result.conflictsResolved.length} conflicts)`);
      results.successful++;
      results.totalConflicts += result.conflictsResolved.length;
    } catch (error) {
      console.log(`  ✗ Failed to merge ${pair.primary} ↔ ${pair.duplicate}: ${error}`);
      results.failed++;
    }
  }

  console.log('\nBatch Merge Results:');
  console.log(`  Successful: ${results.successful}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total conflicts resolved: ${results.totalConflicts}`);
  console.log(`  Success rate: ${((results.successful / duplicatePairs.length) * 100).toFixed(1)}%`);
}

// ============================================================================
// Example 6: Merging with Complex Attribute Conflicts
// ============================================================================

async function example6_complexAttributeMerge() {
  console.log('\n=== Example 6: Merging with Complex Attribute Conflicts ===\n');

  const merger = new EntityMerger();

  const sakya1: PlaceEntity = {
    id: 'sakya-main',
    type: 'place',
    canonicalName: 'Sakya Monastery',
    names: {
      tibetan: ['ས་སྐྱ་དགོན་པ'],
      english: ['Sakya Monastery', 'Sakya'],
      phonetic: ['Sakya Gon'],
      wylie: ['sa skya dgon pa'],
    },
    attributes: {
      placeType: 'monastery',
      region: 'Tsang',
      modernCountry: 'Tibet (China)',
      coordinates: {
        latitude: 28.9,
        longitude: 88.0,
        accuracy: 1000,
        source: 'GPS survey 2010',
      },
      significance: [
        'Seat of Sakya tradition',
        'Founded by Khon Konchok Gyalpo',
      ],
    },
    dates: {
      founded: {
        year: 1073,
        precision: 'exact',
        confidence: 0.95,
        source: 'Blue Annals',
      },
    },
    confidence: 0.95,
    verified: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: 'curator-1',
  };

  const sakya2: PlaceEntity = {
    id: 'sakya-dup',
    type: 'place',
    canonicalName: 'Sakya',
    names: {
      tibetan: ['ས་སྐྱ'],
      english: ['Sakya', 'Grey Earth Monastery'],
      phonetic: ['Sakya'],
      wylie: ['sa skya'],
      sanskrit: ['Sakya'],
    },
    attributes: {
      placeType: 'monastery',
      region: 'Tsang',
      coordinates: {
        latitude: 28.901, // Slightly different
        longitude: 88.002,
        accuracy: 500, // More precise
        source: 'Satellite imagery 2020',
      },
      significance: [
        'One of the four major schools of Tibetan Buddhism',
        'UNESCO World Heritage Site candidate',
      ],
      description: 'Historic monastery complex in southern Tibet',
    },
    dates: {
      founded: {
        year: 1073,
        precision: 'exact',
        confidence: 0.9,
      },
      rebuilt: {
        year: 1980,
        precision: 'exact',
        confidence: 1.0,
        source: 'Modern records',
      },
    },
    confidence: 0.85,
    verified: false,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
    createdBy: 'ai',
  };

  try {
    const result = await merger.mergeEntities('sakya-main', 'sakya-dup', {
      conflictStrategy: 'highest_confidence',
      mergedBy: 'curator-5',
    });

    console.log('✓ Complex merge successful!');
    console.log('\nMerged place attributes:');
    console.log(`  Name: ${result.mergedEntity.canonicalName}`);
    console.log(`  English names: ${result.mergedEntity.names.english.join(', ')}`);

    const attrs = result.mergedEntity.attributes as any;
    console.log(`\n  Coordinates:`);
    console.log(`    Latitude: ${attrs.coordinates.latitude}`);
    console.log(`    Longitude: ${attrs.coordinates.longitude}`);
    console.log(`    Accuracy: ${attrs.coordinates.accuracy}m`);
    console.log(`    Source: ${attrs.coordinates.source}`);

    console.log(`\n  Significance (${attrs.significance.length} entries):`);
    attrs.significance.forEach((s: string) => console.log(`    - ${s}`));

    console.log(`\n  Dates:`);
    if (result.mergedEntity.dates) {
      const dates = result.mergedEntity.dates as Record<string, any>;
      if (dates.founded) {
        console.log(`    Founded: ${dates.founded.year}`);
      }
      if (dates.rebuilt) {
        console.log(`    Rebuilt: ${dates.rebuilt.year}`);
      }
    }
  } catch (error) {
    console.error('✗ Merge failed:', error);
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Entity Merger Service - Usage Examples            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Note: These are demonstrations - in production you'd connect to real database
  console.log('\n⚠ Note: These examples require a database connection');
  console.log('Run individual examples after setting up your database.\n');

  // Uncomment to run individual examples:
  // await example1_basicMerge();
  // await example2_previewMerge();
  // await example3_manualConflictResolution();
  // await example4_rollbackMerge();
  // await example5_batchMerge();
  // await example6_complexAttributeMerge();
}

// Export examples for use in docs/tests
export {
  example1_basicMerge,
  example2_previewMerge,
  example3_manualConflictResolution,
  example4_rollbackMerge,
  example5_batchMerge,
  example6_complexAttributeMerge,
  runAllExamples,
};

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
