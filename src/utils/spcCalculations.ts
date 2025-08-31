import jStat from 'jstat';
import { ControlLimits, ChartType, DataPoint } from '../types/DataTypes';

// Helper to compute B3/B4 from c4
const computeB3B4 = (c4: number) => {
  const k = (3 / c4) * Math.sqrt(Math.max(0, 1 - c4 * c4));
  const b3 = Math.max(0, 1 - k);
  const b4 = 1 + k;
  return { b3, b4 };
};

// Constants for control charts based on sample size (n = 2..25)
const controlChartConstants: Record<number, any> = {
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

// Calculate control limits for P Chart (proportion)
export const calculatePChartLimits = (data: number[], sampleSize: number): ControlLimits => {
  const p = calculateMean(data);
  const sigma = Math.sqrt(p * (1 - p) / sampleSize);
  
  return {
    ucl: p + 3 * sigma,
    lcl: Math.max(0, p - 3 * sigma), // LCL can't be negative for p charts
    centerLine: p,
    sigma
  };
};

// Calculate control limits for NP Chart
export const calculateNPChartLimits = (data: number[], sampleSize: number): ControlLimits => {
  const np = calculateMean(data);
  const p = np / sampleSize;
  const sigma = Math.sqrt(sampleSize * p * (1 - p));
  
  return {
    ucl: np + 3 * sigma,
    lcl: Math.max(0, np - 3 * sigma), // LCL can't be negative for np charts
    centerLine: np,
    sigma
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
  
  // For EWMA, control limits vary by point
  // These are the asymptotic limits
  const asymptotic_factor = Math.sqrt(lambda / (2 - lambda));
  
  return {
    ucl: mean + 3 * sigma * asymptotic_factor,
    lcl: mean - 3 * sigma * asymptotic_factor,
    centerLine: mean,
    sigma
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
  sampleSize: number
): ControlLimits => {
  // Extract numerical data from the specified column
  const numericData = data.map(row => parseFloat(row[column])).filter(val => !isNaN(val));
  
  switch (chartType) {
    case 'individual':
      return calculateIndividualControlLimits(numericData);
      
    case 'pChart':
      return calculatePChartLimits(numericData, sampleSize);
      
    case 'npChart':
      return calculateNPChartLimits(numericData, sampleSize);
      
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
    case 'scatterPlot':
      // For these chart types, just return basic statistics
      const mean = calculateMean(numericData);
      const sigma = calculateStandardDeviation(numericData);
      return {
        ucl: mean + 3 * sigma,
        lcl: mean - 3 * sigma,
        centerLine: mean,
        sigma
      };
      
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
