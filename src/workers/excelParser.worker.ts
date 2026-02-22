import * as XLSX from 'xlsx';
import { Sheet } from '../types/DataTypes';

type RequestPayload = {
  fileName: string;
  data: ArrayBuffer;
  maxRowsPerSheet: number;
};

const MAX_TOTAL_PARSED_ROWS = 200_000;

type SuccessResponse = {
  type: 'done';
  ok: true;
  payload: {
    sheets: Sheet[];
    fileType: string;
    parseWarning?: string;
  };
};

type ErrorResponse = {
  type: 'error';
  ok: false;
  error: string;
};

type ProgressResponse = {
  type: 'progress';
  message: string;
};

const getFileType = (fileName: string): string => {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.xlsm')) return 'xlsm';
  if (normalized.endsWith('.xlsx')) return 'xlsx';
  if (normalized.endsWith('.xls')) return 'xls';
  return 'excel';
};

const normalizeHeader = (value: unknown, index: number): string => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `Column ${index + 1}`;
  }
  return String(value);
};

self.onmessage = (event: MessageEvent<RequestPayload>) => {
  try {
    const { fileName, data, maxRowsPerSheet } = event.data;

    const openingProgress: ProgressResponse = {
      type: 'progress',
      message: 'Opening workbook...',
    };
    self.postMessage(openingProgress);

    const workbook = XLSX.read(data, {
      type: 'array',
      dense: true,
      raw: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellText: false,
      sheetRows: Math.max(2, maxRowsPerSheet + 1),
    });

    const totalSheets = workbook.SheetNames.length;
    let remainingRowsBudget = MAX_TOTAL_PARSED_ROWS;
    let parsedRows = 0;
    let wasTruncated = false;

    const sheets: Sheet[] = workbook.SheetNames.map((sheetName, index) => {
      const progress: ProgressResponse = {
        type: 'progress',
        message: `Parsing sheet ${index + 1}/${totalSheets}: ${sheetName}`,
      };
      self.postMessage(progress);

      const worksheet = workbook.Sheets[sheetName];

      if (remainingRowsBudget <= 0) {
        const headerOnly = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
          header: 1,
          raw: true,
          defval: null,
          blankrows: false,
          range: 0,
        });
        const headers = (headerOnly[0] || []).map((header, headerIndex) => normalizeHeader(header, headerIndex));
        wasTruncated = true;
        return { name: sheetName, headers, data: [] };
      }

      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      });

      if (!matrix.length) {
        return { name: sheetName, headers: [], data: [] };
      }

      const firstRow = matrix[0] || [];
      const headers = firstRow.map((header, index) => normalizeHeader(header, index));
      const rowsLimit = Math.min(maxRowsPerSheet, remainingRowsBudget);
      const rows = matrix.slice(1, rowsLimit + 1);
      const availableRows = Math.max(0, matrix.length - 1);
      if (availableRows > rowsLimit) {
        wasTruncated = true;
      }
      remainingRowsBudget -= rows.length;
      parsedRows += rows.length;

      const rowData = rows.map((row) => {
        const record: Record<string, string | number | boolean | null> = {};
        headers.forEach((header, index) => {
          record[header] = row[index] ?? null;
        });
        return record;
      });

      return {
        name: sheetName,
        headers,
        data: rowData,
      };
    });

    const response: SuccessResponse = {
      type: 'done',
      ok: true,
      payload: {
        sheets,
        fileType: getFileType(fileName),
        parseWarning: wasTruncated
          ? `Large workbook detected. Parsed ${parsedRows.toLocaleString()} rows for responsiveness.`
          : undefined,
      },
    };

    self.postMessage(response);
  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to parse Excel workbook.',
    };
    self.postMessage(response);
  }
};
