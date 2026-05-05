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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, zoomPlugin);

const CChart: React.FC = () => {
  const { processedData, selectedColumns, chartOptions, xAxisColumn: xColumn } = useAppContext();
  const chartRef = useRef<ChartJS<'line'> | null>(null);

  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }

  const selectedColumn = selectedColumns[0];
  const data = processedData.data;
  const { ucl, lcl, centerLine, sigma, chartValues } = processedData.controlLimits;
  const { ruleViolations } = processedData;
  const labels = xColumn
    ? data.map((row) => String(row[xColumn] ?? ''))
    : data.map((_, index) => `${index + 1}`);
  const values = chartValues?.length === data.length
    ? chartValues
    : data.map(row => parseFloat(String(row[selectedColumn])));
  const defaultPointColor = 'rgba(54, 162, 235, 0.8)';
  const pointBackgroundColors = values.map((_, index) => (
    chartOptions.showRuleViolations && ruleViolations.some(v => v.index === index) ? 'red' : defaultPointColor
  ));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Defect Count',
        data: values,
        borderColor: defaultPointColor,
        backgroundColor: pointBackgroundColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
      },
      ...(chartOptions.showCenterLine ? [{
        label: 'Center Line (c-bar)',
        data: Array(values.length).fill(centerLine),
        borderColor: 'rgba(75, 192, 192, 0.8)',
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      }] : []),
      ...(chartOptions.showSigma1 ? [
        { label: '+1σ', data: Array(values.length).fill(centerLine + sigma), borderColor: 'rgba(255, 205, 86, 0.6)', borderDash: [2, 2], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-1σ', data: Array(values.length).fill(Math.max(0, centerLine - sigma)), borderColor: 'rgba(255, 205, 86, 0.6)', borderDash: [2, 2], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        { label: '+2σ', data: Array(values.length).fill(centerLine + 2 * sigma), borderColor: 'rgba(255, 159, 64, 0.6)', borderDash: [3, 3], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-2σ', data: Array(values.length).fill(Math.max(0, centerLine - 2 * sigma)), borderColor: 'rgba(255, 159, 64, 0.6)', borderDash: [3, 3], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...((chartOptions.showControlLimits || chartOptions.showSigma3) ? [
        { label: 'UCL', data: Array(values.length).fill(ucl), borderColor: 'rgba(255, 99, 132, 0.9)', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'LCL', data: Array(values.length).fill(lcl), borderColor: 'rgba(255, 99, 132, 0.9)', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false },
      ] : []),
    ],
  };

  const resetChart = () => {
    const chart = chartRef.current;
    if (!chart) return;
    if (typeof chart.resetZoom === 'function') {
      try { chart.resetZoom(); return; } catch { /* noop */ }
    }
    chart.update('none');
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: chartOptions.title || 'C Chart (Defects)', font: { size: 16 } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(0)}`];
            if (chartOptions.showRuleViolations) {
              ruleViolations
                .filter(v => v.index === context.dataIndex)
                .forEach(v => labels.push(`Rule ${v.ruleNumber}: ${v.description}`));
            }
            return labels;
          },
        },
      },
      zoom: { zoom: { wheel: { enabled: true, modifierKey: 'ctrl' }, pinch: { enabled: true }, mode: 'xy' }, pan: { enabled: true, mode: 'xy' } },
    },
    scales: {
      x: { title: { display: true, text: chartOptions.xAxisLabel || 'Sample' } },
      y: { title: { display: true, text: chartOptions.yAxisLabel || 'Defect Count' }, min: 0 },
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

export default CChart;
