import { describe, expect, it } from 'vitest';
import {
  calculateCapabilityIndices,
  calculateCapabilityStatus,
  calculateEWMALimits,
  calculatePChartLimits,
  calculateUChartLimits,
} from './spcCalculations';

describe('calculateCapabilityIndices', () => {
  it('uses specification limits rather than control limits', () => {
    const result = calculateCapabilityIndices(10, 1, {
      lowerSpecLimit: 6,
      upperSpecLimit: 15,
    });

    expect(result.cp).toBeCloseTo(1.5, 6);
    expect(result.cpl).toBeCloseTo(1.333333, 6);
    expect(result.cpu).toBeCloseTo(1.666667, 6);
    expect(result.cpk).toBeCloseTo(1.333333, 6);
  });

  it('returns one-sided capability when only one spec limit is set', () => {
    const result = calculateCapabilityIndices(10, 1, {
      upperSpecLimit: 14,
    });

    expect(result.cp).toBeNaN();
    expect(result.cpl).toBeNaN();
    expect(result.cpu).toBeCloseTo(1.333333, 6);
    expect(result.cpk).toBeCloseTo(1.333333, 6);
  });

  it('does not calculate capability for invalid sigma or reversed spec limits', () => {
    expect(calculateCapabilityIndices(10, 0, {
      lowerSpecLimit: 6,
      upperSpecLimit: 15,
    }).cp).toBeNaN();

    expect(calculateCapabilityIndices(10, 1, {
      lowerSpecLimit: 15,
      upperSpecLimit: 6,
    }).cpk).toBeNaN();
  });
});

describe('attribute and EWMA limits', () => {
  it('calculates pointwise P chart limits when denominators vary', () => {
    const limits = calculatePChartLimits([5, 10], 100, [100, 200]);

    expect(limits.centerLine).toBeCloseTo(0.05, 6);
    expect(limits.chartValues).toEqual([0.05, 0.05]);
    expect(limits.uclSeries).toHaveLength(2);
    expect(limits.lclSeries).toHaveLength(2);
    expect(limits.uclSeries?.[0]).toBeGreaterThan(limits.uclSeries?.[1] ?? 0);
  });

  it('calculates pointwise U chart limits from defect counts and opportunities', () => {
    const limits = calculateUChartLimits([4, 10], 5, [2, 5]);

    expect(limits.centerLine).toBeCloseTo(2, 6);
    expect(limits.chartValues).toEqual([2, 2]);
    expect(limits.sigmaSeries?.[0]).toBeGreaterThan(limits.sigmaSeries?.[1] ?? 0);
  });

  it('uses startup EWMA limits before asymptotic limits', () => {
    const limits = calculateEWMALimits([10, 11, 12, 13, 14], 0.2);

    expect(limits.chartValues).toHaveLength(5);
    expect(limits.uclSeries).toHaveLength(5);
    expect(limits.uclSeries?.[0]).toBeLessThan(limits.ucl);
    expect(limits.lclSeries?.[0]).toBeGreaterThan(limits.lcl);
  });
});

describe('calculateCapabilityStatus', () => {
  it('marks attribute chart capability as not applicable', () => {
    const status = calculateCapabilityStatus([0.1, 0.2, 0.3], 0.2, 0.05, {
      lowerSpecLimit: 0,
      upperSpecLimit: 1,
    }, {
      chartType: 'pChart',
      ruleViolations: [],
    });

    expect(status.readiness).toBe('notApplicable');
    expect(status.indices.cpk).toBeNaN();
  });

  it('marks unstable continuous capability as preliminary', () => {
    const values = Array.from({ length: 40 }, (_, index) => 10 + Math.sin(index));
    const status = calculateCapabilityStatus(values, 10, 1, {
      lowerSpecLimit: 6,
      upperSpecLimit: 14,
      targetValue: 10,
    }, {
      chartType: 'individual',
      ruleViolations: [{ index: 3, pointValue: 15, ruleNumber: 1, description: 'Above UCL' }],
    });

    expect(status.readiness).toBe('preliminary');
    expect(status.indices.cpk).toBeCloseTo(1.333333, 6);
    expect(status.indices.ppk).toBeGreaterThan(0);
    expect(status.reasons.some((reason) => reason.includes('instability'))).toBe(true);
  });
});
