/**
 * RegressionDetector - Automated regression detection on deployment
 *
 * Features:
 * - Automated checks before deployment
 * - Regression scoring and alerts
 * - Integration with CI/CD pipelines
 */

import { RegressionTester, RegressionResult } from './RegressionTester';

export interface RegressionAlert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  metric: string;
  currentValue: number;
  baselineValue: number;
  threshold: number;
}

export class RegressionDetector {
  private tester: RegressionTester;
  private readonly thresholds = {
    criticalScoreDrop: -10, // 10 point drop is critical
    warningScoreDrop: -5, // 5 point drop is warning
    criticalPassRateDrop: -0.15, // 15% pass rate drop is critical
    warningPassRateDrop: -0.10, // 10% pass rate drop is warning
    minimumScore: 70, // Minimum acceptable regression score
  };

  constructor(tester?: RegressionTester) {
    this.tester = tester || new RegressionTester();
  }

  /**
   * Run automated regression check
   * Returns alerts if regression detected
   */
  async checkForRegression(
    translateFunction: (tibetan: string) => Promise<{ translation: string; confidence: number }>,
    currentVersion: string,
    baselineVersion: string
  ): Promise<{
    passed: boolean;
    alerts: RegressionAlert[];
    currentResult: RegressionResult;
    baselineResult: RegressionResult | null;
  }> {
    const alerts: RegressionAlert[] = [];

    // Run current version tests
    const currentResult = await this.tester.runRegressionTests(
      translateFunction,
      currentVersion
    );

    // Load baseline
    const baselineResult = this.tester.loadBaseline(baselineVersion);

    if (!baselineResult) {
      console.warn(`No baseline found for version ${baselineVersion}, saving current as baseline`);
      this.tester.saveBaseline(currentResult);
      return {
        passed: currentResult.verdict !== 'failed',
        alerts: [],
        currentResult,
        baselineResult: null
      };
    }

    // Compare with baseline
    const comparison = this.tester.compareWithBaseline(currentResult, baselineResult);

    // Check for score regression
    if (comparison.scoreDelta <= this.thresholds.criticalScoreDrop) {
      alerts.push({
        severity: 'critical',
        message: `Critical regression score drop: ${comparison.scoreDelta} points`,
        metric: 'regressionScore',
        currentValue: currentResult.regressionScore,
        baselineValue: baselineResult.regressionScore,
        threshold: this.thresholds.criticalScoreDrop
      });
    } else if (comparison.scoreDelta <= this.thresholds.warningScoreDrop) {
      alerts.push({
        severity: 'warning',
        message: `Regression score dropped: ${comparison.scoreDelta} points`,
        metric: 'regressionScore',
        currentValue: currentResult.regressionScore,
        baselineValue: baselineResult.regressionScore,
        threshold: this.thresholds.warningScoreDrop
      });
    }

    // Check for pass rate regression
    if (comparison.passRateDelta <= this.thresholds.criticalPassRateDrop) {
      alerts.push({
        severity: 'critical',
        message: `Critical pass rate drop: ${(comparison.passRateDelta * 100).toFixed(1)}%`,
        metric: 'passRate',
        currentValue: currentResult.passed / currentResult.totalTests,
        baselineValue: baselineResult.passed / baselineResult.totalTests,
        threshold: this.thresholds.criticalPassRateDrop
      });
    } else if (comparison.passRateDelta <= this.thresholds.warningPassRateDrop) {
      alerts.push({
        severity: 'warning',
        message: `Pass rate dropped: ${(comparison.passRateDelta * 100).toFixed(1)}%`,
        metric: 'passRate',
        currentValue: currentResult.passed / currentResult.totalTests,
        baselineValue: baselineResult.passed / baselineResult.totalTests,
        threshold: this.thresholds.warningPassRateDrop
      });
    }

    // Check minimum score threshold
    if (currentResult.regressionScore < this.thresholds.minimumScore) {
      alerts.push({
        severity: 'critical',
        message: `Regression score below minimum threshold: ${currentResult.regressionScore} < ${this.thresholds.minimumScore}`,
        metric: 'regressionScore',
        currentValue: currentResult.regressionScore,
        baselineValue: this.thresholds.minimumScore,
        threshold: this.thresholds.minimumScore
      });
    }

    // Add info alerts for significant changes
    comparison.significantChanges.forEach(change => {
      if (!alerts.some(a => a.message.includes(change))) {
        alerts.push({
          severity: 'info',
          message: change,
          metric: 'various',
          currentValue: 0,
          baselineValue: 0,
          threshold: 0
        });
      }
    });

    const hasCriticalAlerts = alerts.some(a => a.severity === 'critical');
    const passed = !hasCriticalAlerts && currentResult.verdict !== 'failed';

    return {
      passed,
      alerts,
      currentResult,
      baselineResult
    };
  }

  /**
   * Generate regression report for CI/CD
   */
  generateReport(
    result: {
      passed: boolean;
      alerts: RegressionAlert[];
      currentResult: RegressionResult;
      baselineResult: RegressionResult | null;
    }
  ): string {
    let report = '# Regression Test Report\n\n';

    report += `## Summary\n`;
    report += `- Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}\n`;
    report += `- Version: ${result.currentResult.version}\n`;
    report += `- Timestamp: ${result.currentResult.timestamp.toISOString()}\n`;
    report += `- Regression Score: ${result.currentResult.regressionScore}/100\n`;
    report += `- Tests: ${result.currentResult.passed}/${result.currentResult.totalTests} passed\n\n`;

    if (result.baselineResult) {
      report += `## Comparison with Baseline (${result.baselineResult.version})\n`;
      report += `- Score Change: ${result.currentResult.regressionScore - result.baselineResult.regressionScore > 0 ? '+' : ''}${result.currentResult.regressionScore - result.baselineResult.regressionScore}\n`;
      report += `- Pass Rate Change: ${(((result.currentResult.passed / result.currentResult.totalTests) - (result.baselineResult.passed / result.baselineResult.totalTests)) * 100).toFixed(1)}%\n\n`;
    }

    if (result.alerts.length > 0) {
      report += `## Alerts\n`;
      const critical = result.alerts.filter(a => a.severity === 'critical');
      const warnings = result.alerts.filter(a => a.severity === 'warning');
      const info = result.alerts.filter(a => a.severity === 'info');

      if (critical.length > 0) {
        report += `### Critical (${critical.length})\n`;
        critical.forEach(alert => {
          report += `- ❌ ${alert.message}\n`;
        });
        report += '\n';
      }

      if (warnings.length > 0) {
        report += `### Warnings (${warnings.length})\n`;
        warnings.forEach(alert => {
          report += `- ⚠️ ${alert.message}\n`;
        });
        report += '\n';
      }

      if (info.length > 0) {
        report += `### Info (${info.length})\n`;
        info.forEach(alert => {
          report += `- ℹ️ ${alert.message}\n`;
        });
        report += '\n';
      }
    }

    // Add failed tests details
    const failedTests = result.currentResult.comparisons.filter(c => !c.passed);
    if (failedTests.length > 0) {
      report += `## Failed Tests (${failedTests.length})\n`;
      failedTests.slice(0, 5).forEach((test, i) => {
        report += `### ${i + 1}. ${test.goldenExample.id}\n`;
        report += `- Category: ${test.goldenExample.category}\n`;
        report += `- Complexity: ${test.goldenExample.complexity}\n`;
        report += `- Similarity: ${(test.similarityScore * 100).toFixed(1)}%\n`;
        report += `- Issues:\n`;
        test.issues.forEach(issue => {
          report += `  - ${issue}\n`;
        });
        report += '\n';
      });

      if (failedTests.length > 5) {
        report += `... and ${failedTests.length - 5} more failed tests\n\n`;
      }
    }

    return report;
  }

  /**
   * Validate deployment readiness
   * Returns true if safe to deploy
   */
  async validateDeployment(
    translateFunction: (tibetan: string) => Promise<{ translation: string; confidence: number }>,
    currentVersion: string,
    baselineVersion: string
  ): Promise<{
    safeToDeployment: boolean;
    report: string;
    criticalIssues: number;
  }> {
    const result = await this.checkForRegression(
      translateFunction,
      currentVersion,
      baselineVersion
    );

    const report = this.generateReport(result);
    const criticalIssues = result.alerts.filter(a => a.severity === 'critical').length;

    return {
      safeToDeployment: result.passed,
      report,
      criticalIssues
    };
  }
}
