import {
  ChartRecommendation,
  ChartType,
  DataKind,
  DataPoint,
  DataProfile,
  SpcDiagnostic,
} from '../types/DataTypes';
import { calculateMean, calculateStandardDeviation } from './spcCalculations';

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferDataKind = (values: number[]): DataKind => {
  if (!values.length) return 'unknown';
  const nonNegative = values.every((value) => value >= 0);
  const integerLike = values.every((value) => Number.isInteger(value));
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (nonNegative && values.every((value) => value === 0 || value === 1)) return 'binary';
  if (nonNegative && min >= 0 && max <= 1 && !integerLike) return 'proportion';
  if (nonNegative && integerLike) return 'count';
  if (!integerLike) return 'continuous';
  return 'mixed';
};

const calculateSkewness = (values: number[]): number | null => {
  if (values.length < 3) return null;
  const mean = calculateMean(values);
  const sigma = calculateStandardDeviation(values);
  if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0) return null;
  const thirdMoment = values.reduce((sum, value) => sum + ((value - mean) / sigma) ** 3, 0) / values.length;
  return thirdMoment;
};

const calculateLag1Autocorrelation = (values: number[]): number | null => {
  if (values.length < 3) return null;
  const mean = calculateMean(values);
  const numerator = values.slice(1).reduce((sum, value, index) => (
    sum + (values[index] - mean) * (value - mean)
  ), 0);
  const denominator = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return denominator > 0 ? numerator / denominator : null;
};

const isTimeOrdered = (rows: DataPoint[], xAxisColumn?: string | null): boolean => {
  if (!xAxisColumn) {
    return rows.length > 1;
  }
  const timestamps = rows.map((row) => Date.parse(String(row[xAxisColumn] ?? '')));
  const finite = timestamps.filter(Number.isFinite);
  if (finite.length < Math.max(2, Math.floor(rows.length * 0.8))) {
    return false;
  }
  for (let index = 1; index < finite.length; index += 1) {
    if (finite[index] < finite[index - 1]) {
      return false;
    }
  }
  return true;
};

const addDiagnostic = (
  diagnostics: SpcDiagnostic[],
  severity: SpcDiagnostic['severity'],
  code: string,
  message: string,
) => diagnostics.push({ severity, code, message });

const recommendation = (
  chartType: ChartType,
  score: number,
  status: ChartRecommendation['status'],
  reason: string,
): ChartRecommendation => ({ chartType, score, status, reason });

const rankRecommendations = (params: {
  chartType: ChartType;
  dataKind: DataKind;
  sampleSize: number;
  rowCount: number;
  hasDenominator: boolean;
  hasMultipleYColumns: boolean;
  timeOrdered: boolean;
}): ChartRecommendation[] => {
  const { dataKind, sampleSize, rowCount, hasDenominator, hasMultipleYColumns, timeOrdered } = params;
  const subgroups = Math.floor(rowCount / Math.max(2, sampleSize));
  const recommendations: ChartRecommendation[] = [];

  if (dataKind === 'proportion' || dataKind === 'binary') {
    recommendations.push(recommendation('pChart', 94, 'recommended', 'Proportion or pass/fail data fits a P chart.'));
    recommendations.push(recommendation('npChart', 72, 'possible', 'Use NP only when subgroup size is constant.'));
  } else if (dataKind === 'count') {
    recommendations.push(recommendation(hasDenominator ? 'uChart' : 'cChart', 92, 'recommended', hasDenominator ? 'Defect counts with opportunities fit a U chart.' : 'Defect counts with constant area fit a C chart.'));
    recommendations.push(recommendation(hasDenominator ? 'pChart' : 'npChart', 74, 'possible', hasDenominator ? 'Use P when counts are nonconforming units out of inspected units.' : 'Use NP for nonconforming counts with constant sample size.'));
  } else if (dataKind === 'continuous' || dataKind === 'mixed') {
    if (hasMultipleYColumns || subgroups >= 5) {
      recommendations.push(recommendation(sampleSize <= 10 ? 'xBarR' : 'xBarS', 90, 'recommended', 'Rational subgroups allow mean and variation monitoring.'));
      recommendations.push(recommendation(sampleSize <= 10 ? 'xBarS' : 'xBarR', 78, 'possible', 'Alternative subgroup chart depending on subgroup size and variation estimate.'));
    }
    recommendations.push(recommendation('individual', hasMultipleYColumns ? 68 : 88, hasMultipleYColumns ? 'possible' : 'recommended', 'Use I-MR when each row is one continuous observation.'));
    if (timeOrdered) {
      recommendations.push(recommendation('ewma', 76, 'possible', 'EWMA is useful for small persistent shifts in ordered data.'));
    }
    recommendations.push(recommendation('histogram', 55, 'possible', 'Use as distribution context, not as a control chart.'));
  } else {
    recommendations.push(recommendation('individual', 50, 'possible', 'Default to I-MR only after confirming the data are continuous and ordered.'));
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      ...item,
      status: item.chartType === params.chartType && item.status === 'possible' ? 'recommended' : item.status,
    }));
};

export const buildSpcDiagnostics = (params: {
  rows: DataPoint[];
  column: string | null;
  denominatorColumn?: string | null;
  xAxisColumn?: string | null;
  chartType: ChartType;
  sampleSize: number;
  selectedColumns: string[];
}): {
  profile: DataProfile;
  diagnostics: SpcDiagnostic[];
  recommendations: ChartRecommendation[];
  numericValues: number[];
} => {
  const { rows, column, denominatorColumn, xAxisColumn, chartType, sampleSize, selectedColumns } = params;
  const rawValues = column ? rows.map((row) => row[column]) : [];
  const numericValues = rawValues.map(parseNumber).filter((value): value is number => value !== null);
  const missingCount = rawValues.filter((value) => value === null || value === undefined || String(value).trim() === '').length;
  const nonNumericCount = rawValues.length - missingCount - numericValues.length;
  const uniqueNumericCount = new Set(numericValues.map((value) => value.toPrecision(12))).size;
  const dataKind = inferDataKind(numericValues);
  const denominatorValues = denominatorColumn
    ? rows.map((row) => parseNumber(row[denominatorColumn])).filter((value): value is number => value !== null && value > 0)
    : [];
  const denominatorUniqueCount = new Set(denominatorValues.map((value) => value.toPrecision(12))).size;
  const timeOrdered = isTimeOrdered(rows, xAxisColumn);
  const mean = numericValues.length ? calculateMean(numericValues) : null;
  const standardDeviation = numericValues.length > 1 ? calculateStandardDeviation(numericValues) : null;
  const profile: DataProfile = {
    column,
    denominatorColumn,
    rowCount: rows.length,
    numericCount: numericValues.length,
    missingCount,
    nonNumericCount,
    uniqueNumericCount,
    tieRate: numericValues.length ? 1 - (uniqueNumericCount / numericValues.length) : 0,
    min: numericValues.length ? Math.min(...numericValues) : null,
    max: numericValues.length ? Math.max(...numericValues) : null,
    mean,
    standardDeviation,
    skewness: calculateSkewness(numericValues),
    lag1Autocorrelation: calculateLag1Autocorrelation(numericValues),
    dataKind,
    integerLike: numericValues.every((value) => Number.isInteger(value)),
    nonNegative: numericValues.every((value) => value >= 0),
    hasVaryingDenominator: denominatorUniqueCount > 1,
    denominatorMin: denominatorValues.length ? Math.min(...denominatorValues) : null,
    denominatorMax: denominatorValues.length ? Math.max(...denominatorValues) : null,
    timeOrdered,
  };

  const diagnostics: SpcDiagnostic[] = [];
  if (!column) {
    addDiagnostic(diagnostics, 'blocker', 'missing-y-column', 'Select a Y column before running SPC analysis.');
  }
  if (numericValues.length < 2) {
    addDiagnostic(diagnostics, 'blocker', 'too-few-numeric-values', 'At least two numeric values are required for control limits.');
  } else if (numericValues.length < 20) {
    addDiagnostic(diagnostics, 'warning', 'small-baseline', 'Fewer than 20 observations makes control limits preliminary.');
  }
  if (missingCount || nonNumericCount) {
    addDiagnostic(diagnostics, 'warning', 'non-numeric-values', `${missingCount + nonNumericCount} selected values are blank or non-numeric.`);
  }
  if (selectedColumns.length > 1 && chartType !== 'xBarR' && chartType !== 'xBarS') {
    addDiagnostic(diagnostics, 'info', 'multiple-y-columns', 'Only X-bar charts use multiple Y columns as one rational subgroup.');
  }
  if (profile.tieRate > 0.35 && numericValues.length >= 20) {
    addDiagnostic(diagnostics, 'warning', 'high-tie-rate', 'Many repeated values suggest gage resolution or rounded data may affect rules.');
  }
  if (Math.abs(profile.lag1Autocorrelation ?? 0) > 0.35) {
    addDiagnostic(diagnostics, 'warning', 'autocorrelation', 'Lag-1 autocorrelation is high; consider sampling interval or EWMA context.');
  }
  if (Math.abs(profile.skewness ?? 0) > 1) {
    addDiagnostic(diagnostics, 'warning', 'skewed-data', 'Strong skew can distort normal-theory limits and capability.');
  }
  if (!timeOrdered && ['individual', 'ewma', 'xBarR', 'xBarS'].includes(chartType)) {
    addDiagnostic(diagnostics, 'warning', 'time-order-unclear', 'Time ordering is unclear; control charts require process-order sequencing.');
  }
  if (['npChart', 'cChart', 'uChart'].includes(chartType) && (!profile.integerLike || !profile.nonNegative)) {
    addDiagnostic(diagnostics, 'blocker', 'count-data-required', 'This chart requires non-negative integer count data.');
  }
  if (chartType === 'pChart' && !denominatorColumn && dataKind !== 'proportion' && dataKind !== 'binary') {
    addDiagnostic(diagnostics, 'blocker', 'p-chart-needs-proportions', 'P charts need proportions or a denominator column with nonconforming counts.');
  }
  if ((chartType === 'pChart' || chartType === 'uChart') && denominatorColumn && denominatorValues.length < numericValues.length) {
    addDiagnostic(diagnostics, 'blocker', 'invalid-denominators', 'P/U charts need a positive denominator for every analyzed row.');
  }
  if ((chartType === 'xBarR' || chartType === 'xBarS') && Math.floor(numericValues.length / Math.max(2, sampleSize)) < 2 && selectedColumns.length <= 1) {
    addDiagnostic(diagnostics, 'blocker', 'too-few-subgroups', 'X-bar charts need at least two complete subgroups.');
  }

  return {
    profile,
    diagnostics,
    recommendations: rankRecommendations({
      chartType,
      dataKind,
      sampleSize,
      rowCount: rows.length,
      hasDenominator: Boolean(denominatorColumn),
      hasMultipleYColumns: selectedColumns.length > 1,
      timeOrdered,
    }),
    numericValues,
  };
};
