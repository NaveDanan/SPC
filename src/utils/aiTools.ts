import type { Language } from '../context/LanguageContext';
import type { AiChatMessage } from '../types/AiTypes';
import type { ChartOptions, ChartType, DataSet, ProcessedData } from '../types/DataTypes';

export const LIST_TOOLS_TOOL_NAME = 'list-tools';
export const READ_CONTROLS_TOOL_NAME = 'read_controls';
export const READ_SPC_DIAGNOSTICS_TOOL_NAME = 'read_spc_diagnostics';
export const UPDATE_CONTROLS_TOOL_NAME = 'update_controls';

export const AGENT_CHART_TYPES: ChartType[] = [
  'individual',
  'pChart',
  'npChart',
  'cChart',
  'uChart',
  'xBarS',
  'xBarR',
  'ewma',
  'histogram',
  'scatterPlot',
];

export interface AgentControlsSnapshotInput {
  rawData: DataSet | null;
  selectedChartType: ChartType;
  chartOptions: ChartOptions;
  selectedColumns: string[];
  xAxisColumn: string | null;
  denominatorColumn?: string | null;
  sampleSize: number;
  language: Language;
  agentModeEnabled: boolean;
  selectedAiSheetIndex: number | null;
}

export interface UpdateControlsToolArgs {
  chartType?: ChartType | null;
  yColumns?: string[];
  xAxisColumn?: string | null;
  denominatorColumn?: string | null;
  sampleSize?: number | null;
  chartLabel?: string | null;
  zAxisLabel?: string | null;
  yAxisLabel?: string | null;
  showControlLimits?: boolean;
  showCenterLine?: boolean;
  showRuleViolations?: boolean;
  showSigma1?: boolean;
  showSigma2?: boolean;
  showSigma3?: boolean;
  colorScheme?: string | null;
  reason?: string | null;
}

export interface AgentControlPatch extends UpdateControlsToolArgs {
  chartType?: ChartType | null;
  applied?: string[];
  skipped?: string[];
}

export interface AgentTurnResponse {
  content: string;
  reasoning?: string | null;
  controlPatch?: AgentControlPatch | null;
  toolTrace?: Array<Record<string, unknown>>;
  knowledgeSources?: string[];
  needsClarification?: boolean;
  model?: string;
  usage?: Record<string, number> | null;
}

const clampSampleSize = (value: number) => Math.max(2, Math.min(25, Math.round(value)));

export const buildControlsSnapshot = (input: AgentControlsSnapshotInput) => {
  const { rawData, selectedChartType, chartOptions, selectedColumns, xAxisColumn, denominatorColumn, sampleSize, language, agentModeEnabled, selectedAiSheetIndex } = input;
  const activeSheetIndex = selectedAiSheetIndex ?? rawData?.activeSheetIndex ?? 0;
  const activeSheet = rawData?.sheets?.[activeSheetIndex] ?? null;
  const effectiveSampleSize = (selectedChartType === 'xBarS' || selectedChartType === 'xBarR') && selectedColumns.length > 1
    ? selectedColumns.length
    : sampleSize;

  return {
    current: {
      chartType: selectedChartType,
      yColumns: selectedColumns,
      xAxisColumn,
      denominatorColumn: denominatorColumn ?? null,
      sampleSize,
      effectiveSampleSize,
      chartLabel: chartOptions.title,
      zAxisLabel: chartOptions.xAxisLabel,
      yAxisLabel: chartOptions.yAxisLabel,
      showControlLimits: chartOptions.showControlLimits,
      showCenterLine: chartOptions.showCenterLine,
      showRuleViolations: chartOptions.showRuleViolations,
      showSigma1: chartOptions.showSigma1 ?? false,
      showSigma2: chartOptions.showSigma2 ?? false,
      showSigma3: chartOptions.showSigma3 ?? false,
      colorScheme: chartOptions.colorScheme,
    },
    available: {
      chartTypes: AGENT_CHART_TYPES,
      headers: rawData?.headers ?? [],
      sampleSize: {
        min: 2,
        max: 25,
        current: clampSampleSize(sampleSize),
        effective: clampSampleSize(effectiveSampleSize),
        lockedToYColumns: selectedColumns.length > 1 && (selectedChartType === 'xBarS' || selectedChartType === 'xBarR'),
      },
      editableFields: [
        'chartType',
        'yColumns',
        'xAxisColumn',
        'denominatorColumn',
        'sampleSize',
        'chartLabel',
        'zAxisLabel',
        'yAxisLabel',
        'showControlLimits',
        'showCenterLine',
        'showRuleViolations',
        'showSigma1',
        'showSigma2',
        'showSigma3',
        'colorScheme',
      ],
    },
    worksheet: {
      activeSheetIndex,
      activeSheetName: activeSheet?.name ?? null,
      worksheetCount: rawData?.sheets?.length ?? (rawData ? 1 : 0),
      worksheets: rawData?.sheets?.map((sheet, index) => ({
        index,
        name: sheet.name,
        rows: sheet.data.length,
        columns: sheet.headers.length,
      })) ?? [],
    },
    assistant: {
      language,
      agentModeEnabled,
      tools: [LIST_TOOLS_TOOL_NAME, READ_CONTROLS_TOOL_NAME, READ_SPC_DIAGNOSTICS_TOOL_NAME, UPDATE_CONTROLS_TOOL_NAME],
    },
  };
};

export const selectControlsSnapshotSections = (
  snapshot: ReturnType<typeof buildControlsSnapshot>,
  include?: string[],
) => {
  if (!include || include.length === 0) {
    return snapshot;
  }

  const selectedEntries = include
    .filter((key): key is keyof typeof snapshot => key in snapshot)
    .map((key) => [key, snapshot[key]]);

  return Object.fromEntries(selectedEntries);
};

const summarizeProcessedData = (processedData: ProcessedData | null) => {
  if (!processedData) {
    return null;
  }

  return {
    statistics: processedData.statistics,
    ruleViolationCount: processedData.ruleViolations.length,
    controlLimits: processedData.controlLimits,
    dataProfile: processedData.dataProfile,
    diagnostics: processedData.diagnostics,
    chartRecommendations: processedData.chartRecommendations,
    capabilityStatus: processedData.capabilityStatus,
  };
};

export const buildAgentTurnRequest = (
  input: AgentControlsSnapshotInput,
  conversationForRequest: AiChatMessage[],
  options: {
    model: string;
    systemPrompt: string;
    datasetSummary: string | null;
    processedData: ProcessedData | null;
    temperature?: number;
  },
) => {
  const snapshot = buildControlsSnapshot(input);
  const rawData = input.rawData;

  return {
    model: options.model,
    language: input.language,
    messages: [
      { role: 'system', content: options.systemPrompt },
      ...conversationForRequest.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
    controls: snapshot.current,
    availableHeaders: rawData?.headers ?? [],
    worksheet: snapshot.worksheet,
    dataset: {
      summary: options.datasetSummary,
      fileName: rawData?.fileName ?? null,
      fileType: rawData?.fileType ?? null,
      rowCount: rawData?.data.length ?? 0,
      columnCount: rawData?.headers.length ?? 0,
      headers: rawData?.headers ?? [],
      previewRows: rawData?.data.slice(0, 5) ?? [],
    },
    processed: summarizeProcessedData(options.processedData),
    selectedSheetIndex: input.selectedAiSheetIndex,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
  };
};
