import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataSet, Sheet } from '../types/DataTypes';

const MAX_EXCEL_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_PARSED_ROWS_PER_SHEET = 100_000;

type ParseProgress = {
  message: string;
};

type ParseFileOptions = {
  onProgress?: (progress: ParseProgress) => void;
};

type ExcelWorkerProgressPayload = {
  type: 'progress';
  message: string;
};

type ExcelWorkerSuccessPayload = {
  type: 'done';
  ok: true;
  payload: {
    sheets: Sheet[];
    fileType: string;
    parseWarning?: string;
  };
};

type ExcelWorkerErrorPayload = {
  type: 'error';
  ok: false;
  error: string;
};

type ExcelWorkerResponse = ExcelWorkerSuccessPayload | ExcelWorkerErrorPayload | ExcelWorkerProgressPayload;
type ExcelWorkerFinalResponse = ExcelWorkerSuccessPayload | ExcelWorkerErrorPayload;

// Parse CSV file
export const parseCSV = (file: File): Promise<DataSet> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Convert data to the desired format
        const headers = results.meta.fields || [];
        resolve({
          data: results.data as any[],
          headers,
          fileName: file.name,
          fileType: 'csv'
        });
      },
      error: (error) => {
        reject(new Error(`Error parsing CSV: ${error}`));
      }
    });
  });
};

// Parse Excel file (XLS, XLSX)
export const parseExcel = (file: File, options?: ParseFileOptions): Promise<DataSet> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_EXCEL_FILE_SIZE_BYTES) {
      reject(new Error('Excel file is too large. Maximum supported size is 70MB.'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        options?.onProgress?.({ message: 'Opening workbook...' });
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        const buffer = data as ArrayBuffer;
        const worker = new Worker(new URL('../workers/excelParser.worker.ts', import.meta.url), { type: 'module' });

        const workerResult = await new Promise<ExcelWorkerFinalResponse>((workerResolve, workerReject) => {
          worker.onmessage = (event: MessageEvent<ExcelWorkerResponse>) => {
            if (event.data.type === 'progress') {
              options?.onProgress?.({ message: event.data.message });
              return;
            }
            workerResolve(event.data);
          };
          worker.onerror = () => {
            workerReject(new Error('Excel parser worker failed.'));
          };
          worker.postMessage({
            fileName: file.name,
            data: buffer,
            maxRowsPerSheet: MAX_PARSED_ROWS_PER_SHEET,
          }, [buffer]);
        }).finally(() => {
          worker.terminate();
        });

        if (!workerResult.ok) {
          reject(new Error(workerResult.error));
          return;
        }

        const sheets = workerResult.payload.sheets;
        const first = sheets[0] || { name: 'Sheet1', headers: [], data: [] };

        resolve({
          data: first.data,
          headers: first.headers,
          fileName: file.name,
          fileType: workerResult.payload.fileType,
          parseWarning: workerResult.payload.parseWarning,
          sheets,
          activeSheetIndex: 0,
        });
      } catch (error) {
        reject(new Error(`Error parsing Excel file: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    // Read the file as an array buffer
    reader.readAsArrayBuffer(file);
  });
};

// Parse file based on its type
export const parseFile = async (file: File, options?: ParseFileOptions): Promise<DataSet> => {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSV(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xlsm')) {
    return parseExcel(file, options);
  } else {
    throw new Error('Unsupported file format. Please upload a CSV, XLS, XLSX, or XLSM file.');
  }
};

// Export data as CSV
export const exportAsCSV = (data: any[], fileName: string = 'export.csv'): void => {
  const csv = Papa.unparse(data);
  downloadFile(csv, fileName, 'text/csv');
};

// Export data as Excel
export const exportAsExcel = (data: any[], fileName: string = 'export.xlsx'): void => {
  // Create a worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Create a workbook with the worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // Generate Excel file
  XLSX.writeFile(wb, fileName);
};

// Download file helper
export const downloadFile = (content: string, fileName: string, contentType: string): void => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  
  // Clean up
  URL.revokeObjectURL(url);
};