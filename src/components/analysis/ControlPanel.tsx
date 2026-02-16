import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { ChartType } from '../../types/DataTypes';
import ChartTypeInfo from './ChartTypeInfo';
import MultipleSelector, { Option } from '../ui/multiselect';

const ControlPanel: React.FC = () => {
  const {
    selectedChartType,
    setSelectedChartType,
    chartOptions,
    setChartOptions,
    isDataLoaded,
    rawData,
    selectedColumns,
    setSelectedColumns,
    xAxisColumn,
    setXAxisColumn,
  } = useAppContext();
  const { t } = useLanguage();
  
  // Chart type options
  const chartTypes: { value: ChartType; label: string }[] = [
    { value: 'individual', label: 'Individual (I) Chart' },
    { value: 'pChart', label: 'P Chart (Proportion)' },
    { value: 'npChart', label: 'NP Chart (Number of Defects)' },
    { value: 'xBarS', label: 'X-bar S Chart' },
    { value: 'xBarR', label: 'X-bar R Chart' },
    { value: 'ewma', label: 'EWMA Chart' },
    { value: 'histogram', label: 'Histogram' },
    { value: 'scatterPlot', label: 'Scatter Plot' },
  ];
  
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">{t('controlPanel.title')}</h3>
      
      {/* Chart Type Selection */}
      <div className="mb-4">
        <label htmlFor="chart-type" className="block text-sm font-medium text-gray-700 mb-1">
          {t('controlPanel.chartType')}
        </label>
        <select
          id="chart-type"
          className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          value={selectedChartType}
          onChange={(e) => setSelectedChartType(e.target.value as ChartType)}
          disabled={!isDataLoaded}
        >
          {chartTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Data configuration */}
      {rawData && rawData.headers.length > 0 && (
        <div className="space-y-4 mb-4">
          <div>
            <label htmlFor="x-axis-column" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fileUpload.selectXAxis')}
            </label>
            <select
              id="x-axis-column"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={xAxisColumn || ''}
              onChange={(e) => {
                const x = e.target.value;
                setXAxisColumn(x || null);
              }}
              disabled={!isDataLoaded}
            >
              <option value="">{t('fileUpload.useRowIndex')}</option>
              {rawData.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('fileUpload.xAxisHint')}</p>
          </div>

          <div>
            <label htmlFor="data-column" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fileUpload.selectYValue')}
            </label>
            <MultipleSelector
              value={selectedColumns.map((column) => ({ value: column, label: column }))}
              options={rawData.headers.map((header): Option => ({ value: header, label: header }))}
              placeholder={t('fileUpload.selectYValue')}
              disabled={!isDataLoaded}
              className="bg-white"
              hidePlaceholderWhenSelected
              emptyIndicator={<p className="text-center text-sm">No results found</p>}
              onChange={(options) => setSelectedColumns(options.map((option) => option.value))}
              commandProps={{ label: t('fileUpload.selectYValue') }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Selected columns: {selectedColumns.length}
            </p>
          </div>
        </div>
      )}
      
      {/* Chart Customization */}
      <div className="space-y-4">
        <div>
          <label htmlFor="chart-title" className="block text-sm font-medium text-gray-700 mb-1">
            {t('controlPanel.chartTitle')}
          </label>
          <input
            id="chart-title"
            type="text"
            className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={chartOptions.title}
            onChange={(e) => setChartOptions({ ...chartOptions, title: e.target.value })}
            disabled={!isDataLoaded}
          />
        </div>
        
        <div>
          <label htmlFor="x-axis-label" className="block text-sm font-medium text-gray-700 mb-1">
            {t('controlPanel.xAxisLabel')}
          </label>
          <input
            id="x-axis-label"
            type="text"
            className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={chartOptions.xAxisLabel}
            onChange={(e) => setChartOptions({ ...chartOptions, xAxisLabel: e.target.value })}
            disabled={!isDataLoaded}
          />
        </div>
        
        <div>
          <label htmlFor="y-axis-label" className="block text-sm font-medium text-gray-700 mb-1">
            {t('controlPanel.yAxisLabel')}
          </label>
          <input
            id="y-axis-label"
            type="text"
            className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={chartOptions.yAxisLabel}
            onChange={(e) => setChartOptions({ ...chartOptions, yAxisLabel: e.target.value })}
            disabled={!isDataLoaded}
          />
        </div>
        
        {/* Display Options */}
        <div className="pt-2">
          <p className="text-sm font-medium text-gray-700 mb-2">{t('controlPanel.displayOptions')}</p>
          
          <div className="flex items-center mb-2">
            <input
              id="show-control-limits"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={chartOptions.showControlLimits}
              onChange={(e) => setChartOptions({ ...chartOptions, showControlLimits: e.target.checked })}
              disabled={!isDataLoaded}
            />
            <label htmlFor="show-control-limits" className="ml-2 block text-sm text-gray-700">
              {t('controlPanel.showControlLimits')}
            </label>
          </div>
          
          <div className="flex items-center mb-2">
            <input
              id="show-center-line"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={chartOptions.showCenterLine}
              onChange={(e) => setChartOptions({ ...chartOptions, showCenterLine: e.target.checked })}
              disabled={!isDataLoaded}
            />
            <label htmlFor="show-center-line" className="ml-2 block text-sm text-gray-700">
              {t('controlPanel.showCenterLine')}
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <label className="inline-flex items-center text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                checked={chartOptions.showSigma1}
                onChange={(e) => setChartOptions({ ...chartOptions, showSigma1: e.target.checked })}
                disabled={!isDataLoaded}
              />
              {t('controlPanel.showSigma1')}
            </label>
            <label className="inline-flex items-center text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                checked={chartOptions.showSigma2}
                onChange={(e) => setChartOptions({ ...chartOptions, showSigma2: e.target.checked })}
                disabled={!isDataLoaded}
              />
              {t('controlPanel.showSigma2')}
            </label>
            <label className="inline-flex items-center text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                checked={chartOptions.showSigma3}
                onChange={(e) => setChartOptions({ ...chartOptions, showSigma3: e.target.checked })}
                disabled={!isDataLoaded}
              />
              {t('controlPanel.showSigma3')}
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              id="show-rule-violations"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={chartOptions.showRuleViolations}
              onChange={(e) => setChartOptions({ ...chartOptions, showRuleViolations: e.target.checked })}
              disabled={!isDataLoaded}
            />
            <label htmlFor="show-rule-violations" className="ml-2 block text-sm text-gray-700">
              {t('controlPanel.highlightViolations')}
            </label>
          </div>
        </div>
      </div>
    {/* Chart Type Informational Panel */}
    <ChartTypeInfo />
    </div>
  );
};

export default ControlPanel;
