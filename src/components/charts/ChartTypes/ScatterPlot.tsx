import React, { useRef } from 'react';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { useAppContext } from '../../../context/AppContext';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, zoomPlugin);

const ScatterPlot: React.FC = () => {
  const { processedData, selectedColumns, chartOptions, xAxisColumn } = useAppContext();
  const chartRef = useRef<ChartJS<'scatter'> | null>(null);
  
  if (!processedData || !selectedColumns.length || selectedColumns.length < 1) {
    return <div className="text-gray-500">Select at least one data column for scatter plot</div>;
  }
  
  const primaryColumn = selectedColumns[0];
  const data = processedData.data;
  
  // For a scatter plot, we need x and y values
  // If only one column is selected, use indices as x values
  // If two columns are selected, use the second column as x values
  
  const hasSecondaryColumn = !!xAxisColumn;
  const secondaryColumn = xAxisColumn ? xAxisColumn : null;
  
  // Extract data points
  const dataPoints = data.map((row, index) => {
    const y = parseFloat(row[primaryColumn]);
    
    // If we have a secondary column, use it for x values, otherwise use the index
    const x = secondaryColumn ? parseFloat(row[secondaryColumn]) : index + 1;
    
    return { x, y };
  });
  
  // Calculate trend line (linear regression)
  const { slope, intercept } = calculateLinearRegression(dataPoints);
  
  // Generate trend line points
  const xValues = dataPoints.map(point => point.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  
  const trendLinePoints = [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept }
  ];
  
  const chartData = {
    datasets: [
      {
        label: hasSecondaryColumn 
          ? `${primaryColumn} vs ${secondaryColumn}` 
          : primaryColumn,
        data: dataPoints,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: 'Trend Line',
        data: trendLinePoints,
        type: 'line' as const,
        fill: false,
        borderColor: 'rgba(255, 99, 132, 0.8)',
        borderDash: [5, 5],
        pointRadius: 0,
      }
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

  const chartOptions1: ChartOptions<'scatter'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartOptions.title || 'Scatter Plot with Trend Analysis',
        font: {
          size: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const point = context.raw as { x: number; y: number };
            return `${secondaryColumn || 'X'}: ${point.x.toFixed(2)}, ${primaryColumn}: ${point.y.toFixed(2)}`;
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
          text: chartOptions.xAxisLabel || (secondaryColumn || 'X'),
        },
      },
      y: {
        title: {
          display: true,
          text: chartOptions.yAxisLabel || primaryColumn,
        },
      },
    },
  };
  
  return (
    <div>
      <div className="flex gap-2 justify-end mb-2">
        <button className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 border" onClick={resetChart}>Reset View</button>
      </div>
      <div style={{ height: '400px' }}>
        <Scatter ref={chartRef} data={chartData} options={chartOptions1} />
      </div>
      
      <div className="mt-4 bg-blue-50 p-3 rounded-md">
        <p className="font-medium">Trend Analysis</p>
        <p>Equation: y = {slope.toFixed(4)}x + {intercept.toFixed(4)}</p>
        <p>Correlation: {calculateCorrelation(dataPoints).toFixed(4)}</p>
        <p>{Math.abs(calculateCorrelation(dataPoints)) > 0.7 ? 'Strong correlation' : 'Weak correlation'}</p>
      </div>
    </div>
  );
};

// Calculate linear regression (least squares method)
const calculateLinearRegression = (points: { x: number; y: number }[]): { slope: number; intercept: number } => {
  const n = points.length;
  
  // Calculate means
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / n;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / n;
  
  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  
  for (const point of points) {
    numerator += (point.x - xMean) * (point.y - yMean);
    denominator += Math.pow(point.x - xMean, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  
  return { slope, intercept };
};

// Calculate correlation coefficient
const calculateCorrelation = (points: { x: number; y: number }[]): number => {
  const n = points.length;
  
  // Calculate means
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / n;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / n;
  
  // Calculate variance and covariance
  let xxVar = 0;
  let yyVar = 0;
  let xyCovar = 0;
  
  for (const point of points) {
    xxVar += Math.pow(point.x - xMean, 2);
    yyVar += Math.pow(point.y - yMean, 2);
    xyCovar += (point.x - xMean) * (point.y - yMean);
  }
  
  // Calculate correlation coefficient
  return yyVar !== 0 && xxVar !== 0 ? xyCovar / Math.sqrt(xxVar * yyVar) : 0;
};

export default ScatterPlot;
