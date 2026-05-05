import jStat from 'jstat';
import {
  CapabilityStatus,
  ControlLimits,
  ChartType,
  DataPoint,
  DataProfile,
  RuleViolation,
} from '../types/DataTypes';

// Helper to compute B3/B4 from c4
const computeB3B4 = (c4: number) => {
  const k = (3 / c4) * Math.sqrt(Math.max(0, 1 - c4 * c4));
  const b3 = Math.max(0, 1 - k);
  const b4 = 1 + k;
  return { b3, b4 };
};

// Constants for control charts based on sample size (n = 2..25)
type ControlConstants = {
  a2: number;
  a3: number;
  c4: number;
  b3: number;
  b4: number;
  d2: number;
  d3: number;
  d4: number;
};

const controlChartConstants: Record<number, ControlConstants> = {
  2: { a2: 1.880, a3: 2.659, c4: 0.7979, ...computeB3B4(0.7979), d2: 1.128, d3: 0, d4: 3.267 },
  3: { a2: 1.023, a3: 1.954, c4: 0.8862, ...computeB3B4(0.8862), d2: 1.693, d3: 0, d4: 2.574 },
  4: { a2: 0.729, a3: 1.628, c4: 0.9213, ...computeB3B4(0.9213), d2: 2.059, d3: 0, d4: 2.282 },
  5: { a2: 0.577, a3: 1.427, c4: 0.9400, ...computeB3B4(0.9400), d2: 2.326, d3: 0, d4: 2.114 },
  6: { a2: 0.483, a3: 1.287, c4: 0.9515, ...computeB3B4(0.9515), d2: 2.534, d3: 0, d4: 2.004 },
  7: { a2: 0.419, a3: 1.182, c4: 0.9594, ...computeB3B4(0.9594), d2: 2.704, d3: 0.076, d4: 1.924 },
  8: { a2: 0.373, a3: 1.099, c4: 0.9650, ...computeB3B4(0.9650), d2: 2.847, d3: 0.136, d4: 1.864 },
  9: { a2: 0.337, a3: 1.032, c4: 0.9693, ...computeB3B4(0.9693), d2: 2.970, d3: 0.184, d4: 1.816 },
  10: { a2: 0.308, a3: 0.975, c4: 0.9727, ...computeB3B4(0.9727), d2: 3.078, d3: 0.223, d4: 1.777 },
  11: { a2: 0.285, a3: 0.927, c4: 0.9754, ...computeB3B4(0.9754), d2: 3.173, d3: 0.256, d4: 1.744 },
  12: { a2: 0.266, a3: 0.886, c4: 0.9776, ...computeB3B4(0.9776), d2: 3.258, d3: 0.283, d4: 1.717 },
  13: { a2: 0.249, a3: 0.850, c4: 0.9794, ...computeB3B4(0.9794), d2: 3.336, d3: 0.307, d4: 1.693 },
  14: { a2: 0.235, a3: 0.817, c4: 0.9810, ...computeB3B4(0.9810), d2: 3.407, d3: 0.328, d4: 1.672 },
  15: { a2: 0.223, a3: 0.789, c4: 0.9823, ...computeB3B4(0.9823), d2: 3.472, d3: 0.347, d4: 1.653 },
  16: { a2: 0.212, a3: 0.763, c4: 0.9835, ...computeB3B4(0.9835), d2: 3.532, d3: 0.363, d4: 1.637 },
  17: { a2: 0.203, a3: 0.739, c4: 0.9845, ...computeB3B4(0.9845), d2: 3.588, d3: 0.378, d4: 1.622 },
  18: { a2: 0.194, a3: 0.718, c4: 0.9854, ...computeB3B4(0.9854), d2: 3.640, d3: 0.391, d4: 1.608 },
  19: { a2: 0.187, a3: 0.698, c4: 0.9862, ...computeB3B4(0.9862), d2: 3.689, d3: 0.403, d4: 1.597 },
  20: { a2: 0.180, a3: 0.680, c4: 0.9869, ...computeB3B4(0.9869), d2: 3.735, d3: 0.415, d4: 1.585 },
  21: { a2: 0.173, a3: 0.663, c4: 0.9876, ...computeB3B4(0.9876), d2: 3.778, d3: 0.425, d4: 1.575 },
  22: { a2: 0.167, a3: 0.647, c4: 0.9882, ...computeB3B4(0.9882), d2: 3.819, d3: 0.434, d4: 1.566 },
  23: { a2: 0.162, a3: 0.633, c4: 0.9887, ...computeB3B4(0.9887), d2: 3.858, d3: 0.443, d4: 1.557 },
  24: { a2: 0.157, a3: 0.619, c4: 0.9892, ...computeB3B4(0.9892), d2: 3.895, d3: 0.451, d4: 1.548 },
  25: { a2: 0.153, a3: 0.606, c4: 0.9896, ...computeB3B4(0.9896), d2: 3.931, d3: 0.459, d4: 1.541 },
};

// Get control chart constants based on sample size
export const getControlChartConstants = (sampleSize: number) => {
  // Default to sample size 5 if the specified size isn't in our table
  return controlChartConstants[sampleSize] || controlChartConstants[5];
};

// Calculate mean of an array
export const calculateMean = (data: number[]): number => {
  return jStat.mean(data);
};

// Calculate standard deviation of an array
export const calculateStandardDeviation = (data: number[]): number => {
  return jStat.stdev(data, true);
};

export interface CapabilitySpecLimits {
  lowerSpecLimit?: number | null;
  upperSpecLimit?: number | null;
  targetValue?: number | null;
}

const finiteOrNull = (value: number | null | undefined): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export const calculateCapabilityIndices = (
  mean: number,
  sigma: number,
  specLimits: CapabilitySpecLimits
): Pick<CapabilityStatus['indices'], 'cp' | 'cpl' | 'cpu' | 'cpk'> => {
  const empty = {
    cp: Number.NaN,
    cpl: Number.NaN,
    cpu: Number.NaN,
    cpk: Number.NaN,
  };

  if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0) {
    return empty;
  }

  const lowerSpecLimit = finiteOrNull(specLimits.lowerSpecLimit);
  const upperSpecLimit = finiteOrNull(specLimits.upperSpecLimit);

  if (
    lowerSpecLimit !== null &&
    upperSpecLimit !== null &&
    upperSpecLimit <= lowerSpecLimit
  ) {
    return empty;
  }

  const cpl = lowerSpecLimit !== null
    ? (mean - lowerSpecLimit) / (3 * sigma)
    : Number.NaN;
  const cpu = upperSpecLimit !== null
    ? (upperSpecLimit - mean) / (3 * sigma)
    : Number.NaN;
  const cp = lowerSpecLimit !== null && upperSpecLimit !== null
    ? (upperSpecLimit - lowerSpecLimit) / (6 * sigma)
    : Number.NaN;
  const cpkCandidates = [cpl, cpu].filter(Number.isFinite);
  const cpk = cpkCandidates.length > 0
    ? Math.min(...cpkCandidates)
    : Number.NaN;

  return { cp, cpl, cpu, cpk };
};

export const calculateCapabilityStatus = (
  values: number[],
  mean: number,
  withinSigma: number,
  specLimits: CapabilitySpecLimits,
  options: {
    chartType: ChartType;
    dataProfile?: DataProfile;
    ruleViolations?: RuleViolation[];
  }
): CapabilityStatus => {
  const emptyIndices = {
    cp: Number.NaN,
    cpl: Number.NaN,
    cpu: Number.NaN,
    cpk: Number.NaN,
    pp: Number.NaN,
    ppl: Number.NaN,
    ppu: Number.NaN,
    ppk: Number.NaN,
    cpm: Number.NaN,
  };

  const lowerSpecLimit = finiteOrNull(specLimits.lowerSpecLimit);
  const upperSpecLimit = finiteOrNull(specLimits.upperSpecLimit);
  const targetValue = finiteOrNull(specLimits.targetValue);
  const reasons: string[] = [];
  const isAttributeChart = ['pChart', 'npChart', 'cChart', 'uChart'].includes(options.chartType);

  if (isAttributeChart) {
    return {
      readiness: 'notApplicable',
      indices: emptyIndices,
      reasons: ['Capability indices require continuous variable data, not attribute counts or proportions.'],
    };
  }

  if (lowerSpecLimit === null && upperSpecLimit === null) {
    return {
      readiness: 'notApplicable',
      indices: emptyIndices,
      reasons: ['Add at least one specification limit before interpreting capability.'],
    };
  }

  if (lowerSpecLimit !== null && upperSpecLimit !== null && upperSpecLimit <= lowerSpecLimit) {
    return {
      readiness: 'notApplicable',
      indices: emptyIndices,
      reasons: ['Upper specification limit must be greater than lower specification limit.'],
    };
  }

  if (!Number.isFinite(mean) || !Number.isFinite(withinSigma) || withinSigma <= 0) {
    return {
      readiness: 'notApplicable',
      indices: emptyIndices,
      reasons: ['A positive within-process sigma estimate is required for capability.'],
    };
  }

  const cleanValues = values.filter(Number.isFinite);
  const overallSigma = cleanValues.length > 1 ? calculateStandardDeviation(cleanValues) : Number.NaN;
  const within = calculateCapabilityIndices(mean, withinSigma, { lowerSpecLimit, upperSpecLimit });
  const performance = calculateCapabilityIndices(mean, overallSigma, { lowerSpecLimit, upperSpecLimit });

  let cpm = Number.NaN;
  if (
    lowerSpecLimit !== null
    && upperSpecLimit !== null
    && targetValue !== null
    && Number.isFinite(overallSigma)
    && overallSigma > 0
  ) {
    const denominator = 6 * Math.sqrt(overallSigma ** 2 + (mean - targetValue) ** 2);
    cpm = denominator > 0 ? (upperSpecLimit - lowerSpecLimit) / denominator : Number.NaN;
  }

  if (cleanValues.length < 30) {
    reasons.push('Capability is preliminary with fewer than 30 usable observations.');
  }
  if ((options.ruleViolations?.length ?? 0) > 0) {
    reasons.push('Capability is preliminary because control-chart rules indicate instability.');
  }
  if (Math.abs(options.dataProfile?.skewness ?? 0) > 1) {
    reasons.push('Capability is preliminary because the selected data are strongly skewed.');
  }
  if (Math.abs(options.dataProfile?.lag1Autocorrelation ?? 0) > 0.35) {
    reasons.push('Capability is preliminary because observations appear autocorrelated.');
  }

  return {
    readiness: reasons.length ? 'preliminary' : 'ready',
    indices: {
      cp: within.cp,
      cpl: within.cpl,
      cpu: within.cpu,
      cpk: within.cpk,
      pp: performance.cp,
      ppl: performance.cpl,
      ppu: performance.cpu,
      ppk: performance.cpk,
      cpm,
    },
    reasons: reasons.length ? reasons : ['Process appears stable enough for initial capability interpretation.'],
  };
};

// Calculate control limits for Individual chart
export const calculateIndividualControlLimits = (data: number[]): ControlLimits => {
  const mean = calculateMean(data);
  
  // Calculate moving ranges
  const movingRanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    movingRanges.push(Math.abs(data[i] - data[i - 1]));
  }
  
  const mR = calculateMean(movingRanges);
  const sigma = mR / 1.128; // d2 for n=2 is 1.128
  
  return {
    ucl: mean + 3 * sigma,
    lcl: mean - 3 * sigma,
    centerLine: mean,
    sigma
  };
};

const clampLowerLimit = (value: number): number => Math.max(0, value);

const fixedSeries = (value: number, length: number): number[] => Array(length).fill(value);

const numericValuesFromRows = (data: DataPoint[], column: string): number[] => (
  data.map(row => parseFloat(String(row[column]))).filter(Number.isFinite)
);

const numericSeriesFromRows = (data: DataPoint[], column: string): number[] => (
  data.map(row => parseFloat(String(row[column])))
);

const positiveDenominatorsFromRows = (data: DataPoint[], denominatorColumn?: string | null): Array<number | null> => {
  if (!denominatorColumn) {
    return data.map(() => null);
  }

  return data.map((row) => {
    const value = parseFloat(String(row[denominatorColumn]));
    return Number.isFinite(value) && value > 0 ? value : null;
  });
};

// Calculate control limits for P Chart (proportion)
export const calculatePChartLimits = (
  data: number[],
  sampleSize: number,
  denominators?: Array<number | null>
): ControlLimits => {
  const hasPointwiseDenominators = Boolean(denominators?.some((value) => value !== null));

  if (hasPointwiseDenominators && denominators) {
    const validPairs = data
      .map((count, index) => ({ count, denominator: denominators[index] }))
      .filter((pair): pair is { count: number; denominator: number } => (
        Number.isFinite(pair.count)
        && pair.denominator !== null
        && Number.isFinite(pair.denominator)
        && pair.denominator > 0
      ));

    const totalCount = validPairs.reduce((sum, pair) => sum + pair.count, 0);
    const totalDenominator = validPairs.reduce((sum, pair) => sum + pair.denominator, 0);
    const p = totalDenominator > 0 ? totalCount / totalDenominator : Number.NaN;
    const chartValues = data.map((count, index) => {
      const denominator = denominators[index];
      return denominator && denominator > 0 && Number.isFinite(count) ? count / denominator : Number.NaN;
    });
    const denominatorSeries = denominators.map((value) => value ?? Number.NaN);
    const sigmaSeries = denominatorSeries.map((denominator) => (
      Number.isFinite(denominator) && denominator > 0 && p >= 0 && p <= 1
        ? Math.sqrt(p * (1 - p) / denominator)
        : Number.NaN
    ));
    const uclSeries = sigmaSeries.map((sigma) => Math.min(1, p + 3 * sigma));
    const lclSeries = sigmaSeries.map((sigma) => clampLowerLimit(p - 3 * sigma));
    const finiteUcls = uclSeries.filter(Number.isFinite);
    const finiteLcls = lclSeries.filter(Number.isFinite);

    return {
      ucl: finiteUcls.length ? calculateMean(finiteUcls) : Number.NaN,
      lcl: finiteLcls.length ? calculateMean(finiteLcls) : Number.NaN,
      centerLine: p,
      sigma: calculateMean(sigmaSeries.filter(Number.isFinite)),
      uclSeries,
      lclSeries,
      sigmaSeries,
      denominatorSeries,
      chartValues,
    };
  }

  const finiteData = data.filter(Number.isFinite);
  const p = calculateMean(finiteData);
  const sigma = Math.sqrt(p * (1 - p) / sampleSize);
  const chartValues = data.map((value) => Number.isFinite(value) ? value : Number.NaN);
  
  return {
    ucl: Math.min(1, p + 3 * sigma),
    lcl: clampLowerLimit(p - 3 * sigma), // LCL can't be negative for p charts
    centerLine: p,
    sigma,
    uclSeries: fixedSeries(Math.min(1, p + 3 * sigma), data.length),
    lclSeries: fixedSeries(clampLowerLimit(p - 3 * sigma), data.length),
    sigmaSeries: fixedSeries(sigma, data.length),
    denominatorSeries: fixedSeries(sampleSize, data.length),
    chartValues,
  };
};

// Calculate control limits for NP Chart
export const calculateNPChartLimits = (data: number[], sampleSize: number): ControlLimits => {
  const np = calculateMean(data);
  const p = np / sampleSize;
  const sigma = Math.sqrt(sampleSize * p * (1 - p));
  
  return {
    ucl: np + 3 * sigma,
    lcl: clampLowerLimit(np - 3 * sigma), // LCL can't be negative for np charts
    centerLine: np,
    sigma,
    chartValues: data,
  };
};

export const calculateCChartLimits = (data: number[]): ControlLimits => {
  const cBar = calculateMean(data);
  const sigma = Math.sqrt(Math.max(0, cBar));

  return {
    ucl: cBar + 3 * sigma,
    lcl: clampLowerLimit(cBar - 3 * sigma),
    centerLine: cBar,
    sigma,
    chartValues: data,
  };
};

export const calculateUChartLimits = (
  data: number[],
  sampleSize: number,
  denominators?: Array<number | null>
): ControlLimits => {
  const hasPointwiseDenominators = Boolean(denominators?.some((value) => value !== null));
  const denominatorSeries = hasPointwiseDenominators
    ? (denominators ?? []).map((value) => value ?? Number.NaN)
    : fixedSeries(sampleSize, data.length);

  const sourceData = data;
  const validPairs = sourceData
    .map((count, index) => ({ count, denominator: denominatorSeries[index] }))
    .filter((pair) => (
      Number.isFinite(pair.count)
      && Number.isFinite(pair.denominator)
      && pair.denominator > 0
    ));

  const totalCount = validPairs.reduce((sum, pair) => sum + pair.count, 0);
  const totalDenominator = validPairs.reduce((sum, pair) => sum + pair.denominator, 0);
  const uBar = totalDenominator > 0 ? totalCount / totalDenominator : Number.NaN;
  const chartValues = sourceData.map((count, index) => {
    const denominator = denominatorSeries[index];
    return Number.isFinite(count) && Number.isFinite(denominator) && denominator > 0
      ? count / denominator
      : Number.NaN;
  });
  const sigmaSeries = denominatorSeries.map((denominator) => (
    Number.isFinite(denominator) && denominator > 0 && Number.isFinite(uBar)
      ? Math.sqrt(Math.max(0, uBar / denominator))
      : Number.NaN
  ));
  const uclSeries = sigmaSeries.map((sigma) => uBar + 3 * sigma);
  const lclSeries = sigmaSeries.map((sigma) => clampLowerLimit(uBar - 3 * sigma));
  const finiteUcls = uclSeries.filter(Number.isFinite);
  const finiteLcls = lclSeries.filter(Number.isFinite);

  return {
    ucl: finiteUcls.length ? calculateMean(finiteUcls) : Number.NaN,
    lcl: finiteLcls.length ? calculateMean(finiteLcls) : Number.NaN,
    centerLine: uBar,
    sigma: calculateMean(sigmaSeries.filter(Number.isFinite)),
    uclSeries,
    lclSeries,
    sigmaSeries,
    denominatorSeries,
    chartValues,
  };
};

// Calculate control limits for X-bar S Chart
export const calculateXbarSChartLimits = (
  subgroupMeans: number[], 
  subgroupStdDevs: number[], 
  sampleSize: number
): ControlLimits => {
  const constants = getControlChartConstants(sampleSize);
  
  const xBar = calculateMean(subgroupMeans);
  const sBar = calculateMean(subgroupStdDevs);
  
  return {
    // X-bar chart limits
    ucl: xBar + constants.a3 * sBar,
    lcl: xBar - constants.a3 * sBar,
    centerLine: xBar,
    sigma: sBar / constants.c4,
    constants
  };
};

// Compute components for X-bar S: subgroup arrays and both chart limits
export const computeXbarSComponents = (values: number[], sampleSize: number) => {
  const subgroups: number[][] = [];
  for (let i = 0; i < values.length; i += sampleSize) {
    const g = values.slice(i, i + sampleSize);
    if (g.length === sampleSize) subgroups.push(g);
    else if (process.env.NODE_ENV !== 'production') {
      console.warn(`[computeXbarSComponents] Ignoring incomplete subgroup of size ${g.length}; expected ${sampleSize}`);
    }
  }
  const subgroupMeans = subgroups.map(g => calculateMean(g));
  const subgroupStdDevs = subgroups.map(g => calculateStandardDeviation(g));
  const constants = getControlChartConstants(sampleSize);
  const xBar = calculateMean(subgroupMeans);
  const sBar = calculateMean(subgroupStdDevs);
  return {
    subgroupMeans,
    subgroupStdDevs,
    xbarLimits: {
      ucl: xBar + constants.a3 * sBar,
      lcl: xBar - constants.a3 * sBar,
      centerLine: xBar,
    },
    sChartLimits: {
      ucl: constants.b4 * sBar,
      lcl: Math.max(0, constants.b3 * sBar),
      centerLine: sBar,
    },
    sigmaEstimate: sBar / constants.c4,
  };
};

// Compute components for X-bar R: subgroup arrays and both chart limits
export const computeXbarRComponents = (values: number[], sampleSize: number) => {
  const subgroups: number[][] = [];
  for (let i = 0; i < values.length; i += sampleSize) {
    const g = values.slice(i, i + sampleSize);
    if (g.length === sampleSize) subgroups.push(g);
    else if (process.env.NODE_ENV !== 'production') {
      console.warn(`[computeXbarRComponents] Ignoring incomplete subgroup of size ${g.length}; expected ${sampleSize}`);
    }
  }
  const subgroupMeans = subgroups.map(g => calculateMean(g));
  const subgroupRanges = subgroups.map(g => Math.max(...g) - Math.min(...g));
  const constants = getControlChartConstants(sampleSize);
  const xBar = calculateMean(subgroupMeans);
  const rBar = calculateMean(subgroupRanges);
  return {
    subgroupMeans,
    subgroupRanges,
    xbarLimits: {
      ucl: xBar + constants.a2 * rBar,
      lcl: xBar - constants.a2 * rBar,
      centerLine: xBar,
    },
    rChartLimits: {
      ucl: constants.d4 * rBar,
      lcl: Math.max(0, constants.d3 * rBar),
      centerLine: rBar,
    },
    sigmaEstimate: rBar / constants.d2,
  };
};

// Calculate control limits for EWMA Chart
export const calculateEWMALimits = (data: number[], lambda = 0.2): ControlLimits => {
  const mean = calculateMean(data);
  const sigma = calculateStandardDeviation(data);
  const ewmaValues = calculateEWMAValues(data, lambda);
  
  const sigmaSeries = data.map((_, index) => {
    const factor = Math.sqrt((lambda / (2 - lambda)) * (1 - ((1 - lambda) ** (2 * (index + 1)))));
    return sigma * factor;
  });
  const uclSeries = sigmaSeries.map((pointSigma) => mean + 3 * pointSigma);
  const lclSeries = sigmaSeries.map((pointSigma) => mean - 3 * pointSigma);
  const asymptoticFactor = Math.sqrt(lambda / (2 - lambda));
  
  return {
    ucl: mean + 3 * sigma * asymptoticFactor,
    lcl: mean - 3 * sigma * asymptoticFactor,
    centerLine: mean,
    sigma,
    uclSeries,
    lclSeries,
    sigmaSeries,
    chartValues: ewmaValues,
  };
};

// Process data for histogram
export const prepareHistogramData = (data: number[]): { bins: number[], counts: number[] } => {
  // Calculate suggested number of bins (Sturges' formula)
  const binCount = Math.ceil(1 + 3.322 * Math.log10(data.length));
  
  // Calculate bin width
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / binCount;
  
  // Create bins
  const bins: number[] = [];
  for (let i = 0; i <= binCount; i++) {
    bins.push(min + i * binWidth);
  }
  
  // Count data points in each bin
  const counts = new Array(binCount).fill(0);
  data.forEach(value => {
    // Skip the max value to avoid out of bounds
    if (value === max) {
      counts[binCount - 1]++;
      return;
    }
    
    const binIndex = Math.floor((value - min) / binWidth);
    counts[binIndex]++;
  });
  
  return { bins, counts };
};

// Main function to calculate control limits based on chart type
export const calculateControlLimits = (
  data: DataPoint[], 
  column: string, 
  chartType: ChartType,
  sampleSize: number,
  denominatorColumn?: string | null
): ControlLimits => {
  // Extract numerical data from the specified column
  const numericData = numericValuesFromRows(data, column);
  const numericSeries = numericSeriesFromRows(data, column);
  const denominators = positiveDenominatorsFromRows(data, denominatorColumn);
  
  switch (chartType) {
    case 'individual':
      return calculateIndividualControlLimits(numericData);
      
    case 'pChart':
      return calculatePChartLimits(numericSeries, sampleSize, denominators);
      
    case 'npChart':
      return calculateNPChartLimits(numericData, sampleSize);

    case 'cChart':
      return calculateCChartLimits(numericData);

    case 'uChart':
      return calculateUChartLimits(numericSeries, sampleSize, denominators);
      
    case 'xBarS': {
      // Group data into subgroups of size sampleSize
      const subgroups: number[][] = [];
      for (let i = 0; i < numericData.length; i += sampleSize) {
        const subgroup = numericData.slice(i, i + sampleSize);
        if (subgroup.length === sampleSize) {  // Only use complete subgroups
          subgroups.push(subgroup);
        }
      }
      
      // Calculate means and standard deviations for each subgroup
      const subgroupMeans = subgroups.map(group => calculateMean(group));
      const subgroupStdDevs = subgroups.map(group => calculateStandardDeviation(group));
      
      return calculateXbarSChartLimits(subgroupMeans, subgroupStdDevs, sampleSize);
    }

    case 'xBarR': {
      // Group data into subgroups
      const subgroups: number[][] = [];
      for (let i = 0; i < numericData.length; i += sampleSize) {
        const subgroup = numericData.slice(i, i + sampleSize);
        if (subgroup.length === sampleSize) subgroups.push(subgroup);
      }
      const subgroupMeans = subgroups.map(group => calculateMean(group));
      const subgroupRanges = subgroups.map(group => Math.max(...group) - Math.min(...group));
      const constants = getControlChartConstants(sampleSize);
      const xBar = calculateMean(subgroupMeans);
      const rBar = calculateMean(subgroupRanges);
      return {
        ucl: xBar + constants.a2 * rBar,
        lcl: xBar - constants.a2 * rBar,
        centerLine: xBar,
        sigma: rBar / constants.d2,
        constants,
      };
    }
    
    case 'ewma':
      return calculateEWMALimits(numericData);
      
    case 'histogram':
    case 'scatterPlot': {
      // For these chart types, just return basic statistics
      const mean = calculateMean(numericData);
      const sigma = calculateStandardDeviation(numericData);
      return {
        ucl: mean + 3 * sigma,
        lcl: mean - 3 * sigma,
        centerLine: mean,
        sigma
      };
    }
      
    default:
      throw new Error(`Unsupported chart type: ${chartType}`);
  }
};

// Calculate EWMA values (for EWMA chart)
export const calculateEWMAValues = (data: number[], lambda = 0.2): number[] => {
  const ewmaValues: number[] = [];
  const firstValue = data[0];
  ewmaValues.push(firstValue);
  
  for (let i = 1; i < data.length; i++) {
    const ewma = lambda * data[i] + (1 - lambda) * ewmaValues[i - 1];
    ewmaValues.push(ewma);
  }
  
  return ewmaValues;
};
