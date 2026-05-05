import { describe, expect, it } from 'vitest';
import { buildSpcDiagnostics } from './spcDiagnostics';

describe('buildSpcDiagnostics', () => {
  it('profiles count data and recommends U chart with varying denominators', () => {
    const result = buildSpcDiagnostics({
      rows: [
        { defects: 3, opportunities: 100 },
        { defects: 4, opportunities: 120 },
        { defects: 1, opportunities: 80 },
      ],
      column: 'defects',
      denominatorColumn: 'opportunities',
      chartType: 'uChart',
      sampleSize: 5,
      selectedColumns: ['defects'],
    });

    expect(result.profile.dataKind).toBe('count');
    expect(result.profile.hasVaryingDenominator).toBe(true);
    expect(result.recommendations[0].chartType).toBe('uChart');
  });

  it('blocks a P chart when counts lack a denominator', () => {
    const result = buildSpcDiagnostics({
      rows: [
        { failed: 3 },
        { failed: 4 },
        { failed: 5 },
      ],
      column: 'failed',
      chartType: 'pChart',
      sampleSize: 50,
      selectedColumns: ['failed'],
    });

    expect(result.profile.dataKind).toBe('count');
    expect(result.diagnostics.some((item) => item.code === 'p-chart-needs-proportions')).toBe(true);
  });

  it('warns about autocorrelation and high tie rates for continuous data', () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      value: index < 12 ? 10 : 10.1,
    }));

    const result = buildSpcDiagnostics({
      rows,
      column: 'value',
      chartType: 'individual',
      sampleSize: 5,
      selectedColumns: ['value'],
    });

    expect(result.profile.dataKind).toBe('continuous');
    expect(result.diagnostics.some((item) => item.code === 'high-tie-rate')).toBe(true);
    expect(result.recommendations.some((item) => item.chartType === 'individual')).toBe(true);
  });
});
