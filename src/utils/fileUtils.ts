import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataSet } from '../types/DataTypes';

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
        
        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Extract headers (first row)
        const headers = jsonData[0] as string[];
        
        // Convert data format (skip the header row)
        const rowData = jsonData.slice(1).map((row: any[]) => {
          const dataRow: Record<string, any> = {};
          headers.forEach((header, index) => {
            dataRow[header] = row[index];
          });
          return dataRow;
        });
        
        resolve({
          data: rowData,
          headers,
          fileName: file.name,
          fileType: file.name.endsWith('.xlsx') ? 'xlsx' : 'xls'
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