import { describe, expect, it } from 'vitest';
import {
  extractAgentRecommendationFromMessage,
  validateAgentRecommendationAgainstHeaders,
} from './agentMode';

describe('agentMode utilities', () => {
  it('extracts multi-column recommendation and clamps sample size', () => {
    const message = `- Recommendation\n\n\`\`\`json
{"recommendation":{"chartType":"xBarR","yColumns":["A","B"],"xAxisColumn":"Date","sampleSize":40,"chartLabel":"XBar R Monitoring","zAxisLabel":"Date","yAxisLabel":"Measurement","reason":"Subgroups available"}}
\`\`\``;

    const recommendation = extractAgentRecommendationFromMessage(message);

    expect(recommendation).not.toBeNull();
    expect(recommendation?.chartType).toBe('xBarR');
    expect(recommendation?.yColumns).toEqual(['A', 'B']);
    expect(recommendation?.xAxisColumn).toBe('Date');
    expect(recommendation?.sampleSize).toBe(25);
    expect(recommendation?.chartLabel).toBe('XBar R Monitoring');
    expect(recommendation?.zAxisLabel).toBe('Date');
    expect(recommendation?.yAxisLabel).toBe('Measurement');
  });

  it('supports legacy single yColumn shape', () => {
    const message = `\`\`\`json
{"recommendation":{"chartType":"individual","yColumn":"Measurement","reason":"Single metric"}}
\`\`\``;

    const recommendation = extractAgentRecommendationFromMessage(message);

    expect(recommendation?.yColumns).toEqual(['Measurement']);
  });

  it('validates columns against headers and preserves explicit null xAxis', () => {
    const validated = validateAgentRecommendationAgainstHeaders(
      {
        chartType: 'xBarS',
        yColumns: ['A', 'Missing', 'B'],
        xAxisColumn: null,
        sampleSize: 5,
        reason: 'test',
      },
      ['A', 'B', 'Date'],
    );

    expect(validated.yColumns).toEqual(['A', 'B']);
    expect(validated.xAxisColumn).toBeNull();
    expect(validated.sampleSize).toBe(5);
  });

  it('supports xAxisLabel alias for zAxisLabel in recommendation payload', () => {
    const message = `\`\`\`json
{"recommendation":{"chartType":"individual","yColumns":["A"],"xAxisColumn":"Date","sampleSize":5,"xAxisLabel":"Batch Date","yAxisLabel":"Value","chartLabel":"I Chart","reason":"test"}}
\`\`\``;

    const recommendation = extractAgentRecommendationFromMessage(message);

    expect(recommendation?.zAxisLabel).toBe('Batch Date');
    expect(recommendation?.yAxisLabel).toBe('Value');
    expect(recommendation?.chartLabel).toBe('I Chart');
  });
});
