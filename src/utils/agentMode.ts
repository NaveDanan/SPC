import { ChartType } from '../types/DataTypes';

const CHART_TYPES: ChartType[] = ['individual', 'pChart', 'npChart', 'xBarS', 'xBarR', 'ewma', 'histogram', 'scatterPlot'];

export interface AgentRecommendation {
  chartType: ChartType | null;
  yColumns: string[];
  xAxisColumn?: string | null;
  sampleSize?: number;
  chartLabel?: string;
  zAxisLabel?: string;
  yAxisLabel?: string;
  reason: string;
}

const normalizeOptionalLabel = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const extractAgentRecommendationFromMessage = (content: string): AgentRecommendation | null => {
  const jsonFenceMatch = content.match(/```json\s*([\s\S]*?)```/i);
  if (!jsonFenceMatch?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonFenceMatch[1]);
    const recommendation = parsed?.recommendation;
    if (!recommendation || typeof recommendation !== 'object') {
      return null;
    }

    const chartTypeRaw = recommendation.chartType;
    const chartType = typeof chartTypeRaw === 'string' && CHART_TYPES.includes(chartTypeRaw as ChartType)
      ? (chartTypeRaw as ChartType)
      : null;

    const yColumnsRaw: unknown[] = Array.isArray(recommendation.yColumns)
      ? recommendation.yColumns
      : [];
    const yColumnsFromArray = yColumnsRaw
      .filter((column): column is string => typeof column === 'string')
      .map((column) => column.trim())
      .filter((column) => column.length > 0);

    const yColumnLegacy = typeof recommendation.yColumn === 'string' && recommendation.yColumn.trim()
      ? recommendation.yColumn.trim()
      : null;

    const yColumns = yColumnsFromArray.length > 0
      ? Array.from(new Set(yColumnsFromArray))
      : yColumnLegacy
        ? [yColumnLegacy]
        : [];

    const xAxisColumn = Object.prototype.hasOwnProperty.call(recommendation, 'xAxisColumn')
      ? (typeof recommendation.xAxisColumn === 'string'
        ? recommendation.xAxisColumn.trim() || null
        : recommendation.xAxisColumn === null
          ? null
          : undefined)
      : undefined;

    const sampleSize = Object.prototype.hasOwnProperty.call(recommendation, 'sampleSize')
      ? (typeof recommendation.sampleSize === 'number' && Number.isFinite(recommendation.sampleSize)
        ? Math.max(2, Math.min(25, Math.round(recommendation.sampleSize)))
        : undefined)
      : undefined;

    const chartLabel = normalizeOptionalLabel(recommendation.chartLabel);
    const zAxisLabel = normalizeOptionalLabel(recommendation.zAxisLabel ?? recommendation.xAxisLabel);
    const yAxisLabel = normalizeOptionalLabel(recommendation.yAxisLabel);

    const reason = typeof recommendation.reason === 'string' && recommendation.reason.trim()
      ? recommendation.reason.trim()
      : '';

    if (
      !chartType
      && yColumns.length === 0
      && xAxisColumn === undefined
      && sampleSize === undefined
      && chartLabel === undefined
      && zAxisLabel === undefined
      && yAxisLabel === undefined
      && !reason
    ) {
      return null;
    }

    return {
      chartType,
      yColumns,
      xAxisColumn,
      sampleSize,
      chartLabel,
      zAxisLabel,
      yAxisLabel,
      reason,
    };
  } catch {
    return null;
  }
};

export const validateAgentRecommendationAgainstHeaders = (
  recommendation: AgentRecommendation,
  headers: string[],
): AgentRecommendation => {
  const yColumns = recommendation.yColumns.filter((column) => headers.includes(column));

  const xAxisColumn = recommendation.xAxisColumn === undefined
    ? undefined
    : recommendation.xAxisColumn === null
      ? null
      : headers.includes(recommendation.xAxisColumn)
        ? recommendation.xAxisColumn
        : undefined;

  return {
    ...recommendation,
    yColumns,
    xAxisColumn,
    chartLabel: normalizeOptionalLabel(recommendation.chartLabel),
    zAxisLabel: normalizeOptionalLabel(recommendation.zAxisLabel),
    yAxisLabel: normalizeOptionalLabel(recommendation.yAxisLabel),
  };
};
