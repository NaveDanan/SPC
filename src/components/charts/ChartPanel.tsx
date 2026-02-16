import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import IndividualChart from './ChartTypes/IndividualChart';
import PChart from './ChartTypes/PChart';
import NPChart from './ChartTypes/NPChart';
import XBarSChart from './ChartTypes/XBarSChart';
import XBarRChart from './ChartTypes/XBarRChart';
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
  const { t } = useLanguage();

  const formatStat = (value: number, decimals = 3): string => {
    return Number.isFinite(value) ? value.toFixed(decimals) : '—';
  };
  
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-2"></div>
        <p>{t('chartPanel.processing')}</p>
      </div>
    );
  }
  
  if (!processedData || selectedColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>{t('chartPanel.selectData')}</p>
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
      case 'xBarR':
        return <XBarRChart />;
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
  const centerLine = processedData.controlLimits.centerLine;
  const ucl = processedData.controlLimits.ucl;
  const lcl = processedData.controlLimits.lcl;
  const sigma = processedData.controlLimits.sigma;

  const cplValue = Number.isFinite(sigma) && sigma > 0
    ? (centerLine - lcl) / (3 * sigma)
    : Number.NaN;
  const cpuValue = Number.isFinite(sigma) && sigma > 0
    ? (ucl - centerLine) / (3 * sigma)
    : Number.NaN;
  const cpkValue = Number.isFinite(cplValue) && Number.isFinite(cpuValue)
    ? Math.min(cplValue, cpuValue)
    : Number.NaN;

  const cpl = formatStat(cplValue, 4);
  const cpu = formatStat(cpuValue, 4);
  const cpk = formatStat(cpkValue, 4);
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
            <p className="text-xs text-blue-700 font-medium">{t('chartPanel.mean')}</p>
            <p className="text-lg font-semibold">{formatStat(centerLine)}</p>
          </div>
          <div className="bg-red-50 rounded-md p-3">
            <p className="text-xs text-red-700 font-medium">{t('chartPanel.ucl')}</p>
            <p className="text-lg font-semibold">{formatStat(ucl)}</p>
          </div>
          <div className="bg-red-50 rounded-md p-3">
            <p className="text-xs text-red-700 font-medium">{t('chartPanel.lcl')}</p>
            <p className="text-lg font-semibold">{formatStat(lcl)}</p>
          </div>
          <div className="bg-purple-50 rounded-md p-3">
            <p className="text-xs text-purple-700 font-medium">{t('chartPanel.stdDev')}</p>
            <p className="text-lg font-semibold">{formatStat(sigma)}</p>
          </div>
            <div className="bg-amber-50 rounded-md p-3">
            <p className="text-xs text-amber-700 font-medium">{t('chartPanel.cpl')}</p>
            <p className="text-lg font-semibold">{cpl}</p>
          </div>
          <div className="bg-stone-100 rounded-md p-3">
            <p className="text-xs text-stone-700 font-medium">{t('chartPanel.cpu')}</p>
            <p className="text-lg font-semibold">{cpu}</p>
          </div>
            <div className="bg-emerald-50 rounded-md p-3">
            <p className="text-xs text-slate-700 font-medium">{t('chartPanel.cpk')}</p>
            <p className="text-lg font-semibold">{cpk}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartPanel;
