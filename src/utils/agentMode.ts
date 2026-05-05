import { ChartType } from '../types/DataTypes';

const CHART_TYPES: ChartType[] = ['individual', 'pChart', 'npChart', 'cChart', 'uChart', 'xBarS', 'xBarR', 'ewma', 'histogram', 'scatterPlot'];

export interface AgentRecommendation {
  chartType: ChartType | null;
  yColumns: string[];
  xAxisColumn?: string | null;
  denominatorColumn?: string | null;
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

const findMatchingBraceEnd = (content: string, start: number): number | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return null;
};

const extractJsonCandidates = (content: string): unknown[] => {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(/```json\s*([\s\S]*?)```/gi)) {
    const candidate = match[1]?.trim();
    if (candidate) {
      candidates.push(candidate);
    }
  }

  for (const match of content.matchAll(/\{\s*"recommendation"\s*:/g)) {
    const end = findMatchingBraceEnd(content, match.index ?? 0);
    if (end !== null) {
      candidates.push(content.slice(match.index, end));
    }
  }

  return candidates.flatMap((candidate) => {
    if (seen.has(candidate)) {
      return [];
    }
    seen.add(candidate);

    try {
      return [JSON.parse(candidate)];
    } catch {
      return [];
    }
  });
};

const normalizeRecommendationPayload = (parsed: unknown): AgentRecommendation | null => {
  try {
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const payload = parsed as { recommendation?: unknown };
    const recommendation = payload.recommendation;
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

    const denominatorColumn = Object.prototype.hasOwnProperty.call(recommendation, 'denominatorColumn')
      ? (typeof recommendation.denominatorColumn === 'string'
        ? recommendation.denominatorColumn.trim() || null
        : recommendation.denominatorColumn === null
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
      && denominatorColumn === undefined
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
      denominatorColumn,
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

const scoreRecommendation = (recommendation: AgentRecommendation): number => {
  let score = 0;
  if (recommendation.chartType) score += 4;
  score += Math.min(recommendation.yColumns.length, 8) * 3;
  if (recommendation.xAxisColumn !== undefined) score += 1;
  if (recommendation.denominatorColumn !== undefined) score += 2;
  if (recommendation.sampleSize !== undefined) score += 2;
  if (recommendation.chartLabel) score += 1;
  if (recommendation.zAxisLabel) score += 1;
  if (recommendation.yAxisLabel) score += 1;
  if (recommendation.reason) score += 1;
  return score;
};

export const extractAgentRecommendationFromMessage = (content: string): AgentRecommendation | null => {
  const recommendations = extractJsonCandidates(content)
    .map(normalizeRecommendationPayload)
    .filter((recommendation): recommendation is AgentRecommendation => recommendation !== null);

  if (recommendations.length === 0) {
    return null;
  }

  return recommendations.reduce((best, candidate) => (
    scoreRecommendation(candidate) > scoreRecommendation(best) ? candidate : best
  ));
};

export const stripAgentRecommendationFromMessage = (content: string, fallback: string): string => {
  let stripped = content.replace(/```json\s*[\s\S]*?```/gi, (block) => (
    /"recommendation"\s*:/.test(block) ? '' : block
  ));

  const spans: Array<[number, number]> = [];
  for (const match of stripped.matchAll(/\{\s*"recommendation"\s*:/g)) {
    const end = findMatchingBraceEnd(stripped, match.index ?? 0);
    if (end !== null) {
      spans.push([match.index ?? 0, end]);
    }
  }

  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const [start, end] = spans[index];
    stripped = `${stripped.slice(0, start)}${stripped.slice(end)}`;
  }

  stripped = stripped.replace(/\n?\s*(?:json\s*)?\{[\s\S]*"recommendation"[\s\S]*$/i, '');
  stripped = stripped.replace(/^\s*json\s*$/gim, '');

  return stripped.trim() || fallback;
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

  const denominatorColumn = recommendation.denominatorColumn === undefined
    ? undefined
    : recommendation.denominatorColumn === null
      ? null
      : headers.includes(recommendation.denominatorColumn)
        ? recommendation.denominatorColumn
        : undefined;

  return {
    ...recommendation,
    yColumns,
    xAxisColumn,
    denominatorColumn,
    chartLabel: normalizeOptionalLabel(recommendation.chartLabel),
    zAxisLabel: normalizeOptionalLabel(recommendation.zAxisLabel),
    yAxisLabel: normalizeOptionalLabel(recommendation.yAxisLabel),
  };
};
