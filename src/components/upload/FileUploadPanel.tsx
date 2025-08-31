import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Check } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { parseFile } from '../../utils/fileUtils';

const FileUploadPanel: React.FC = () => {
  const { setRawData, setErrorMessage, resetData, rawData, selectedColumns, setSelectedColumns, xAxisColumn, setXAxisColumn, sampleSize, setSampleSize } = useAppContext();
  const [isUploading, setIsUploading] = useState(false);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      const parsedData = await parseFile(file);
      setRawData(parsedData);
      // Auto-select the first column as Y if none selected
      if (selectedColumns.length === 0 && parsedData.headers.length > 0) {
        setSelectedColumns([parsedData.headers[0]]);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      setErrorMessage((error as Error).message || 'Failed to parse the file');
      resetData();
    } finally {
      setIsUploading(false);
    }
  }, [setRawData, setErrorMessage, resetData, selectedColumns, setSelectedColumns]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800">Data Input</h3>
      
      {/* File upload zone */}
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="flex flex-col items-center text-gray-500">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-2"></div>
            <p>Uploading and parsing file...</p>
          </div>
        ) : rawData ? (
          <div className="flex items-center justify-center text-green-600">
            <Check size={24} className="mr-2" />
            <div className="text-left">
              <p className="font-medium">{rawData.fileName}</p>
              <p className="text-sm text-gray-500">
                {rawData.data.length} rows, {rawData.headers.length} columns
              </p>
            </div>
            <button 
              className="ml-4 text-gray-400 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                resetData();
              }}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-500">
            <Upload size={36} className="mb-2 text-gray-400" />
            <p className="font-medium">Drag & drop a file here, or click to select</p>
            <p className="text-sm mt-1">Supports CSV, XLS, XLSX</p>
          </div>
        )}
      </div>
      
      {/* Data configuration */}
      {rawData && rawData.headers.length > 0 && (
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="data-column" className="block text-sm font-medium text-gray-700 mb-1">
              Select Y-Value Column (used for SPC)
            </label>
            <select
              id="data-column"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={selectedColumns[0] || ''}
              onChange={(e) => {
                setSelectedColumns([e.target.value, ...selectedColumns.slice(1).filter(() => false)]);
              }}
            >
              {rawData.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="x-axis-column" className="block text-sm font-medium text-gray-700 mb-1">
              Select X-Axis Column (optional)
            </label>
            <select
              id="x-axis-column"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={xAxisColumn || ''}
              onChange={(e) => {
                const x = e.target.value;
                setXAxisColumn(x || null);
              }}
            >
              <option value="">— Use row index —</option>
              {rawData.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">If set, charts use this column for X values (e.g., Date).</p>
          </div>
          
          <div>
            <label htmlFor="sample-size" className="block text-sm font-medium text-gray-700 mb-1">
              Sample Size (for X-bar charts)
            </label>
            <input
              id="sample-size"
              type="number"
              min={2}
              max={25}
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={sampleSize}
              onChange={(e) => setSampleSize(Math.max(2, Math.min(25, parseInt(e.target.value) || 5)))}
            />
            <p className="text-xs text-gray-500 mt-1">
              For X-bar charts (S or R), data will be grouped into subgroups of this size
            </p>
          </div>
        </div>
      )}
      
      {/* Example data link */}
      <div className="mt-2 text-sm text-gray-500">
        <p>
          <button 
            className="text-blue-500 hover:text-blue-700 inline-flex items-center"
            onClick={() => {
              // Generate sample data
              const headers = ['Sample', 'Measurement'];
              const data = Array.from({ length: 30 }, (_, i) => ({
                Sample: i + 1,
                Measurement: 10 + Math.random() * 5
              }));
              
              setRawData({
                data,
                headers,
                fileName: 'example_data.csv',
                fileType: 'csv'
              });
              
              setSelectedColumns(['Measurement']);
            }}
          >
            <FileText size={14} className="mr-1" />
            Don't have data? Use example dataset
          </button>
        </p>
      </div>
    </div>
  );
};

export default FileUploadPanel;
