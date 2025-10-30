import React, { useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { useAppContext } from '../../../context/AppContext';
import { prepareHistogramData } from '../../../utils/spcCalculations';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

const Histogram: React.FC = () => {
  const { processedData, selectedColumns, chartOptions } = useAppContext();
  const chartRef = useRef<ChartJS<'bar'> | null>(null);
  
  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }
  
  const selectedColumn = selectedColumns[0];
  const data = processedData.data;
  const { centerLine, sigma } = processedData.controlLimits;
  
  // Extract data values
  const values = data.map(row => parseFloat(row[selectedColumn]));
  
  // Prepare histogram data
  const { bins, counts } = prepareHistogramData(values);
  
  // Create bin labels (midpoints)
  const binLabels = bins.slice(0, -1).map((bin, i) => {
    const nextBin = bins[i + 1];
    return ((bin + nextBin) / 2).toFixed(2);
  });
  
  const chartData = {
    labels: binLabels,
    datasets: [
      {
        label: 'Frequency',
        data: counts,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
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

  const chartOptions1: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartOptions.title || 'Histogram',
        font: {
          size: 16,
        }
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex;
            const binStart = bins[index];
            const binEnd = bins[index + 1];
            return `Range: ${binStart.toFixed(2)} - ${binEnd.toFixed(2)}`;
          },
          label: (context) => {
            return `Frequency: ${context.parsed.y}`;
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
          text: chartOptions.xAxisLabel || 'Value',
        },
      },
      y: {
        title: {
          display: true,
          text: chartOptions.yAxisLabel || 'Frequency',
        },
        beginAtZero: true,
      },
    },
  };
  
  return (
    <div>
      <div className="flex gap-2 justify-end mb-2">
        <button className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 border" onClick={resetChart}>Reset View</button>
      </div>
      <div style={{ height: '400px' }}>
        <Bar ref={chartRef} data={chartData} options={chartOptions1} />
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-blue-50 p-3 rounded-md">
          <p className="font-medium">Summary Statistics</p>
          <p>Mean: {centerLine.toFixed(3)}</p>
          <p>Standard Deviation: {sigma.toFixed(3)}</p>
          <p>Sample Size: {values.length}</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-md">
          <p className="font-medium">Percentiles</p>
          <p>Minimum: {Math.min(...values).toFixed(3)}</p>
          <p>Maximum: {Math.max(...values).toFixed(3)}</p>
          <p>Range: {(Math.max(...values) - Math.min(...values)).toFixed(3)}</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-md">
          <p className="font-medium">Distribution</p>
          <p>Skewness: {calculateSkewness(values).toFixed(3)}</p>
          <p>Kurtosis: {calculateKurtosis(values).toFixed(3)}</p>
          <p>Bins: {bins.length - 1}</p>
        </div>
      </div>
    </div>
  );
};

// Calculate skewness
const calculateSkewness = (values: number[]): number => {
  const n = values.length;
  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const cubedDeviations = values.map(val => Math.pow((val - mean) / stdDev, 3));
  const skewness = cubedDeviations.reduce((sum, val) => sum + val, 0) / n;
  
  return skewness;
};

// Calculate kurtosis
const calculateKurtosis = (values: number[]): number => {
  const n = values.length;
  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const fourthPowerDeviations = values.map(val => Math.pow((val - mean) / stdDev, 4));
  const kurtosis = fourthPowerDeviations.reduce((sum, val) => sum + val, 0) / n;
  
  // Subtract 3 to get excess kurtosis (normal distribution has kurtosis of 3)
  return kurtosis - 3;
};

export default Histogram;
