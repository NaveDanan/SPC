import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiAssistantPanel from './AiAssistantPanel';

const setSelectedChartType = vi.fn();
const setSelectedColumns = vi.fn();
const setXAxisColumn = vi.fn();
const setDenominatorColumn = vi.fn();
const setSampleSize = vi.fn();
const setChartOptions = vi.fn();
const fetchMock = vi.fn();

const chatResponse = (content: string) => ({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => ({
    choices: [
      {
        message: { content },
      },
    ],
  }),
  statusText: 'OK',
});

const agentResponse = (content: string, controlPatch: Record<string, unknown> | null = null) => ({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => ({
    content,
    controlPatch,
    toolTrace: controlPatch ? [{ tool: 'update_controls', result: { patch: controlPatch } }] : [],
    knowledgeSources: ['xbar-r.md'],
    needsClarification: false,
    model: 'test-model',
  }),
  statusText: 'OK',
});

const appContextMock: any = {
  rawData: {
    data: [
      { A: 1, B: 2, Date: '2024-01-01' },
      { A: 2, B: 3, Date: '2024-01-02' },
    ],
    headers: ['A', 'B', 'Date'],
    fileName: 'test.xlsx',
    fileType: 'xlsx',
    sheets: [{ name: 'Sheet1', data: [{ A: 1, B: 2, Date: '2024-01-01' }], headers: ['A', 'B', 'Date'] }],
    activeSheetIndex: 0,
  },
  processedData: null,
  selectedColumns: ['A'],
  xAxisColumn: null,
  denominatorColumn: null,
  sampleSize: 3,
  selectedChartType: 'individual',
  chartOptions: {
    title: 'SPC Analysis Chart',
    xAxisLabel: 'Sample',
    yAxisLabel: 'Value',
    showControlLimits: true,
    showCenterLine: true,
    showRuleViolations: true,
    colorScheme: 'default',
    showSigma1: true,
    showSigma2: true,
    showSigma3: true,
  },
  setSelectedChartType,
  setChartOptions,
  setSelectedColumns,
  setXAxisColumn,
  setDenominatorColumn,
  setSampleSize,
  setActiveSheetIndex: vi.fn(),
};

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => appContextMock,
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
  }),
}));

vi.mock('../common/MarkdownText', () => ({
  MarkdownText: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe('AiAssistantPanel Agent Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    appContextMock.rawData = {
      data: [
        { A: 1, B: 2, Date: '2024-01-01' },
        { A: 2, B: 3, Date: '2024-01-02' },
      ],
      headers: ['A', 'B', 'Date'],
      fileName: 'test.xlsx',
      fileType: 'xlsx',
      sheets: [{ name: 'Sheet1', data: [{ A: 1, B: 2, Date: '2024-01-01' }], headers: ['A', 'B', 'Date'] }],
      activeSheetIndex: 0,
    };
    appContextMock.selectedColumns = ['A'];
    appContextMock.xAxisColumn = null;
    appContextMock.denominatorColumn = null;
    appContextMock.sampleSize = 3;
    appContextMock.selectedChartType = 'individual';
    appContextMock.chartOptions = {
      title: 'SPC Analysis Chart',
      xAxisLabel: 'Sample',
      yAxisLabel: 'Value',
      showControlLimits: true,
      showCenterLine: true,
      showRuleViolations: true,
      colorScheme: 'default',
      showSigma1: true,
      showSigma2: true,
      showSigma3: true,
    };

    fetchMock
      .mockResolvedValueOnce(chatResponse('- Initial chart recommendation.'))
      .mockResolvedValue(agentResponse('- Applied X-bar R settings.', {
        chartType: 'xBarR',
        yColumns: ['A', 'B'],
        xAxisColumn: 'Date',
        sampleSize: 4,
        chartLabel: 'XBar-R by Date',
        zAxisLabel: 'Collection Date',
        yAxisLabel: 'Defect Count',
      }));

    vi.stubGlobal('fetch', fetchMock);
  });

  it('auto-applies recommendation after enabling Agent Mode', async () => {
    render(<AiAssistantPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { pressed: false }));

    await waitFor(() => {
      expect(setSelectedChartType).toHaveBeenCalledWith('xBarR');
      expect(setSelectedColumns).toHaveBeenCalledWith(['A', 'B']);
      expect(setXAxisColumn).toHaveBeenCalledWith('Date');
      expect(setSampleSize).toHaveBeenCalledWith(2);
      expect(setChartOptions).toHaveBeenCalledWith({
        ...appContextMock.chartOptions,
        title: 'XBar-R by Date',
        xAxisLabel: 'Collection Date',
        yAxisLabel: 'Defect Count',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('auto-applies X-bar S multi-sample recommendations to chart controls', async () => {
    fetchMock.mockReset();
    appContextMock.rawData = {
      data: [
        { Sample_1: 11, Sample_2: 12, Sample_3: 10, Sample_4: 13, Sample_5: 12 },
        { Sample_1: 12, Sample_2: 13, Sample_3: 11, Sample_4: 14, Sample_5: 13 },
      ],
      headers: ['Sample_1', 'Sample_2', 'Sample_3', 'Sample_4', 'Sample_5'],
      fileName: 'samples.xlsx',
      fileType: 'xlsx',
      sheets: [
        {
          name: 'Sheet1',
          data: [{ Sample_1: 11, Sample_2: 12, Sample_3: 10, Sample_4: 13, Sample_5: 12 }],
          headers: ['Sample_1', 'Sample_2', 'Sample_3', 'Sample_4', 'Sample_5'],
        },
      ],
      activeSheetIndex: 0,
    };

    fetchMock
      .mockResolvedValueOnce(chatResponse('- Initial non-agent recommendation.'))
      .mockResolvedValueOnce(agentResponse('- Switch to X-bar S chart.', {
        chartType: 'xBarS',
        yColumns: ['Sample_1', 'Sample_2', 'Sample_3', 'Sample_4', 'Sample_5'],
        xAxisColumn: null,
        sampleSize: 2,
        chartLabel: 'X-bar and S Control Chart',
        zAxisLabel: 'Subgroup Index',
        yAxisLabel: 'Measurement Value',
      }));

    render(<AiAssistantPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { pressed: false }));

    await waitFor(() => {
      expect(setSelectedChartType).toHaveBeenCalledWith('xBarS');
      expect(setSelectedColumns).toHaveBeenCalledWith(['Sample_1', 'Sample_2', 'Sample_3', 'Sample_4', 'Sample_5']);
      expect(setXAxisColumn).toHaveBeenCalledWith(null);
      expect(setSampleSize).toHaveBeenCalledWith(5);
      expect(setChartOptions).toHaveBeenCalledWith({
        ...appContextMock.chartOptions,
        title: 'X-bar and S Control Chart',
        xAxisLabel: 'Subgroup Index',
        yAxisLabel: 'Measurement Value',
      });
    });
  });

  it('posts Agent Mode state to the DSPy agent endpoint and applies the returned patch', async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(chatResponse('- Initial chart recommendation.'))
      .mockResolvedValueOnce(agentResponse('- Read the current controls and updated the chart configuration.', {
        chartType: 'xBarR',
        yColumns: ['A', 'B'],
        xAxisColumn: 'Date',
        chartLabel: 'XBar-R by Date',
        zAxisLabel: 'Collection Date',
        yAxisLabel: 'Defect Count',
      }));

    render(<AiAssistantPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { pressed: false }));

    await waitFor(() => {
      expect(setSelectedChartType).toHaveBeenCalledWith('xBarR');
      expect(setSelectedColumns).toHaveBeenCalledWith(['A', 'B']);
      expect(setXAxisColumn).toHaveBeenCalledWith('Date');
      expect(setSampleSize).toHaveBeenCalledWith(2);
      expect(setChartOptions).toHaveBeenCalledWith({
        ...appContextMock.chartOptions,
        title: 'XBar-R by Date',
        xAxisLabel: 'Collection Date',
        yAxisLabel: 'Defect Count',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const agentRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[1][0]).toContain('/v1/agent/turn');
    expect(agentRequest.tools).toBeUndefined();
    expect(agentRequest.controls.chartType).toBe('individual');
    expect(agentRequest.controls.denominatorColumn).toBeNull();
    expect(agentRequest.availableHeaders).toEqual(['A', 'B', 'Date']);
    expect(agentRequest.dataset.previewRows).toHaveLength(2);
  });

  it('applies denominator column patches for attribute charts', async () => {
    fetchMock.mockReset();
    appContextMock.rawData = {
      data: [
        { Defects: 3, Opportunities: 100, Date: '2024-01-01' },
        { Defects: 5, Opportunities: 120, Date: '2024-01-02' },
      ],
      headers: ['Defects', 'Opportunities', 'Date'],
      fileName: 'defects.xlsx',
      fileType: 'xlsx',
      sheets: [{ name: 'Sheet1', data: [{ Defects: 3, Opportunities: 100, Date: '2024-01-01' }], headers: ['Defects', 'Opportunities', 'Date'] }],
      activeSheetIndex: 0,
    };
    appContextMock.selectedColumns = ['Defects'];

    fetchMock
      .mockResolvedValueOnce(chatResponse('- Initial chart recommendation.'))
      .mockResolvedValueOnce(agentResponse('- Applied U chart settings.', {
        chartType: 'uChart',
        yColumns: ['Defects'],
        denominatorColumn: 'Opportunities',
        xAxisColumn: 'Date',
      }));

    render(<AiAssistantPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { pressed: false }));

    await waitFor(() => {
      expect(setSelectedChartType).toHaveBeenCalledWith('uChart');
      expect(setSelectedColumns).toHaveBeenCalledWith(['Defects']);
      expect(setDenominatorColumn).toHaveBeenCalledWith('Opportunities');
      expect(setXAxisColumn).toHaveBeenCalledWith('Date');
    });
  });
});
