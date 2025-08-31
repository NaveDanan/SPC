import React from 'react';
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
import annotationPlugin from 'chartjs-plugin-annotation';
import { useAppContext } from '../../../context/AppContext';
import { getControlChartConstants } from '../../../utils/spcCalculations';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const IndividualChart: React.FC = () => {
  const { processedData, selectedColumns, chartOptions } = useAppContext();

  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }

  const selectedColumn = selectedColumns[0];
  const { xAxisColumn: xColumn } = useAppContext();
  const data = processedData.data;
  const { ucl, lcl, centerLine, sigma } = processedData.controlLimits;
  const { ruleViolations } = processedData;

  // Labels for I chart (index or chosen X column)
  const labels = xColumn
    ? data.map((row) => String(row[xColumn] ?? ''))
    : data.map((_, index) => `${index + 1}`);

  const values = data.map(row => parseFloat(row[selectedColumn]));

  const defaultPointColor = 'rgba(54, 162, 235, 0.8)';
  const pointBackgroundColors = values.map((_, index) => {
    if (!chartOptions.showRuleViolations) return defaultPointColor;
    const hasViolation = ruleViolations.some(v => v.index === index);
    return hasViolation ? 'red' : defaultPointColor;
  });

  const iData = {
    labels,
    datasets: [
      {
        label: selectedColumn,
        data: values,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        backgroundColor: pointBackgroundColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
      },
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line',
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

  const iOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: chartOptions.title || 'Individuals (I) Chart', font: { size: 16 } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const hasViolation = chartOptions.showRuleViolations && ruleViolations.some(v => v.index === index);
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(2)}`];
            if (hasViolation) {
              const violations = ruleViolations.filter(v => v.index === index);
              violations.forEach(v => labels.push(`Rule ${v.ruleNumber} violation: ${v.description}`));
            }
            return labels;
          }
        }
      }
    },
    scales: {
      x: { title: { display: true, text: chartOptions.xAxisLabel || 'Sample' } },
      y: { title: { display: true, text: chartOptions.yAxisLabel || 'Value' } },
    },
  };

  // Moving Range (mR) chart (lag 2)
  const mrValues = values.slice(1).map((v, i) => Math.abs(v - values[i]));
  const mrLabels = labels.slice(1); // align with second point in each pair
  const mrBar = mrValues.length ? mrValues.reduce((a, b) => a + b, 0) / mrValues.length : 0;
  const constants = getControlChartConstants(2);
  const mrUCL = constants.d4 * mrBar;
  const mrLCL = Math.max(0, constants.d3 * mrBar);

  const mrData = {
    labels: mrLabels,
    datasets: [
      {
        label: 'Moving Range (mR)',
        data: mrValues,
        borderColor: 'rgba(153, 102, 255, 0.9)',
        backgroundColor: 'rgba(153, 102, 255, 0.9)',
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      },
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line (MR̄)',
          data: Array(mrValues.length).fill(mrBar),
          borderColor: 'rgba(75, 192, 192, 0.9)',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
      ...(chartOptions.showControlLimits ? [
        {
          label: 'UCL (mR)',
          data: Array(mrValues.length).fill(mrUCL),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'LCL (mR)',
          data: Array(mrValues.length).fill(mrLCL),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
    ],
  };

  const mrOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Moving Range (mR) Chart', font: { size: 16 } },
    },
    scales: {
      x: { title: { display: true, text: chartOptions.xAxisLabel || 'Sample' } },
      y: { title: { display: true, text: 'Moving Range' } },
    },
  };

  return (
    <div className="space-y-6">
      <div style={{ height: '320px' }}>
        <Line data={iData} options={iOptions} />
      </div>
      <div style={{ height: '320px' }}>
        <Line data={mrData} options={mrOptions} />
      </div>
    </div>
  );
};

export default IndividualChart;
