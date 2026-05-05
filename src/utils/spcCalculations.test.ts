import { describe, expect, it } from 'vitest';
import { calculateCapabilityIndices } from './spcCalculations';

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
