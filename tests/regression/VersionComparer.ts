/**
 * VersionComparer - Side-by-side version comparison tool
 *
 * Features:
 * - Compare two versions on golden dataset
 * - Generate HTML reports with diff highlighting
 * - Visual comparison of translations
 */

import { RegressionTester, RegressionResult, GoldenTranslation } from './RegressionTester';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface VersionComparison {
  version1: string;
  version2: string;
  timestamp: Date;
  improvements: number;
  regressions: number;
  unchanged: number;
  details: ComparisonDetail[];
}

export interface ComparisonDetail {
  goldenExample: GoldenTranslation;
  v1Translation: string;
  v2Translation: string;
  v1Similarity: number;
  v2Similarity: number;
  v1Confidence: number;
  v2Confidence: number;
  verdict: 'improved' | 'regressed' | 'unchanged';
  similarityDelta: number;
}

export class VersionComparer {
  private tester: RegressionTester;

  constructor(tester?: RegressionTester) {
    this.tester = tester || new RegressionTester();
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    version1: string,
    version2: string,
    translateFunction1: (tibetan: string) => Promise<{ translation: string; confidence: number }>,
    translateFunction2: (tibetan: string) => Promise<{ translation: string; confidence: number }>
  ): Promise<VersionComparison> {
    const goldenDataset = this.tester.loadGoldenDataset();

    if (goldenDataset.length === 0) {
      throw new Error('No golden dataset found');
    }

    const details: ComparisonDetail[] = [];

    // Run both versions on each example
    for (const goldenExample of goldenDataset) {
      try {
        // Version 1
        const v1Result = await translateFunction1(goldenExample.tibetan);
        const v1Similarity = this.tester.calculateSimilarity(
          goldenExample.expectedEnglish,
          v1Result.translation
        );

        // Version 2
        const v2Result = await translateFunction2(goldenExample.tibetan);
        const v2Similarity = this.tester.calculateSimilarity(
          goldenExample.expectedEnglish,
          v2Result.translation
        );

        // Calculate verdict
        const similarityDelta = v2Similarity - v1Similarity;
        let verdict: 'improved' | 'regressed' | 'unchanged';
        if (Math.abs(similarityDelta) < 0.05) {
          verdict = 'unchanged';
        } else if (similarityDelta > 0) {
          verdict = 'improved';
        } else {
          verdict = 'regressed';
        }

        details.push({
          goldenExample,
          v1Translation: v1Result.translation,
          v2Translation: v2Result.translation,
          v1Similarity,
          v2Similarity,
          v1Confidence: v1Result.confidence,
          v2Confidence: v2Result.confidence,
          verdict,
          similarityDelta
        });
      } catch (error: any) {
        console.error(`Failed to compare translations for example ${goldenExample.id}:`, error.message);
      }
    }

    // Count results
    const improvements = details.filter(d => d.verdict === 'improved').length;
    const regressions = details.filter(d => d.verdict === 'regressed').length;
    const unchanged = details.filter(d => d.verdict === 'unchanged').length;

    return {
      version1,
      version2,
      timestamp: new Date(),
      improvements,
      regressions,
      unchanged,
      details
    };
  }

  /**
   * Generate HTML report with diff highlighting
   */
  generateHTMLReport(comparison: VersionComparison): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Version Comparison: ${comparison.version1} vs ${comparison.version2}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1, h2 { color: #333; }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .summary-card {
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .summary-card h3 { margin: 0 0 5px 0; font-size: 24px; }
    .summary-card p { margin: 0; color: #666; font-size: 14px; }
    .improved { background-color: #d4edda; color: #155724; }
    .regressed { background-color: #f8d7da; color: #721c24; }
    .unchanged { background-color: #e2e3e5; color: #383d41; }

    .comparison-item {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .comparison-item.improved { border-left: 5px solid #28a745; }
    .comparison-item.regressed { border-left: 5px solid #dc3545; }
    .comparison-item.unchanged { border-left: 5px solid #6c757d; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e9ecef;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge.improved { background-color: #28a745; color: white; }
    .badge.regressed { background-color: #dc3545; color: white; }
    .badge.unchanged { background-color: #6c757d; color: white; }

    .tibetan-text {
      background-color: #fff9e6;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
      font-size: 18px;
      font-family: 'Noto Sans Tibetan', serif;
    }
    .expected-text {
      background-color: #e8f5e9;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .translations {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 15px;
    }
    .version-box {
      padding: 15px;
      border-radius: 6px;
      background-color: #f8f9fa;
    }
    .version-box h4 {
      margin: 0 0 10px 0;
      color: #495057;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .translation-text {
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 10px;
    }
    .metrics {
      display: flex;
      gap: 15px;
      font-size: 12px;
      color: #6c757d;
    }
    .metric { display: flex; align-items: center; gap: 5px; }
    .metric-value { font-weight: bold; }
  </style>
</head>
<body>
  <h1>Version Comparison Report</h1>
  <div class="summary">
    <h2>${comparison.version1} vs ${comparison.version2}</h2>
    <p>Generated: ${comparison.timestamp.toISOString()}</p>
    <div class="summary-grid">
      <div class="summary-card improved">
        <h3>${comparison.improvements}</h3>
        <p>Improvements</p>
      </div>
      <div class="summary-card regressed">
        <h3>${comparison.regressions}</h3>
        <p>Regressions</p>
      </div>
      <div class="summary-card unchanged">
        <h3>${comparison.unchanged}</h3>
        <p>Unchanged</p>
      </div>
      <div class="summary-card">
        <h3>${comparison.details.length}</h3>
        <p>Total Tests</p>
      </div>
    </div>
  </div>

  <h2>Detailed Comparisons</h2>
`;

    // Sort: regressions first, then improvements, then unchanged
    const sortedDetails = [...comparison.details].sort((a, b) => {
      const order = { regressed: 0, improved: 1, unchanged: 2 };
      return order[a.verdict] - order[b.verdict];
    });

    sortedDetails.forEach((detail, index) => {
      html += `
  <div class="comparison-item ${detail.verdict}">
    <div class="header">
      <div>
        <strong>${detail.goldenExample.id}</strong>
        <span style="color: #6c757d; margin-left: 10px;">${detail.goldenExample.category} · ${detail.goldenExample.complexity}</span>
      </div>
      <span class="badge ${detail.verdict}">${detail.verdict}</span>
    </div>

    <div class="tibetan-text">
      <strong>Tibetan:</strong> ${this.escapeHtml(detail.goldenExample.tibetan)}
    </div>

    <div class="expected-text">
      <strong>Expected:</strong> ${this.escapeHtml(detail.goldenExample.expectedEnglish)}
    </div>

    <div class="translations">
      <div class="version-box">
        <h4>${comparison.version1}</h4>
        <div class="translation-text">${this.escapeHtml(detail.v1Translation)}</div>
        <div class="metrics">
          <div class="metric">
            <span>Similarity:</span>
            <span class="metric-value">${(detail.v1Similarity * 100).toFixed(1)}%</span>
          </div>
          <div class="metric">
            <span>Confidence:</span>
            <span class="metric-value">${(detail.v1Confidence * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div class="version-box">
        <h4>${comparison.version2}</h4>
        <div class="translation-text">${this.escapeHtml(detail.v2Translation)}</div>
        <div class="metrics">
          <div class="metric">
            <span>Similarity:</span>
            <span class="metric-value" style="color: ${detail.similarityDelta > 0 ? '#28a745' : detail.similarityDelta < 0 ? '#dc3545' : '#6c757d'}">
              ${(detail.v2Similarity * 100).toFixed(1)}% (${detail.similarityDelta > 0 ? '+' : ''}${(detail.similarityDelta * 100).toFixed(1)}%)
            </span>
          </div>
          <div class="metric">
            <span>Confidence:</span>
            <span class="metric-value">${(detail.v2Confidence * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
    });

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Save HTML report to file
   */
  saveHTMLReport(comparison: VersionComparison, outputPath?: string): string {
    const html = this.generateHTMLReport(comparison);
    const filename = outputPath || join(
      __dirname,
      `../reports/comparison-${comparison.version1}-vs-${comparison.version2}.html`
    );

    writeFileSync(filename, html, 'utf-8');
    console.log(`✓ HTML report saved: ${filename}`);
    return filename;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
