import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChartType, DataSet, ProcessedData, ChartOptions, Sheet } from '../types/DataTypes';
import { calculateControlLimits } from '../utils/spcCalculations';
import { detectRuleViolations } from '../utils/westernElectricRules';

interface AppContextType {
  rawData: DataSet | null;
  setRawData: (data: DataSet | null) => void;
  setActiveSheetIndex: (index: number) => void;
  addSheet: (name?: string) => void;
  copySheet: (index: number) => void;
  removeSheet: (index: number) => void;
  moveSheet: (from: number, to: number) => void;
  renameSheet: (index: number, name: string) => void;
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
    setActiveSheetIndex: (index: number) => {
      setRawData(prev => {
        if (!prev || !prev.sheets) return prev;
        if (index < 0 || index >= prev.sheets.length) return prev;
        const sheet = prev.sheets[index];
        return { ...prev, activeSheetIndex: index, data: sheet.data, headers: sheet.headers };
      });
    },
    addSheet: (name?: string) => {
      setRawData(prev => {
        if (!prev) return prev;
        const sheets: Sheet[] = prev.sheets ? [...prev.sheets] : [{ name: 'Sheet1', data: prev.data, headers: prev.headers }];
        const base = name || 'Sheet';
        let counter = 1;
        let newName = `${base}${counter}`;
        const existingNames = new Set(sheets.map(s => s.name));
        while (existingNames.has(newName)) {
          counter++;
          newName = `${base}${counter}`;
        }
        const newSheet: Sheet = { name: newName, data: [], headers: [] };
        sheets.push(newSheet);
        return { ...prev, sheets, activeSheetIndex: sheets.length - 1, data: newSheet.data, headers: newSheet.headers };
      });
    },
    copySheet: (index: number) => {
      setRawData(prev => {
        if (!prev) return prev;
        const sheets: Sheet[] = prev.sheets ? [...prev.sheets] : [{ name: 'Sheet1', data: prev.data, headers: prev.headers }];
        if (index < 0 || index >= sheets.length) return prev;
        const src = sheets[index];
        let copyName = `${src.name} Copy`;
        let i = 2;
        const existing = new Set(sheets.map(s => s.name));
        while (existing.has(copyName)) {
          copyName = `${src.name} Copy ${i++}`;
        }
        const newSheet: Sheet = { name: copyName, headers: [...src.headers], data: src.data.map(r => ({ ...r })) };
        sheets.splice(index + 1, 0, newSheet);
        return { ...prev, sheets, activeSheetIndex: index + 1, data: newSheet.data, headers: newSheet.headers };
      });
    },
    removeSheet: (index: number) => {
      setRawData(prev => {
        if (!prev) return prev;
        const sheets: Sheet[] = prev.sheets ? [...prev.sheets] : [{ name: 'Sheet1', data: prev.data, headers: prev.headers }];
        if (sheets.length === 1) return prev; // keep at least one
        if (index < 0 || index >= sheets.length) return prev;
        sheets.splice(index, 1);
        const newActive = Math.min(index, sheets.length - 1);
        const activeSheet = sheets[newActive];
        return { ...prev, sheets, activeSheetIndex: newActive, data: activeSheet.data, headers: activeSheet.headers };
      });
    },
    moveSheet: (from: number, to: number) => {
      setRawData(prev => {
        if (!prev || !prev.sheets) return prev;
        const sheets = [...prev.sheets];
        if (from < 0 || from >= sheets.length || to < 0 || to >= sheets.length) return prev;
        const [moved] = sheets.splice(from, 1);
        sheets.splice(to, 0, moved);
        let active = prev.activeSheetIndex ?? 0;
        if (active === from) active = to;
        else if (from < active && to >= active) active -= 1;
        else if (from > active && to <= active) active += 1;
        const sheet = sheets[active];
        return { ...prev, sheets, activeSheetIndex: active, data: sheet.data, headers: sheet.headers };
      });
    },
    renameSheet: (index: number, name: string) => {
      setRawData(prev => {
        if (!prev || !prev.sheets) return prev;
        if (!name.trim()) return prev;
        const sheets = prev.sheets.map((s, i) => (i === index ? { ...s, name } : s));
        return { ...prev, sheets };
      });
    },
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