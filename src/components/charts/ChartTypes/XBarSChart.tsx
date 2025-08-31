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

const XBarSChart: React.FC = () => {
  const { processedData, selectedColumns, chartOptions, sampleSize } = useAppContext();
  
  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }
  
  const selectedColumn = selectedColumns[0];
  const data = processedData.data;
  const { ucl, lcl, centerLine } = processedData.controlLimits;
  const { ruleViolations } = processedData;
  
  // Group data into subgroups for X-bar S chart
  const subgroups: number[][] = [];
  const values = data.map(row => parseFloat(row[selectedColumn]));
  
  for (let i = 0; i < values.length; i += sampleSize) {
    const subgroup = values.slice(i, i + sampleSize);
    if (subgroup.length === sampleSize) {  // Only use complete subgroups
      subgroups.push(subgroup);
    }
  }
  
  // Calculate means for each subgroup
  const subgroupMeans = subgroups.map(group => {
    return group.reduce((sum, val) => sum + val, 0) / group.length;
  });
  
  // Create labels for the X axis
  const labels = subgroupMeans.map((_, index) => `${index + 1}`);
  
  // Create point backgrounds with special highlight for violations
  const pointBackgroundColors = subgroupMeans.map((_, index) => {
    // Check if this point has a rule violation
    const hasViolation = ruleViolations.some(v => v.index === index);
    return hasViolation ? 'red' : 'rgba(54, 162, 235, 0.8)';
  });
  
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Mean',
        data: subgroupMeans,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        backgroundColor: pointBackgroundColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
      },
      // Center line
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line',
          data: Array(subgroupMeans.length).fill(centerLine),
          borderColor: 'rgba(75, 192, 192, 0.8)',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
      // Control limits
      ...(chartOptions.showControlLimits ? [
        {
          label: 'UCL',
          data: Array(subgroupMeans.length).fill(ucl),
          borderColor: 'rgba(255, 99, 132, 0.8)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'LCL',
          data: Array(subgroupMeans.length).fill(lcl),
          borderColor: 'rgba(255, 99, 132, 0.8)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
    ],
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
        text: chartOptions.title || `X-bar S Chart (n=${sampleSize})`,
        font: {
          size: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const hasViolation = ruleViolations.some(v => v.index === index);
            
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(3)}`];
            
            if (hasViolation) {
              const violations = ruleViolations.filter(v => v.index === index);
              violations.forEach(v => {
                labels.push(`Rule ${v.ruleNumber} violation: ${v.description}`);
              });
            }
            
            return labels;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: chartOptions.xAxisLabel || 'Subgroup',
        },
      },
      y: {
        title: {
          display: true,
          text: chartOptions.yAxisLabel || 'Subgroup Mean',
        },
      },
    },
  };
  
  return (
    <div style={{ height: '400px' }}>
      <Line data={chartData} options={chartOptions1} />
    </div>
  );
};

export default XBarSChart;