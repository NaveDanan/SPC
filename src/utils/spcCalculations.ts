import jStat from 'jstat';
import { ControlLimits, ChartType, DataPoint } from '../types/DataTypes';

// Constants for control charts based on sample size
const controlChartConstants: Record<number, any> = {
  2: { a2: 1.880, a3: 2.659, c4: 0.7979, b3: 0, b4: 3.267, d2: 1.128, d3: 0, d4: 3.267 },
  3: { a2: 1.023, a3: 1.954, c4: 0.8862, b3: 0, b4: 2.568, d2: 1.693, d3: 0, d4: 2.574 },
  4: { a2: 0.729, a3: 1.628, c4: 0.9213, b3: 0, b4: 2.266, d2: 2.059, d3: 0, d4: 2.282 },
  5: { a2: 0.577, a3: 1.427, c4: 0.9400, b3: 0, b4: 2.089, d2: 2.326, d3: 0, d4: 2.114 },
  6: { a2: 0.483, a3: 1.287, c4: 0.9515, b3: 0.030, b4: 1.970, d2: 2.534, d3: 0, d4: 2.004 },
  7: { a2: 0.419, a3: 1.182, c4: 0.9594, b3: 0.118, b4: 1.882, d2: 2.704, d3: 0.076, d4: 1.924 },
  8: { a2: 0.373, a3: 1.099, c4: 0.9650, b3: 0.185, b4: 1.815, d2: 2.847, d3: 0.136, d4: 1.864 },
  9: { a2: 0.337, a3: 1.032, c4: 0.9693, b3: 0.239, b4: 1.761, d2: 2.970, d3: 0.184, d4: 1.816 },
  10: { a2: 0.308, a3: 0.975, c4: 0.9727, b3: 0.284, b4: 1.716, d2: 3.078, d3: 0.223, d4: 1.777 },
  // Add more constants for larger sample sizes if needed
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