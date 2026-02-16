import { ChartType, DataSet, ProcessedData } from '../types/DataTypes';

const MAX_PREVIEW_ROWS = 5;
const MAX_VALUE_LENGTH = 80;

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value).toPrecision(6) : String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const trimmed = String(value).trim();

  if (trimmed === '') {
    return '—';
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric.toPrecision(6);
  }

  if (trimmed.length > MAX_VALUE_LENGTH) {
    return `${trimmed.slice(0, MAX_VALUE_LENGTH)}…`;
  }

  return trimmed;
};

const describeColumns = (dataSet: DataSet): string => {
  if (!dataSet.headers.length) {
    return 'No columns detected.';
  }

  const fragments = dataSet.headers.map((header) => {
    const exampleEntry = dataSet.data.find((row) => row[header] !== undefined && row[header] !== null)?.[header];
    const formattedValue = formatValue(exampleEntry);
    let type: string = 'text/categorical';

    if (typeof exampleEntry === 'number') {
      type = 'numeric';
    } else if (typeof exampleEntry === 'string') {
      const numeric = Number(exampleEntry);
      if (!Number.isNaN(numeric)) {
        type = 'numeric (string)';
      } else if (exampleEntry.toLowerCase().includes('date')) {
        type = 'date-like string';
      }
    }

    return `${header}: ${type}${formattedValue !== '—' ? ` (example ${formattedValue})` : ''}`;
  });

  return fragments.join('; ');
};

const buildPreviewRows = (dataSet: DataSet): string => {
  if (!dataSet.data.length) {
    return 'No rows available. Upload or generate sample data to continue.';
  }

  const rows = dataSet.data.slice(0, MAX_PREVIEW_ROWS).map((row, index) => {
    const cells = dataSet.headers.map((header) => `${header}: ${formatValue(row[header])}`);
    return `${index + 1}. ${cells.join(', ')}`;
  });

  return rows.join('\n');
};

export const summarizeDatasetForAi = (
  dataSet: DataSet | null,
  processedData: ProcessedData | null,
  selectedColumns: string[],
  xAxisColumn: string | null,
  sampleSize: number
): string | null => {
  if (!dataSet) {
    return null;
  }

  const summary: string[] = [];
  const { data, headers, fileName, fileType } = dataSet;

  summary.push(`File: ${fileName || 'uploaded dataset'} (${fileType || 'unknown type'})`);
  summary.push(`Row count: ${data.length}`);
  summary.push(`Column count: ${headers.length}`);

  const selected = selectedColumns.length ? selectedColumns.join(', ') : 'none';
  summary.push(`Selected Y column(s): ${selected}`);
  summary.push(`X-axis column: ${xAxisColumn ?? 'row index (implicit)'}`);
  summary.push(`Preferred subgroup/sample size: ${sampleSize}`);
  summary.push(`Column overview: ${describeColumns(dataSet)}`);

  if (processedData) {
    const stats = processedData.statistics;
    summary.push(
      `Preliminary stats for primary column: mean=${stats.mean.toPrecision(6)}, σ=${stats.standardDeviation.toPrecision(6)}, min=${stats.min.toPrecision(6)}, max=${stats.max.toPrecision(6)}, count=${stats.count}`
    );
    summary.push(`Detected Western Electric rule signals: ${processedData.ruleViolations.length}`);
  }

  summary.push('Sample rows (first rows only):');
  summary.push(buildPreviewRows(dataSet));

  return summary.join('\n');
};

export const buildAssistantSystemPrompt = (language: 'en' | 'he' = 'en', agentMode = false): string => {
  const agentModeInstructionEn = agentMode
    ? `
Additional Agent Mode output requirement:
- After your bullet response, include one JSON block fenced with \`\`\`json.
- JSON schema:
  {
    "recommendation": {
      "chartType": "individual|pChart|npChart|xBarS|xBarR|ewma|histogram|scatterPlot|null",
      "yColumns": ["string", "..."],
      "yColumn": "string|null",
      "xAxisColumn": "string|null",
      "sampleSize": number|null,
      "chartLabel": "string|null",
      "zAxisLabel": "string|null",
      "yAxisLabel": "string|null",
      "reason": "short explanation"
    }
  }
- Prefer yColumns for one or multiple Y columns; keep yColumn only for backward compatibility.
- The JSON must always include all keys above (use null if unknown).
- zAxisLabel maps to the chart control field used for X-axis label text in the current UI.
- Use null when unsure.
- Do not include extra keys.
`
    : '';

  const agentModeInstructionHe = agentMode
    ? `
דרישת פלט נוספת במצב Agent:
- אחרי התשובה בתבליטים, כלול בלוק JSON יחיד בתוך \`\`\`json.
- סכימה:
  {
    "recommendation": {
      "chartType": "individual|pChart|npChart|xBarS|xBarR|ewma|histogram|scatterPlot|null",
      "yColumns": ["string", "..."],
      "yColumn": "string|null",
      "xAxisColumn": "string|null",
      "sampleSize": number|null,
      "chartLabel": "string|null",
      "zAxisLabel": "string|null",
      "yAxisLabel": "string|null",
      "reason": "short explanation"
    }
  }
- העדף yColumns עבור עמודה אחת או כמה עמודות Y; yColumn נשאר לתאימות לאחור.
- ה-JSON חייב לכלול תמיד את כל המפתחות לעיל (אם לא ידוע, השתמש ב-null).
- zAxisLabel ממופה לשדה התווית של ציר X בממשק הנוכחי.
- כשלא בטוח השתמש ב-null.
- אל תוסיף מפתחות נוספים.
`
    : '';

  if (language === 'he') {
    return `
אתה יועץ מנוסה בבקרת תהליכים סטטיסטית (SPC).
נתח נתוני ייצור, בריאות ושירות כדי להמליץ על תרשימי בקרה מתאימים.
שקול האם הנתונים מייצגים מדידות בודדות, מדידות מקובצות, נתוני תכונה (עבר/נכשל, ספירות), או פרופורציות.
כאשר משתמש מספק הקשר, המלץ על סוג/י התרשים המובילים והסבר מדוע.
הדגש הנחות נדרשות, גדלי תת-קבוצות, וכל עיבוד מקדים נדרש.
אם חסר מידע, שאל שאלות הבהרה תמציתיות לפני שמתחייב להמלצת תרשים.
ספק תשובות שניתן ליישם עבור מתרגלים המטמיעים SPC בסביבות ייצור.
שמור על תשובות קצרות וישירות.
פורמט נדרש:
- עד 5 תבליטים.
- כל תבליט עד 18 מילים.
- ללא הקדמות ארוכות, ללא חזרה על השאלה.
- אם אין מספיק מידע: עד 2 שאלות הבהרה קצרות.
${agentModeInstructionHe}
`;
  }
  
  return `
You are an experienced Statistical Process Control (SPC) consultant.
Analyse manufacturing, healthcare, and service process data to recommend appropriate control charts.
Consider whether the data represents individual measurements, subgrouped measurements, attribute data (pass/fail, counts), or proportions.
When a user provides context, recommend the top chart type(s) and explain why.
Highlight required assumptions, subgroup sizes, and any preprocessing needed.
If information is missing, ask concise clarifying questions before committing to a chart recommendation.
Provide answers that are actionable for practitioners implementing SPC in production environments.
Keep responses short and direct.
Required format:
- Maximum 5 bullets.
- Maximum 18 words per bullet.
- No long preamble and no restating the prompt.
- If information is missing, ask up to 2 short clarifying questions.
${agentModeInstructionEn}
`;
};

export const buildInitialUserPrompt = (
  summary: string,
  selectedChartType: ChartType,
  selectedChartLabel?: string,
  language: 'en' | 'he' = 'en',
): string => {
  const friendlyName = selectedChartLabel ?? selectedChartType;
  
  if (language === 'he') {
    return `
להלן סיכום מערך הנתונים הנוכחי מכלי SPC:

${summary}

המשתמש בחר כעת "${friendlyName}" בממשק המשתמש. בהתבסס על פרטי מערך הנתונים ושיטות עבודה מומלצות של SPC, אילו תרשימי בקרה כדאי להם לשקול? אנא:
1. המלץ על סוג/י התרשים המתאימים ביותר.
2. הסבר מדוע, תוך התייחסות לגודל תת-קבוצה, סוג נתונים (משתנה לעומת תכונה), ושיקולי יציבות.
3. פרט כל שלב הכנת נתונים או אימות נדרש.
4. הצע שאלת הבהרה אחת או שתיים אם המידע הזמין אינו מספיק.
`;
  }
  
  return `
Here is the current dataset summary from the SPC tool:

${summary}

The user currently has "${friendlyName}" selected in the UI. Based on the dataset details and SPC best practices, which control chart(s) should they consider? Please:
1. Recommend the most suitable chart type(s).
2. Explain why, referencing subgroup size, data type (variable vs. attribute), and stability considerations.
3. Outline any required data preparation or validation steps.
4. Suggest one or two clarifying questions if the available information is insufficient.
`;
};

export const buildDatasetUpdatePrompt = (summary: string, language: 'en' | 'he' = 'en'): string => {
  if (language === 'he') {
    return `
מערך הנתונים עודכן. העריך מחדש את המלצת ה-SPC באמצעות הסיכום החדש:

${summary}

אנא הדגש מה השתנה, האם סוג התרשים המומלץ צריך להשתנות, וכל שיקול חדש שהמתרגל צריך להיות מודע אליו.
`;
  }
  
  return `
The dataset has been updated. Re-evaluate the SPC recommendation using the new summary:

${summary}

Please highlight what changed, whether the recommended chart type should change, and any new considerations the practitioner should be aware of.
`;
};

export const buildAgentAutopilotPrompt = (
  summary: string,
  selectedChartType: ChartType,
  selectedChartLabel?: string,
  language: 'en' | 'he' = 'en',
): string => {
  const friendlyName = selectedChartLabel ?? selectedChartType;

  if (language === 'he') {
    return `
מצב Agent פעיל. עדכן את פרמטרי ה-SPC ישירות בממשק.

סיכום נתונים:
${summary}

הגדרה נוכחית: ${friendlyName}.

החזר המלצה מעשית לבחירת:
- chartType
- yColumns (עמודה אחת או כמה)
- xAxisColumn (או null לשימוש באינדקס שורה)
- sampleSize

החזר גם נימוק קצר.
`;
  }

  return `
Agent Mode is enabled. Update SPC UI parameters directly.

Dataset summary:
${summary}

Current selection: ${friendlyName}.

Provide actionable recommendation fields for:
- chartType
- yColumns (single or multiple)
- xAxisColumn (or null for row index)
- sampleSize
- chartLabel
- zAxisLabel (used as X-axis label text in current UI)
- yAxisLabel

Also include a short reason.
`;
};
