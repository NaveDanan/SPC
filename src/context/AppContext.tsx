import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChartType, DataSet, ProcessedData, ChartOptions } from '../types/DataTypes';
import { calculateControlLimits } from '../utils/spcCalculations';
import { detectRuleViolations } from '../utils/westernElectricRules';

interface AppContextType {
  rawData: DataSet | null;
  setRawData: (data: DataSet | null) => void;
  processedData: ProcessedData | null;
  selectedChartType: ChartType;
  setSelectedChartType: (type: ChartType) => void;
  chartOptions: ChartOptions;
  setChartOptions: (options: ChartOptions) => void;
  isDataLoaded: boolean;
  isProcessing: boolean;
  selectedColumns: string[];
  setSelectedColumns: (columns: string[]) => void;
  sampleSize: number;
  setSampleSize: (size: number) => void;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
  resetData: () => void;
}

const defaultChartOptions: ChartOptions = {
  title: 'SPC Analysis Chart',
  xAxisLabel: 'Sample',
  yAxisLabel: 'Value',
  showControlLimits: true,
  showCenterLine: true,
  showRuleViolations: true,
  colorScheme: 'default',
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rawData, setRawData] = useState<DataSet | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('individual');
  const [chartOptions, setChartOptions] = useState<ChartOptions>(defaultChartOptions);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [sampleSize, setSampleSize] = useState<number>(5);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDataLoaded = rawData !== null && rawData.data.length > 0;

  useEffect(() => {
    if (rawData && selectedColumns.length > 0) {
      processData();
    }
  }, [rawData, selectedColumns, selectedChartType, sampleSize]);

  const processData = async () => {
    if (!rawData || selectedColumns.length === 0) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Extract only the selected columns from the raw data
      const filteredData = rawData.data.map(row => {
        const newRow: Record<string, any> = {};
        selectedColumns.forEach(col => {
          newRow[col] = row[col];
        });
        return newRow;
      });

      // Calculate control limits based on the chart type
      const controlLimits = calculateControlLimits(filteredData, selectedColumns[0], selectedChartType, sampleSize);
      
      // Detect rule violations
      const violations = detectRuleViolations(filteredData, selectedColumns[0], controlLimits);

      setProcessedData({
        data: filteredData,
        controlLimits,
        ruleViolations: violations,
        statistics: {
          mean: controlLimits.centerLine,
          standardDeviation: controlLimits.sigma,
          min: Math.min(...filteredData.map(row => parseFloat(row[selectedColumns[0]]))),
          max: Math.max(...filteredData.map(row => parseFloat(row[selectedColumns[0]]))),
          count: filteredData.length,
        }
      });
    } catch (error) {
      console.error('Error processing data:', error);
      setErrorMessage('Error processing data. Please check your data format and selected columns.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetData = () => {
    setRawData(null);
    setProcessedData(null);
    setSelectedColumns([]);
    setErrorMessage(null);
  };

  const value = {
    rawData,
    setRawData,
    processedData,
    selectedChartType,
    setSelectedChartType,
    chartOptions,
    setChartOptions,
    isDataLoaded,
    isProcessing,
    selectedColumns,
    setSelectedColumns,
    sampleSize,
    setSampleSize,
    errorMessage,
    setErrorMessage,
    resetData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};