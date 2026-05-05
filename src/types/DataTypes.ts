export type ChartType = 'individual' | 'pChart' | 'npChart' | 'cChart' | 'uChart' | 'xBarS' | 'xBarR' | 'ewma' | 'histogram' | 'scatterPlot';

export type Primitive = string | number | boolean | null | undefined;

export interface DataPoint {
  [key: string]: Primitive;
}

export interface DataSelectionRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
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
  parseWarning?: string;
  sheets?: Sheet[];        // All sheets if multi-sheet workbook
  activeSheetIndex?: number; // Index of active sheet in sheets
}

export interface ControlLimits {
  ucl: number;       // Upper Control Limit
  lcl: number;       // Lower Control Limit
  centerLine: number; // Center Line (usually the mean)
  sigma: number;     // Process standard deviation
  uclSeries?: number[]; // Pointwise upper limits for variable-denominator charts
  lclSeries?: number[]; // Pointwise lower limits for variable-denominator charts
  sigmaSeries?: number[]; // Pointwise sigma for zones and diagnostics
  denominatorSeries?: number[]; // Per-point subgroup/opportunity size when relevant
  chartValues?: number[]; // Values actually plotted/analyzed when derived from counts
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

export type DiagnosticSeverity = 'info' | 'warning' | 'blocker';
export type DataKind = 'continuous' | 'count' | 'proportion' | 'binary' | 'mixed' | 'unknown';
export type CapabilityReadiness = 'ready' | 'preliminary' | 'notApplicable';

export interface SpcDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
}

export interface DataProfile {
  column: string | null;
  denominatorColumn?: string | null;
  rowCount: number;
  numericCount: number;
  missingCount: number;
  nonNumericCount: number;
  uniqueNumericCount: number;
  tieRate: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  standardDeviation: number | null;
  skewness: number | null;
  lag1Autocorrelation: number | null;
  dataKind: DataKind;
  integerLike: boolean;
  nonNegative: boolean;
  hasVaryingDenominator: boolean;
  denominatorMin?: number | null;
  denominatorMax?: number | null;
  timeOrdered: boolean;
}

export interface ChartRecommendation {
  chartType: ChartType;
  score: number;
  status: 'recommended' | 'possible' | 'notRecommended';
  reason: string;
}

export interface CapabilityIndices {
  cp: number;
  cpl: number;
  cpu: number;
  cpk: number;
  pp: number;
  ppl: number;
  ppu: number;
  ppk: number;
  cpm: number;
}

export interface CapabilityStatus {
  readiness: CapabilityReadiness;
  indices: CapabilityIndices;
  reasons: string[];
}

export interface ProcessedData {
  data: DataPoint[];
  controlLimits: ControlLimits;
  ruleViolations: RuleViolation[];
  statistics: Statistics;
  dataProfile?: DataProfile;
  diagnostics?: SpcDiagnostic[];
  chartRecommendations?: ChartRecommendation[];
  capabilityStatus?: CapabilityStatus;
}

export interface ChartOptions {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  lowerSpecLimit?: number | null;
  upperSpecLimit?: number | null;
  targetValue?: number | null;
  showControlLimits: boolean;
  showCenterLine: boolean;
  showRuleViolations: boolean;
  colorScheme: string;
  showSigma1?: boolean;
  showSigma2?: boolean;
  showSigma3?: boolean;
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
