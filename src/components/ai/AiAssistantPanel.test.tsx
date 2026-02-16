import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiAssistantPanel from './AiAssistantPanel';

const setSelectedChartType = vi.fn();
const setSelectedColumns = vi.fn();
const setXAxisColumn = vi.fn();
const setSampleSize = vi.fn();
const setChartOptions = vi.fn();
const fetchMock = vi.fn();

const appContextMock = {
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

    fetchMock.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          choices: [
            {
              message: {
                content: `- Applying\n\n\`\`\`json
{"recommendation":{"chartType":"xBarR","yColumns":["A","B"],"xAxisColumn":"Date","sampleSize":4,"chartLabel":"XBar-R by Date","zAxisLabel":"Collection Date","yAxisLabel":"Defect Count","reason":"subgroups"}}
\`\`\``,
              },
            },
          ],
        }),
        statusText: 'OK',
      });

    vi.stubGlobal('fetch', fetchMock);
  });

  it('auto-applies recommendation after enabling Agent Mode', async () => {
    render(<AiAssistantPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('ai.agentModeOff'));

    await waitFor(() => {
      expect(setSelectedChartType).toHaveBeenCalledWith('xBarR');
      expect(setSelectedColumns).toHaveBeenCalledWith(['A', 'B']);
      expect(setXAxisColumn).toHaveBeenCalledWith('Date');
      expect(setSampleSize).toHaveBeenCalledWith(4);
      expect(setChartOptions).toHaveBeenCalledWith({
        ...appContextMock.chartOptions,
        title: 'XBar-R by Date',
        xAxisLabel: 'Collection Date',
        yAxisLabel: 'Defect Count',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
