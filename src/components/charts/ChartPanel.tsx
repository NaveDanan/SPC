import React from 'react';
import { useAppContext } from '../../context/AppContext';
import IndividualChart from './ChartTypes/IndividualChart';
import PChart from './ChartTypes/PChart';
import NPChart from './ChartTypes/NPChart';
import XBarSChart from './ChartTypes/XBarSChart';
import EWMAChart from './ChartTypes/EWMAChart';
import Histogram from './ChartTypes/Histogram';
import ScatterPlot from './ChartTypes/ScatterPlot';
import ChartActions from './ChartActions';

const ChartPanel: React.FC = () => {
  const { 
    selectedChartType, 
    processedData, 
    chartOptions, 
    isProcessing,
    selectedColumns 
  } = useAppContext();
  
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-2"></div>
        <p>Processing data...</p>
      </div>
    );
  }
  
  if (!processedData || selectedColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>Select data and chart type to generate a chart</p>
      </div>
    );
  }
  
  const renderChart = () => {
    switch (selectedChartType) {
      case 'individual':
        return <IndividualChart />;
      case 'pChart':
        return <PChart />;
      case 'npChart':
        return <NPChart />;
      case 'xBarS':
        return <XBarSChart />;
      case 'ewma':
        return <EWMAChart />;
      case 'histogram':
        return <Histogram />;
      case 'scatterPlot':
        return <ScatterPlot />;
      default:
        return <IndividualChart />;
    }
  };
  const cpl = ((processedData.controlLimits.centerLine.toFixed(3) - processedData.controlLimits.lcl.toFixed(3)) / (3 * processedData.controlLimits.sigma.toFixed(3)).toFixed(3)).toFixed(4)
  const cpu = ((processedData.controlLimits.ucl.toFixed(3) - processedData.controlLimits.centerLine.toFixed(3)) / (3 * processedData.controlLimits.sigma.toFixed(3)).toFixed(3)).toFixed(4)
  const cpk = Math.min(cpl, cpu)
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-800">
          {chartOptions.title || 'SPC Chart'}
        </h2>
        <ChartActions />
      </div>
      
      <div className="rounded-lg border border-gray-100 p-4">
        {renderChart()}
      </div>
      
      {processedData && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-md p-3">
            <p className="text-xs text-blue-700 font-medium">Mean (CL)</p>
            <p className="text-lg font-semibold">{processedData.controlLimits.centerLine.toFixed(3)}</p>
          </div>
          <div className="bg-red-50 rounded-md p-3">
            <p className="text-xs text-red-700 font-medium">Upper Control Limit</p>
            <p className="text-lg font-semibold">{processedData.controlLimits.ucl.toFixed(3)}</p>
          </div>
          <div className="bg-red-50 rounded-md p-3">
            <p className="text-xs text-red-700 font-medium">Lower Control Limit</p>
            <p className="text-lg font-semibold">{processedData.controlLimits.lcl.toFixed(3)}</p>
          </div>
          <div className="bg-purple-50 rounded-md p-3">
            <p className="text-xs text-purple-700 font-medium">Standard Deviation</p>
            <p className="text-lg font-semibold">{processedData.controlLimits.sigma.toFixed(3)}</p>
          </div>
            <div className="bg-amber-50 rounded-md p-3">
            <p className="text-xs text-amber-700 font-medium">Cpl</p>
            <p className="text-lg font-semibold">{cpl}</p>
          </div>
          <div className="bg-stone-100 rounded-md p-3">
            <p className="text-xs text-stone-700 font-medium">Cpu</p>
            <p className="text-lg font-semibold">{cpu}</p>
          </div>
            <div className="bg-emerald-50 rounded-md p-3">
            <p className="text-xs text-slate-700 font-medium">Cpk</p>
            <p className="text-lg font-semibold">{cpk}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartPanel;