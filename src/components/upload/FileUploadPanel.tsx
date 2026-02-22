import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Check, Sparkles } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { parseFile } from '../../utils/fileUtils';
import AiAssistantPanel from '../ai/AiAssistantPanel';

const FileUploadPanel: React.FC = () => {
  const { setRawData, setErrorMessage, resetData, rawData, selectedColumns, setSelectedColumns } = useAppContext();
  const { t } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const maxUploadSizeBytes = 100 * 1024 * 1024;
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setIsUploading(true);
    setUploadStatus(t('fileUpload.uploading'));
    setErrorMessage(null);
    
    try {
      const parsedData = await parseFile(file, {
        onProgress: (progress) => {
          setUploadStatus(progress.message || t('fileUpload.uploading'));
        },
      });
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
      setUploadStatus('');
    }
  }, [setRawData, setErrorMessage, resetData, selectedColumns, setSelectedColumns, t]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      if (!rejections.length) return;
      const hasTooLargeFile = rejections.some((rejection) =>
        rejection.errors.some((error) => error.code === 'file-too-large')
      );
      if (hasTooLargeFile) {
        setErrorMessage('File is too large. Maximum supported size is 70MB.');
        return;
      }
      setErrorMessage('Unsupported file format. Please upload a CSV, XLS, XLSX, or XLSM file.');
    },
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm']
    },
    maxSize: maxUploadSizeBytes,
    multiple: false,
    disabled: isUploading,
  });
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-gray-800">{t('fileUpload.title')}</h3>
        <button
          type="button"
          className="rainbow-button text-sm"
          onClick={() => setShowAssistant(true)}
          aria-pressed={showAssistant}
          disabled={showAssistant}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>{t('fileUpload.askAI')}</span>
        </button>
      </div>

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
            <p>{uploadStatus || t('fileUpload.uploading')}</p>
          </div>
        ) : rawData ? (
          <div className="flex items-center justify-center text-green-600">
            <Check size={24} className="mr-2" />
            <div className="text-left">
              <p className="font-medium">{rawData.fileName}</p>
              <p className="text-sm text-gray-500">
                {rawData.data.length} {t('fileUpload.rows')}, {rawData.headers.length} {t('fileUpload.columns')}
              </p>
              {rawData.parseWarning && (
                <p className="text-xs text-amber-600 mt-1">{rawData.parseWarning}</p>
              )}
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
            <p className="font-medium">{t('fileUpload.dragDrop')}</p>
            <p className="text-sm mt-1">{t('fileUpload.supports')}</p>
          </div>
        )}
      </div>
      
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
            {t('fileUpload.noData')}
          </button>
        </p>
      </div>

      {showAssistant && <AiAssistantPanel onClose={() => setShowAssistant(false)} />}
    </div>
  );
};

export default FileUploadPanel;
