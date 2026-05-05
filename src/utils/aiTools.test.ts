import { describe, expect, it } from 'vitest';
import { buildControlsSnapshot, selectControlsSnapshotSections } from './aiTools';

describe('aiTools', () => {
  it('builds a controls snapshot with current values and available options', () => {
    const snapshot = buildControlsSnapshot({
      rawData: {
        data: [{ A: 1, B: 2 }],
        headers: ['A', 'B'],
        fileName: 'sample.xlsx',
        fileType: 'xlsx',
        sheets: [
          { name: 'Sheet1', data: [{ A: 1, B: 2 }], headers: ['A', 'B'] },
        ],
        activeSheetIndex: 0,
      },
      selectedChartType: 'xBarR',
      chartOptions: {
        title: 'X-bar R',
        xAxisLabel: 'Date',
        yAxisLabel: 'Value',
        showControlLimits: true,
        showCenterLine: true,
        showRuleViolations: true,
        colorScheme: 'default',
        showSigma1: true,
        showSigma2: false,
        showSigma3: true,
      },
      selectedColumns: ['A', 'B'],
      xAxisColumn: null,
      denominatorColumn: 'B',
      sampleSize: 3,
      language: 'en',
      agentModeEnabled: true,
      selectedAiSheetIndex: 0,
    });

    expect(snapshot.current.chartType).toBe('xBarR');
    expect(snapshot.current.yColumns).toEqual(['A', 'B']);
    expect(snapshot.current.denominatorColumn).toBe('B');
    expect(snapshot.current.effectiveSampleSize).toBe(2);
    expect(snapshot.available.headers).toEqual(['A', 'B']);
    expect(snapshot.available.sampleSize.lockedToYColumns).toBe(true);
    expect(snapshot.assistant.tools).toEqual(['list-tools', 'read_controls', 'read_spc_diagnostics', 'update_controls']);
  });

  it('returns only the requested snapshot sections', () => {
    const snapshot = buildControlsSnapshot({
      rawData: null,
      selectedChartType: 'individual',
      chartOptions: {
        title: 'Chart',
        xAxisLabel: 'X',
        yAxisLabel: 'Y',
        showControlLimits: true,
        showCenterLine: true,
        showRuleViolations: true,
        colorScheme: 'default',
      },
      selectedColumns: [],
      xAxisColumn: null,
      sampleSize: 5,
      language: 'he',
      agentModeEnabled: true,
      selectedAiSheetIndex: null,
    });

    expect(selectControlsSnapshotSections(snapshot, ['assistant', 'current'])).toEqual({
      assistant: snapshot.assistant,
      current: snapshot.current,
    });
  });
});
