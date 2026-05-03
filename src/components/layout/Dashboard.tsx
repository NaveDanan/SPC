import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import FileUploadPanel from '../upload/FileUploadPanel';
import DataPreview from '../upload/DataPreview';
import ChartPanel from '../charts/ChartPanel';
import ControlPanel from '../analysis/ControlPanel';
import RuleViolationsPanel from '../analysis/RuleViolationsPanel';

const Dashboard: React.FC = () => {
  const { isDataLoaded, processedData, errorMessage } = useAppContext();
  const { t } = useLanguage();

  
  return (
    <div className="w-full px-4 xl:px-6 py-6">
      {!isDataLoaded && !processedData && (
        <div className="mb-8 bg-white rounded-lg shadow-md p-6 flex flex-col md:flex-row items-center gap-6">

          <div className="text-center md:text-left">
            
            
            <div className="flex items-center mb-2">
              <h2 className="text-xl font-semibold text-teal-600 mr-2">Welcome to</h2>
              <img
              src="/images/slogen.png"
              alt="SPC Slogan"
              className="h-10 w-auto mx-auto md:mx-0"
              loading="lazy"
              decoding="async"
            />
            </div>
            
            <p className="text-gray-600 mb-2">Upload your process data (CSV / XLSX / XLSM) to generate control charts and detect rule violations.</p>
            
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Error</p>
          <p>{errorMessage}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <FileUploadPanel />
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <ControlPanel />
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          {isDataLoaded && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-medium text-gray-800 mb-3">{t('dataPreview.title')}</h2>
              <DataPreview />
            </div>
          )}
          <div className="bg-white rounded-lg shadow-md p-4">
            <RuleViolationsPanel />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mt-6">

        {processedData && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <ChartPanel />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
