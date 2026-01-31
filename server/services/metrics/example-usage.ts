/**
 * ExtractionMetrics Usage Examples
 *
 * Demonstrates how to use the ExtractionMetrics service to track
 * and analyze entity extraction quality and performance.
 */

import { db } from '@db/index';
import { getTables } from '@db/config';
import { createExtractionMetrics } from './ExtractionMetrics';
import type { ExtractionResult } from '../knowledgeGraph/EntityExtractor';

const tables = getTables();
const metricsService = createExtractionMetrics(db, tables);

// ============================================================================
// Example 1: Recording Extraction Metrics
// ============================================================================

async function recordExtractionExample() {
  // Simulate an extraction result
  const extractionResult: ExtractionResult = {
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    translationId: 1,
    entities: [
      {
        id: 'entity-1',
        type: 'person',
        canonicalName: 'Sakya Pandita',
        names: {
          tibetan: ['ས་སྐྱ་པཎྜི་ཏ་'],
          english: ['Sakya Pandita'],
          phonetic: ['Sakya Pandita'],
          wylie: ['sa skya paN+Di ta'],
        },
        attributes: {},
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
      },
      // ... more entities
    ],
    relationships: [],
    ambiguities: [],
    statistics: {
      entityCount: 5,
      relationshipCount: 3,
      averageConfidence: 0.87,
      extractionTime: 2500,
      llmProvider: 'gemini-2.0-flash-exp',
    },
    success: true,
  };

  // Record the metrics
  await metricsService.recordExtraction(extractionResult);
  console.log('✅ Metrics recorded successfully');
}

// ============================================================================
// Example 2: Getting Aggregate Metrics
// ============================================================================

async function getAggregateMetricsExample() {
  // Get metrics for the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const metrics = await metricsService.getAggregateMetrics({
    start: sevenDaysAgo,
    end: now,
  });

  console.log('📊 Aggregate Metrics (Last 7 Days):');
  console.log('  Total Extractions:', metrics.totalExtractions);
  console.log('  Total Entities:', metrics.totalEntities);
  console.log('  Total Relationships:', metrics.totalRelationships);
  console.log('  Average Confidence:', metrics.avgConfidence.toFixed(2));
  console.log('  Average Processing Time:', `${metrics.avgProcessingTime.toFixed(0)}ms`);
  console.log('\n  Entity Type Breakdown:');
  console.log('    - Persons:', metrics.entityTypeBreakdown.person);
  console.log('    - Places:', metrics.entityTypeBreakdown.place);
  console.log('    - Texts:', metrics.entityTypeBreakdown.text);
  console.log('    - Events:', metrics.entityTypeBreakdown.event);
  console.log('\n  Confidence Distribution:');
  console.log('    - High (0.8-1.0):', metrics.confidenceBreakdown.high);
  console.log('    - Medium (0.6-0.8):', metrics.confidenceBreakdown.medium);
  console.log('    - Low (0.0-0.6):', metrics.confidenceBreakdown.low);
  console.log('\n  Trends Over Time:');
  metrics.trendsOverTime.forEach(trend => {
    console.log(`    ${trend.date}:`);
    console.log(`      Extractions: ${trend.extractions}`);
    console.log(`      Avg Confidence: ${trend.avgConfidence.toFixed(2)}`);
    console.log(`      Avg Time: ${trend.avgProcessingTime.toFixed(0)}ms`);
  });
}

// ============================================================================
// Example 3: Getting Quality Report
// ============================================================================

async function getQualityReportExample() {
  const report = await metricsService.getExtractionQualityReport();

  console.log('🔍 Quality Report:');
  console.log('  Overall Health Score:', `${report.overallHealthScore.toFixed(1)}/100`);
  console.log('  Entities Needing Review:', report.needsReview);
  console.log('  Ready for Verification:', report.readyForVerification);
  console.log('  Potential Contradictions:', report.potentialContradictions);

  if (report.lowConfidenceEntities.length > 0) {
    console.log('\n  ⚠️ Low Confidence Entities (<0.7):');
    report.lowConfidenceEntities.slice(0, 5).forEach(entity => {
      console.log(`    - ${entity.canonicalName} (${entity.type})`);
      console.log(`      Confidence: ${entity.confidence.toFixed(2)}`);
    });
  }

  if (report.highConfidenceUnverified.length > 0) {
    console.log('\n  ✨ High Confidence Unverified (>0.9):');
    report.highConfidenceUnverified.slice(0, 5).forEach(entity => {
      console.log(`    - ${entity.canonicalName} (${entity.type})`);
      console.log(`      Confidence: ${entity.confidence.toFixed(2)}`);
    });
  }

  if (report.contradictions.length > 0) {
    console.log('\n  ⚡ Detected Contradictions:');
    report.contradictions.slice(0, 5).forEach(contradiction => {
      console.log(`    - Type: ${contradiction.type}`);
      console.log(`      Issue: ${contradiction.issue}`);
      console.log(`      Entities: ${contradiction.entity1Name} vs ${contradiction.entity2Name}`);
    });
  }
}

// ============================================================================
// Example 4: Monitoring Dashboard
// ============================================================================

async function monitoringDashboardExample() {
  console.log('📈 Extraction Monitoring Dashboard\n');

  // Get today's metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayMetrics = await metricsService.getAggregateMetrics({
    start: today,
    end: tomorrow,
  });

  console.log('Today\'s Performance:');
  console.log('  Extractions:', todayMetrics.totalExtractions);
  console.log('  Avg Processing Time:', `${todayMetrics.avgProcessingTime.toFixed(0)}ms`);
  console.log('  Avg Confidence:', todayMetrics.avgConfidence.toFixed(2));

  // Get quality report
  const qualityReport = await metricsService.getExtractionQualityReport();
  console.log('\nCurrent Quality Status:');
  console.log('  Health Score:', `${qualityReport.overallHealthScore.toFixed(1)}/100`);
  console.log('  Pending Reviews:', qualityReport.needsReview);
  console.log('  Contradictions:', qualityReport.potentialContradictions);

  // Determine action items
  console.log('\n🎯 Action Items:');
  if (qualityReport.needsReview > 10) {
    console.log('  - Review low confidence entities (priority: HIGH)');
  }
  if (qualityReport.potentialContradictions > 0) {
    console.log('  - Resolve contradictions (priority: HIGH)');
  }
  if (qualityReport.readyForVerification > 0) {
    console.log('  - Verify high confidence entities (priority: MEDIUM)');
  }
  if (todayMetrics.avgProcessingTime > 5000) {
    console.log('  - Investigate performance issues (priority: MEDIUM)');
  }
}

// ============================================================================
// Run Examples
// ============================================================================

export async function runExamples() {
  try {
    console.log('🚀 Running ExtractionMetrics Examples\n');
    console.log('=' .repeat(60));

    await recordExtractionExample();
    console.log('\n' + '='.repeat(60));

    await getAggregateMetricsExample();
    console.log('\n' + '='.repeat(60));

    await getQualityReportExample();
    console.log('\n' + '='.repeat(60));

    await monitoringDashboardExample();
    console.log('\n' + '='.repeat(60));

    console.log('\n✅ All examples completed successfully');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Uncomment to run examples:
// runExamples();
