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
  const data = processedData.data;
  const { ucl, lcl, centerLine, sigma } = processedData.controlLimits;
  const { ruleViolations } = processedData;
  
  // Create labels for the X axis (can be index or another column)
  const labels = data.map((_, index) => `${index + 1}`);
  
  // Extract data values
  const values = data.map(row => parseFloat(row[selectedColumn]));
  
  // Create point backgrounds with special highlight for violations
  const pointBackgroundColors = values.map((_, index) => {
    // Check if this point has a rule violation
    const hasViolation = ruleViolations.some(v => v.index === index);
    return hasViolation ? 'red' : 'rgba(54, 162, 235, 0.8)';
  });
  
  const chartData = {
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
      // Center line
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
      // Control limits and sigma lines
      ...(chartOptions.showControlLimits ? [
        // +3σ (UCL)
        {
          label: '+3σ (UCL)',
          data: Array(values.length).fill(ucl),
          borderColor: 'rgba(255, 99, 132, 0.8)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        // +2σ
        {
          label: '+2σ',
          data: Array(values.length).fill(centerLine + 2 * sigma),
          borderColor: 'rgba(255, 159, 64, 0.5)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
        // +1σ
        {
          label: '+1σ',
          data: Array(values.length).fill(centerLine + sigma),
          borderColor: 'rgba(255, 205, 86, 0.5)',
          borderDash: [2, 2],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
        // -1σ
        {
          label: '-1σ',
          data: Array(values.length).fill(centerLine - sigma),
          borderColor: 'rgba(255, 205, 86, 0.5)',
          borderDash: [2, 2],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
        // -2σ
        {
          label: '-2σ',
          data: Array(values.length).fill(centerLine - 2 * sigma),
          borderColor: 'rgba(255, 159, 64, 0.5)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
        // -3σ (LCL)
        {
          label: '-3σ (LCL)',
          data: Array(values.length).fill(lcl),
          borderColor: 'rgba(255, 99, 132, 0.8)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
    ],
  };
  
  const chartConfig: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartOptions.title || 'Individual Values Control Chart',
        font: {
          size: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const hasViolation = ruleViolations.some(v => v.index === index);
            
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(2)}`];
            
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
          text: chartOptions.xAxisLabel || 'Sample',
        },
      },
      y: {
        title: {
          display: true,
          text: chartOptions.yAxisLabel || 'Value',
        },
      },
    },
  };
  
  return (
    <div style={{ height: '400px' }}>
      <Line data={chartData} options={chartConfig} />
    </div>
  );
};

export default IndividualChart;