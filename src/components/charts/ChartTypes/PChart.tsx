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

const PChart: React.FC = () => {
  const { processedData, selectedColumns, chartOptions, xAxisColumn: xColumn } = useAppContext();
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  
  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }
  
  const selectedColumn = selectedColumns[0];
  const data = processedData.data;
  const { ucl, lcl, centerLine, sigma } = processedData.controlLimits;
  const { ruleViolations } = processedData;
  
  // Create labels for the X axis (index or chosen X column)
  const labels = xColumn
    ? data.map((row) => String(row[xColumn] ?? ''))
    : data.map((_, index) => `${index + 1}`);
  
  // Extract data values
  const values = data.map(row => parseFloat(row[selectedColumn]));
  
  // Create point backgrounds with special highlight for violations
  const defaultPointColor = 'rgba(54, 162, 235, 0.8)';
  const pointBackgroundColors = values.map((_, index) => {
    if (!chartOptions.showRuleViolations) return defaultPointColor;
    const hasViolation = ruleViolations.some(v => v.index === index);
    return hasViolation ? 'red' : defaultPointColor;
  });
  
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Proportion',
        data: values,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        backgroundColor: pointBackgroundColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
      },
      // Center line
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line (p)',
          data: Array(values.length).fill(centerLine),
          borderColor: 'rgba(75, 192, 192, 0.8)',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
      ...(chartOptions.showSigma1 ? [
        {
          label: '+1σ',
          data: Array(values.length).fill(centerLine + sigma),
          borderColor: 'rgba(255, 205, 86, 0.6)',
          borderDash: [2, 2],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
        {
          label: '-1σ',
          data: Array(values.length).fill(centerLine - sigma),
          borderColor: 'rgba(255, 205, 86, 0.6)',
          borderDash: [2, 2],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        {
          label: '+2σ',
          data: Array(values.length).fill(centerLine + 2 * sigma),
          borderColor: 'rgba(255, 159, 64, 0.6)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
        {
          label: '-2σ',
          data: Array(values.length).fill(centerLine - 2 * sigma),
          borderColor: 'rgba(255, 159, 64, 0.6)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
      ] : []),
      ...((chartOptions.showControlLimits || chartOptions.showSigma3) ? [
        {
          label: '+3σ (UCL)',
          data: Array(values.length).fill(ucl),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: '-3σ (LCL)',
          data: Array(values.length).fill(lcl),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
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

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartOptions.title || 'P Chart (Proportion)',
        font: {
          size: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const hasViolation = chartOptions.showRuleViolations && ruleViolations.some(v => v.index === index);
            
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(4)}`];
            
            if (hasViolation) {
              const violations = ruleViolations.filter(v => v.index === index);
              violations.forEach(v => {
                labels.push(`Rule ${v.ruleNumber} violation: ${v.description}`);
              });
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
          text: chartOptions.xAxisLabel || 'Sample Group',
        },
      },
      y: {
        title: {
          display: true,
          text: chartOptions.yAxisLabel || 'Proportion',
        },
        min: Math.max(0, lcl - 0.1 * (ucl - lcl)),
        max: ucl + 0.1 * (ucl - lcl),
      },
    },
  };
  
  return (
    <div style={{ height: '440px' }}>
      <div className="flex gap-2 justify-end mb-2">
        <button className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 border" onClick={resetChart}>Reset View</button>
      </div>
      <div style={{ height: '400px' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
};

export default PChart;
