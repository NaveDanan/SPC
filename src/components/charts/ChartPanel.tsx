import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import IndividualChart from './ChartTypes/IndividualChart';
import PChart from './ChartTypes/PChart';
import NPChart from './ChartTypes/NPChart';
import CChart from './ChartTypes/CChart';
import UChart from './ChartTypes/UChart';
import XBarSChart from './ChartTypes/XBarSChart';
import XBarRChart from './ChartTypes/XBarRChart';
import EWMAChart from './ChartTypes/EWMAChart';
import Histogram from './ChartTypes/Histogram';
import ScatterPlot from './ChartTypes/ScatterPlot';
import ChartActions from './ChartActions';
import { calculateCapabilityIndices } from '../../utils/spcCalculations';

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
    return Number.isFinite(value) ? value.toFixed(decimals) : '-';
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
      case 'cChart':
        return <CChart />;
      case 'uChart':
        return <UChart />;
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

  const fallbackCapability = calculateCapabilityIndices(
    centerLine,
    sigma,
    {
      lowerSpecLimit: chartOptions.lowerSpecLimit,
      upperSpecLimit: chartOptions.upperSpecLimit,
    }
  );
  const capability = processedData.capabilityStatus;
  const capabilityIndices = capability?.indices;
  const cp = formatStat(capabilityIndices?.cp ?? fallbackCapability.cp, 4);
  const cpl = formatStat(capabilityIndices?.cpl ?? fallbackCapability.cpl, 4);
  const cpu = formatStat(capabilityIndices?.cpu ?? fallbackCapability.cpu, 4);
  const cpk = formatStat(capabilityIndices?.cpk ?? fallbackCapability.cpk, 4);
  const pp = formatStat(capabilityIndices?.pp ?? Number.NaN, 4);
  const ppk = formatStat(capabilityIndices?.ppk ?? Number.NaN, 4);
  const cpm = formatStat(capabilityIndices?.cpm ?? Number.NaN, 4);
  const capabilityTone = capability?.readiness === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : capability?.readiness === 'preliminary'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
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
        </div>
      )}

      {processedData && (
        <div className={`mt-4 rounded-md border p-4 ${capabilityTone}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('chartPanel.capabilityPerformance')}</p>
            <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-medium capitalize">
              {capability?.readiness ?? 'notApplicable'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ['Cp', cp],
              ['Cpl', cpl],
              ['Cpu', cpu],
              ['Cpk', cpk],
              ['Pp', pp],
              ['Ppk', ppk],
              ['Cpm', cpm],
            ].map(([label, value]) => (
              <div key={label} className="rounded bg-white/70 p-2">
                <p className="text-[11px] font-medium opacity-75">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {capability?.reasons?.length ? (
            <ul className="mt-3 list-disc pl-5 text-xs">
              {capability.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ChartPanel;
