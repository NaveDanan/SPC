import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import FileUploadPanel from '../upload/FileUploadPanel';
import DataPreview from '../upload/DataPreview';
import ChartPanel from '../charts/ChartPanel';
import ControlPanel from '../analysis/ControlPanel';
import RuleViolationsPanel from '../analysis/RuleViolationsPanel';

const Dashboard: React.FC = () => {
  const { isDataLoaded, processedData, errorMessage } = useAppContext();
  const [activeTab, setActiveTab] = useState<'data' | 'chart' | 'analysis'>('data');

  
  return (
    <div className="container mx-auto px-4 py-6">
      {!isDataLoaded && !processedData && (
        <div className="mb-8 bg-white rounded-lg shadow-md p-6 flex flex-col md:flex-row items-center gap-6">

          <div className="text-center md:text-left">
            
            
            <div className="flex items-center mb-2">
              <h2 className="text-xl font-semibold text-teal-600 mr-2">Welcome to</h2>
              <img
              src={`${import.meta.env.BASE_URL}images/slogen.png`}
              alt="SPC Slogan"
              className="h-10 w-auto mx-auto md:mx-0"
              loading="lazy"
              decoding="async"
            />
            </div>
            
            <p className="text-gray-600 mb-2">Upload your process data (CSV / XLSX) to generate control charts and detect rule violations.</p>
            
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Error</p>
          <p>{errorMessage}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  className={`px-4 py-3 font-medium text-sm ${activeTab === 'data' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-600 hover:text-gray-800'}`}
                  onClick={() => setActiveTab('data')}
                >
                  Data Input
                </button>
                <button
                  className={`px-4 py-3 font-medium text-sm ${activeTab === 'chart' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-600 hover:text-gray-800'}`}
                  onClick={() => setActiveTab('chart')}
                >
                  Chart Controls
                </button>
                <button
                  className={`px-4 py-3 font-medium text-sm ${activeTab === 'analysis' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-600 hover:text-gray-800'}`}
                  onClick={() => setActiveTab('analysis')}
                >
                  Analysis
                </button>
              </nav>
            </div>
            
            <div className="p-4">
              {activeTab === 'data' && <FileUploadPanel />}
              {activeTab === 'chart' && <ControlPanel />}
              {activeTab === 'analysis' && <RuleViolationsPanel />}
            </div>
          </div>
        </div>
        
        {/* Right panel */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-6">
            {/* Data preview */}
            {isDataLoaded && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h2 className="text-lg font-medium text-gray-800 mb-3">Data Preview</h2>
                <DataPreview />
              </div>
            )}
            
            {/* Chart area */}
            {processedData && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <ChartPanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;