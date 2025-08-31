export type ChartType = 'individual' | 'pChart' | 'npChart' | 'xBarS' | 'ewma' | 'histogram' | 'scatterPlot';

export interface DataPoint {
  [key: string]: any;
}

export interface Sheet {
  name: string;
  data: DataPoint[];
  headers: string[];
}

export interface DataSet {
  data: DataPoint[];       // Active sheet data (for backward compatibility)
  headers: string[];       // Active sheet headers
  fileName: string;
  fileType: string;
  sheets?: Sheet[];        // All sheets if multi-sheet workbook
  activeSheetIndex?: number; // Index of active sheet in sheets
}

export interface ControlLimits {
  ucl: number;       // Upper Control Limit
  lcl: number;       // Lower Control Limit
  centerLine: number; // Center Line (usually the mean)
  sigma: number;     // Process standard deviation
  constants?: {      // Control chart constants
    a2?: number;     // Constant for X-bar R chart
    a3?: number;     // Constant for X-bar S chart
    b3?: number;     // Constant for S chart LCL
    b4?: number;     // Constant for S chart UCL
    c4?: number;     // Constant for S chart center line
    d2?: number;     // Constant for R chart
    d3?: number;     // Constant for R chart LCL
    d4?: number;     // Constant for R chart UCL
  };
}

export interface RuleViolation {
  index: number;
  pointValue: number;
  ruleNumber: number;
  description: string;
}

export interface Statistics {
  mean: number;
  standardDeviation: number;
  min: number;
  max: number;
  count: number;
}

export interface ProcessedData {
  data: DataPoint[];
  controlLimits: ControlLimits;
  ruleViolations: RuleViolation[];
  statistics: Statistics;
}

export interface ChartOptions {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  showControlLimits: boolean;
  showCenterLine: boolean;
  showRuleViolations: boolean;
  colorScheme: string;
}

export interface ChartCustomization {
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showControlLimits?: boolean;
  showCenterLine?: boolean;
  showRuleViolations?: boolean;
  colorScheme?: string;
}