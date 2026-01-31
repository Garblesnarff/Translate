/**
 * Example: Running Confidence Calibration
 *
 * This example demonstrates how to run the confidence calibration system
 * to evaluate entity extraction quality.
 *
 * NOTE: This requires EntityExtractor.extractFromText to be implemented first.
 */

import { ConfidenceCalibrator } from '../server/services/extraction/ConfidenceCalibrator';
import { EntityExtractor } from '../server/services/knowledgeGraph/EntityExtractor';

/**
 * Run full calibration and print results
 */
async function runCalibration() {
  console.log('Starting confidence calibration...\n');

  const calibrator = new ConfidenceCalibrator();
  const extractor = new EntityExtractor();

  try {
    // Run calibration on all 75 test cases
    const report = await calibrator.calibrate(extractor);

    // Print human-readable report
    calibrator.printReport(report);

    // Access specific metrics programmatically
    console.log('\n=== Key Metrics ===');
    console.log('Overall Pass Rate:', (report.overall.passRate * 100).toFixed(1) + '%');
    console.log('Average F1 Score:', (report.overall.avgF1 * 100).toFixed(1) + '%');
    console.log('Confidence Accuracy:', (report.overall.avgConfidenceAccuracy * 100).toFixed(1) + '%');

    console.log('\n=== By Difficulty ===');
    console.log('Easy:', (report.byDifficulty.easy.passRate * 100).toFixed(1) + '% pass rate');
    console.log('Medium:', (report.byDifficulty.medium.passRate * 100).toFixed(1) + '% pass rate');
    console.log('Hard:', (report.byDifficulty.hard.passRate * 100).toFixed(1) + '% pass rate');

    console.log('\n=== By Entity Type ===');
    for (const [type, stats] of Object.entries(report.byEntityType)) {
      console.log(`${type}:`, `F1=${(stats.f1 * 100).toFixed(1)}%`);
    }

    // Check if ready for production
    const isProductionReady = report.overall.passRate >= 0.85 &&
                              report.byDifficulty.easy.passRate >= 0.90 &&
                              report.overall.avgConfidenceAccuracy >= 0.85;

    console.log('\n=== Production Readiness ===');
    if (isProductionReady) {
      console.log('✓ READY FOR PRODUCTION');
    } else {
      console.log('✗ NOT READY FOR PRODUCTION');
      console.log('\nMissing criteria:');
      if (report.overall.passRate < 0.85) {
        console.log('  - Overall pass rate below 85%');
      }
      if (report.byDifficulty.easy.passRate < 0.90) {
        console.log('  - Easy cases pass rate below 90%');
      }
      if (report.overall.avgConfidenceAccuracy < 0.85) {
        console.log('  - Confidence accuracy below 85%');
      }
    }

  } catch (error) {
    console.error('Calibration failed:', error);
    process.exit(1);
  }
}

/**
 * Example: Analyzing specific failed cases
 */
async function analyzeFailedCases() {
  const calibrator = new ConfidenceCalibrator();
  const extractor = new EntityExtractor();

  const report = await calibrator.calibrate(extractor);

  console.log('\n=== Detailed Analysis of Failed Cases ===\n');

  for (const failed of report.failedCases.slice(0, 5)) {
    console.log(`Test Case: ${failed.testCaseId} (${failed.difficulty})`);
    console.log(`  Precision: ${(failed.precision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(failed.recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score: ${(failed.f1 * 100).toFixed(1)}%`);
    console.log(`  Entities: ${failed.correctMatches}/${failed.expectedEntities} correct (extracted ${failed.extractedEntities})`);

    if (failed.failures) {
      console.log(`  Issues:`);
      for (const issue of failed.failures) {
        console.log(`    - ${issue}`);
      }
    }

    if (failed.notes) {
      console.log(`  Notes: ${failed.notes}`);
    }

    console.log('');
  }
}

/**
 * Example: Comparing calibration runs over time
 */
interface CalibrationHistory {
  date: Date;
  avgF1: number;
  passRate: number;
  avgConfidenceAccuracy: number;
}

async function trackCalibrationProgress(history: CalibrationHistory[]) {
  const calibrator = new ConfidenceCalibrator();
  const extractor = new EntityExtractor();

  const report = await calibrator.calibrate(extractor);

  // Add to history
  history.push({
    date: report.calibrationDate,
    avgF1: report.overall.avgF1,
    passRate: report.overall.passRate,
    avgConfidenceAccuracy: report.overall.avgConfidenceAccuracy,
  });

  // Show trend
  console.log('\n=== Calibration Progress ===\n');
  console.log('Date                  | Pass Rate | F1 Score | Confidence');
  console.log('-'.repeat(65));

  for (const entry of history.slice(-10)) {
    const date = entry.date.toISOString().substring(0, 10);
    const passRate = (entry.passRate * 100).toFixed(1) + '%';
    const f1 = (entry.avgF1 * 100).toFixed(1) + '%';
    const conf = (entry.avgConfidenceAccuracy * 100).toFixed(1) + '%';

    console.log(`${date}       | ${passRate.padEnd(9)} | ${f1.padEnd(8)} | ${conf}`);
  }

  // Calculate trend
  if (history.length >= 2) {
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];

    const f1Change = ((latest.avgF1 - previous.avgF1) * 100).toFixed(1);
    const trend = parseFloat(f1Change) > 0 ? '↑' : parseFloat(f1Change) < 0 ? '↓' : '→';

    console.log(`\nTrend: ${trend} ${Math.abs(parseFloat(f1Change)).toFixed(1)}% change in F1 score`);
  }
}

/**
 * Example: Focused calibration on specific difficulty level
 */
async function calibrateByDifficulty(difficulty: 'easy' | 'medium' | 'hard') {
  const calibrator = new ConfidenceCalibrator();
  const extractor = new EntityExtractor();

  const report = await calibrator.calibrate(extractor);

  console.log(`\n=== ${difficulty.toUpperCase()} Cases Analysis ===\n`);

  const stats = report.byDifficulty[difficulty];

  console.log(`Total Cases: ${stats.totalCases}`);
  console.log(`Passed: ${stats.passed} (${(stats.passRate * 100).toFixed(1)}%)`);
  console.log(`Failed: ${stats.failed}`);
  console.log('');
  console.log(`Average Precision: ${(stats.avgPrecision * 100).toFixed(1)}%`);
  console.log(`Average Recall: ${(stats.avgRecall * 100).toFixed(1)}%`);
  console.log(`Average F1: ${(stats.avgF1 * 100).toFixed(1)}%`);
  console.log(`Confidence Accuracy: ${(stats.avgConfidenceAccuracy * 100).toFixed(1)}%`);

  // Show failed cases for this difficulty
  const failedInDifficulty = report.failedCases.filter(c => c.difficulty === difficulty);

  if (failedInDifficulty.length > 0) {
    console.log(`\nFailed Cases (${failedInDifficulty.length}):`);
    for (const failed of failedInDifficulty) {
      console.log(`  - ${failed.testCaseId}: F1=${(failed.f1 * 100).toFixed(1)}%`);
    }
  }
}

// Main execution
if (require.main === module) {
  runCalibration()
    .then(() => {
      console.log('\nCalibration complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Calibration failed:', error);
      process.exit(1);
    });
}

// Export functions for use in tests or scripts
export {
  runCalibration,
  analyzeFailedCases,
  trackCalibrationProgress,
  calibrateByDifficulty,
};
