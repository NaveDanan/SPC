import React, { useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { useAppContext } from '../../../context/AppContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

const EWMAChart: React.FC = () => {
  const { processedData, selectedColumns, chartOptions, xAxisColumn } = useAppContext();
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  
  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }
  
  const selectedColumn = selectedColumns[0];
  const xColumn = xAxisColumn;
  const data = processedData.data;
  const { ucl, lcl, centerLine, sigma, uclSeries, lclSeries, sigmaSeries, chartValues } = processedData.controlLimits;
  const { ruleViolations } = processedData;
  
  // Create labels for the X axis (index or chosen X column)
  const labels = xColumn
    ? data.map((row) => String(row[xColumn] ?? ''))
    : data.map((_, index) => `${index + 1}`);
  
  // Extract data values
  const values = data.map(row => parseFloat(row[selectedColumn]));
  
  // Calculate EWMA values with lambda = 0.2
  const lambda = 0.2;
  const ewmaValues = chartValues?.length === values.length ? chartValues : values;
  const upperLimitValues = uclSeries?.length === values.length ? uclSeries : Array(values.length).fill(ucl);
  const lowerLimitValues = lclSeries?.length === values.length ? lclSeries : Array(values.length).fill(lcl);
  const ewmaSigmaValues = sigmaSeries?.length === values.length
    ? sigmaSeries
    : Array(values.length).fill(sigma * Math.sqrt(lambda / (2 - lambda)));
  
  // Create point backgrounds with special highlight for violations
  const defaultPointColor = 'rgba(75, 192, 192, 0.8)';
  const pointBackgroundColors = ewmaValues.map((val, index) => {
    if (!chartOptions.showRuleViolations) return defaultPointColor;
    const beyondLimits = val > upperLimitValues[index] || val < lowerLimitValues[index];
    const hasViolation = ruleViolations.some(v => v.index === index);
    return beyondLimits || hasViolation ? 'red' : defaultPointColor;
  });
  
  const chartData = {
    labels,
    datasets: [
      {
        label: 'EWMA',
        data: ewmaValues,
        borderColor: 'rgba(75, 192, 192, 0.8)',
        backgroundColor: pointBackgroundColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
      },
      // Raw data (optional)
      {
        label: 'Raw Data',
        data: values,
        borderColor: 'rgba(169, 169, 169, 0.3)',
        backgroundColor: 'rgba(169, 169, 169, 0.1)',
        pointRadius: 2,
        pointHoverRadius: 3,
        tension: 0.1,
        borderDash: [2, 2],
      },
      // Center line
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line',
          data: Array(values.length).fill(centerLine),
          borderColor: 'rgba(54, 162, 235, 0.8)',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
      // Control limits
      ...(chartOptions.showSigma1 ? [
        { label: '+1σ', data: ewmaSigmaValues.map((pointSigma) => centerLine + pointSigma), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-1σ', data: ewmaSigmaValues.map((pointSigma) => centerLine - pointSigma), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        { label: '+2σ', data: ewmaSigmaValues.map((pointSigma) => centerLine + 2*pointSigma), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-2σ', data: ewmaSigmaValues.map((pointSigma) => centerLine - 2*pointSigma), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...((chartOptions.showControlLimits || chartOptions.showSigma3) ? [
        { label: 'UCL', data: upperLimitValues, borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'LCL', data: lowerLimitValues, borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
      ] : []),
    ],
  };
  
  type ScaleWithMinMax = { min?: number; max?: number };
  const resetChart = () => {
    const chart = chartRef.current;
    if (!chart) return;
    if (typeof chart.resetZoom === 'function') {
      try { chart.resetZoom(); return; } catch { /* noop */ }
    }
    chart.options.scales = chart.options.scales || {};
    if (chart.options.scales.x) {
      const sx = chart.options.scales.x as unknown as ScaleWithMinMax;
      delete sx.min; delete sx.max;
    }
    if (chart.options.scales.y) {
      const sy = chart.options.scales.y as unknown as ScaleWithMinMax;
      delete sy.min; delete sy.max;
    }
    chart.update('none');
  };

  const chartOptions1: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartOptions.title || `EWMA Chart (λ=${lambda})`,
        font: {
          size: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(3)}`];
            
            if (context.dataset.label === 'EWMA') {
              if (chartOptions.showRuleViolations) {
                if (ewmaValues[index] > upperLimitValues[index]) {
                  labels.push('Above UCL');
                } else if (ewmaValues[index] < lowerLimitValues[index]) {
                  labels.push('Below LCL');
                }
                const hasViolation = ruleViolations.some(v => v.index === index);
                if (hasViolation) {
                  const violations = ruleViolations.filter(v => v.index === index);
                  violations.forEach(v => {
                    labels.push(`Rule ${v.ruleNumber} violation: ${v.description}`);
                  });
                }
              }
            }
            
            return labels;
          }
        }
      },
      zoom: {
        zoom: { wheel: { enabled: true, modifierKey: 'ctrl' }, pinch: { enabled: true }, mode: 'xy' },
        pan: { enabled: true, mode: 'xy' },
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: chartOptions.xAxisLabel || 'Sample',
        },
      },
      y: {
        title: {
          display: true,
          text: chartOptions.yAxisLabel || 'EWMA Value',
        },
      },
    },
  };
  
  return (
    <div style={{ height: '440px' }}>
      <div className="flex gap-2 justify-end mb-2">
        <button className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 border" onClick={resetChart}>Reset View</button>
      </div>
      <div style={{ height: '400px' }}>
        <Line ref={chartRef} data={chartData} options={chartOptions1} />
      </div>
      <div className="mt-2 text-xs text-gray-500">
        <p>EWMA (λ={lambda}): Exponentially Weighted Moving Average with weighting factor λ</p>
      </div>
    </div>
  );
};

export default EWMAChart;
