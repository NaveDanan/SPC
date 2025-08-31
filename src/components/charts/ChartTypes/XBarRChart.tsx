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
import { useAppContext } from '../../../context/AppContext';
import { computeXbarRComponents } from '../../../utils/spcCalculations';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

const XBarRChart: React.FC = () => {
  const { processedData, selectedColumns, chartOptions, sampleSize } = useAppContext();

  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }

  const selectedColumn = selectedColumns[0];
  const data = processedData.data;
  const values = data.map(row => parseFloat(row[selectedColumn]));
  const { subgroupMeans, subgroupRanges, xbarLimits, rChartLimits } = computeXbarRComponents(values, sampleSize);

  const labels = subgroupMeans.map((_, index) => `${index + 1}`);

  const xbarData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Mean (X-bar)',
        data: subgroupMeans,
        borderColor: 'rgba(54, 162, 235, 0.9)',
        backgroundColor: 'rgba(54, 162, 235, 0.9)',
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      },
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line',
          data: Array(subgroupMeans.length).fill(xbarLimits.centerLine),
          borderColor: 'rgba(75, 192, 192, 0.9)',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
      ...(chartOptions.showControlLimits ? [
        {
          label: 'UCL',
          data: Array(subgroupMeans.length).fill(xbarLimits.ucl),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'LCL',
          data: Array(subgroupMeans.length).fill(xbarLimits.lcl),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ] : []),
    ],
  };

  const rData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Range (R)',
        data: subgroupRanges,
        borderColor: 'rgba(255, 159, 64, 0.9)',
        backgroundColor: 'rgba(255, 159, 64, 0.9)',
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      },
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line (R̄)',
          data: Array(subgroupRanges.length).fill(rChartLimits.centerLine),
          borderColor: 'rgba(75, 192, 192, 0.9)',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
      ...(chartOptions.showControlLimits ? [
        {
          label: 'UCL (R)',
          data: Array(subgroupRanges.length).fill(rChartLimits.ucl),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'LCL (R)',
          data: Array(subgroupRanges.length).fill(rChartLimits.lcl),
          borderColor: 'rgba(255, 99, 132, 0.9)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ] : []),
    ],
  };

  const xbarOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: chartOptions.title || `X-bar Chart (n=${sampleSize})`, font: { size: 16 } },
    },
    scales: {
      x: { title: { display: true, text: chartOptions.xAxisLabel || 'Subgroup' } },
      y: { title: { display: true, text: 'Subgroup Mean (X̄)' } },
    },
  };

  const rOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `R Chart (n=${sampleSize})`, font: { size: 16 } },
    },
    scales: {
      x: { title: { display: true, text: chartOptions.xAxisLabel || 'Subgroup' } },
      y: { title: { display: true, text: 'Subgroup Range (R)' } },
    },
  };

  return (
    <div className="space-y-6">
      <div style={{ height: '320px' }}>
        <Line data={xbarData} options={xbarOptions} />
      </div>
      <div style={{ height: '320px' }}>
        <Line data={rData} options={rOptions} />
      </div>
    </div>
  );
};

export default XBarRChart;

