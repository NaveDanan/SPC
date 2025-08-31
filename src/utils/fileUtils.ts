import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataSet, Sheet } from '../types/DataTypes';

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
export const parseExcel = (file: File): Promise<DataSet> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }
        
        // Parse workbook from the file data
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Build sheets array
        const sheets: Sheet[] = workbook.SheetNames.map(sheetName => {
          const ws = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (!jsonData.length) {
            return { name: sheetName, headers: [], data: [] };
          }
            const headers = (jsonData[0] as string[]).map(h => (h === undefined || h === null ? '' : String(h)));
          const rows = jsonData.slice(1) as any[][];
          const rowData = rows.map((row) => {
            const dataRow: Record<string, any> = {};
            headers.forEach((header, index) => {
              dataRow[header] = row[index];
            });
            return dataRow;
          });
          return { name: sheetName, headers, data: rowData };
        });

        const first = sheets[0] || { name: 'Sheet1', headers: [], data: [] };

        resolve({
          data: first.data,
          headers: first.headers,
          fileName: file.name,
          fileType: file.name.endsWith('.xlsx') ? 'xlsx' : 'xls',
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
export const parseFile = async (file: File): Promise<DataSet> => {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSV(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcel(file);
  } else {
    throw new Error('Unsupported file format. Please upload a CSV, XLS, or XLSX file.');
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