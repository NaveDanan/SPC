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
import { computeXbarSComponents, calculateStandardDeviation, calculateMean, getControlChartConstants } from '../../../utils/spcCalculations';
import { detectRuleViolations } from '../../../utils/westernElectricRules';

const XBarSChart: React.FC = () => {
  const { processedData, selectedColumns, chartOptions, sampleSize } = useAppContext();
  
  if (!processedData || !selectedColumns.length) {
    return <div>No data available</div>;
  }
  
  const selectedColumn = selectedColumns[0];
  const data = processedData.data;
  let subgroupMeans: number[] = [];
  let subgroupStdDevs: number[] = [];
  let xbarLimits = { ucl: 0, lcl: 0, centerLine: 0 };
  let sChartLimits = { ucl: 0, lcl: 0, centerLine: 0 };
  let labels: string[] = [];

  if (selectedColumns.length > 1) {
    // Multi-column per-row subgrouping
    const valueColumns = selectedColumns;
    const groups: number[][] = [];
    data.forEach((row) => {
      const vals = valueColumns.map(h => parseFloat(row[h]));
      if (vals.every(v => !isNaN(v))) {
        const group = vals.slice(0, sampleSize);
        if (group.length === sampleSize) groups.push(group);
      }
    });
    subgroupMeans = groups.map(g => calculateMean(g));
    subgroupStdDevs = groups.map(g => calculateStandardDeviation(g));
    const constants = getControlChartConstants(sampleSize);
    const xbar = calculateMean(subgroupMeans);
    const sbar = calculateMean(subgroupStdDevs);
    xbarLimits = { ucl: xbar + constants.a3 * sbar, lcl: xbar - constants.a3 * sbar, centerLine: xbar };
    sChartLimits = { ucl: constants.b4 * sbar, lcl: Math.max(0, constants.b3 * sbar), centerLine: sbar };
    labels = subgroupMeans.map((_, i) => `${i + 1}`);
  } else {
    const values = data.map(row => parseFloat(row[selectedColumn]));
    const res = computeXbarSComponents(values, sampleSize);
    subgroupMeans = res.subgroupMeans;
    subgroupStdDevs = res.subgroupStdDevs;
    xbarLimits = res.xbarLimits;
    sChartLimits = res.sChartLimits;
    labels = subgroupMeans.map((_, index) => `${index + 1}`);
  }

  const sigmaXbarUp = (xbarLimits.ucl - xbarLimits.centerLine) / 3;
  const sigmaXbarDown = (xbarLimits.centerLine - xbarLimits.lcl) / 3;
  // Compute rule violations on X-bar series
  const xbarControl = { ucl: xbarLimits.ucl, lcl: xbarLimits.lcl, centerLine: xbarLimits.centerLine, sigma: Math.max(sigmaXbarUp, sigmaXbarDown) } as any;
  const seriesPoints = subgroupMeans.map(v => ({ v }));
  const violations = detectRuleViolations(seriesPoints as any, 'v', xbarControl);
  const defaultXbarPointColor = 'rgba(54, 162, 235, 0.9)';
  const xbarPointColors = subgroupMeans.map((_, i) => {
    if (!chartOptions.showRuleViolations) return defaultXbarPointColor;
    return violations.some(v => v.index === i) ? 'red' : defaultXbarPointColor;
  });

  const xbarData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Mean (X-bar)',
        data: subgroupMeans,
        borderColor: 'rgba(54, 162, 235, 0.9)',
        backgroundColor: xbarPointColors,
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
      ...(chartOptions.showSigma1 ? [
        { label: '+1σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine + sigmaXbarUp), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-1σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine - sigmaXbarDown), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        { label: '+2σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine + 2*sigmaXbarUp), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-2σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine - 2*sigmaXbarDown), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...((chartOptions.showControlLimits || chartOptions.showSigma3) ? [
        { label: 'UCL', data: Array(subgroupMeans.length).fill(xbarLimits.ucl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'LCL', data: Array(subgroupMeans.length).fill(xbarLimits.lcl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
      ] : []),
    ],
  };

  const sSigmaUp = (sChartLimits.ucl - sChartLimits.centerLine) / 3;
  const sSigmaDown = (sChartLimits.centerLine - sChartLimits.lcl) / 3;
  const sData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Std Dev (S)',
        data: subgroupStdDevs,
        borderColor: 'rgba(153, 102, 255, 0.9)',
        backgroundColor: subgroupStdDevs.map(v => {
          if (!chartOptions.showRuleViolations) return 'rgba(153, 102, 255, 0.9)';
          return (v > sChartLimits.ucl || v < sChartLimits.lcl) ? 'red' : 'rgba(153, 102, 255, 0.9)';
        }),
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      },
      ...(chartOptions.showCenterLine ? [
        {
          label: 'Center Line (S̄)',
          data: Array(subgroupStdDevs.length).fill(sChartLimits.centerLine),
          borderColor: 'rgba(75, 192, 192, 0.9)',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ] : []),
      ...(chartOptions.showSigma1 ? [
        { label: '+1σ', data: Array(subgroupStdDevs.length).fill(sChartLimits.centerLine + sSigmaUp), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-1σ', data: Array(subgroupStdDevs.length).fill(sChartLimits.centerLine - sSigmaDown), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        { label: '+2σ', data: Array(subgroupStdDevs.length).fill(sChartLimits.centerLine + 2*sSigmaUp), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-2σ', data: Array(subgroupStdDevs.length).fill(sChartLimits.centerLine - 2*sSigmaDown), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...((chartOptions.showControlLimits || chartOptions.showSigma3) ? [
        { label: 'UCL (S)', data: Array(subgroupStdDevs.length).fill(sChartLimits.ucl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'LCL (S)', data: Array(subgroupStdDevs.length).fill(sChartLimits.lcl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
      ] : []),
    ],
  };

  const xbarOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartOptions.title || `X-bar Chart (n=${sampleSize})`,
        font: {
          size: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(3)}`];
            if (chartOptions.showRuleViolations && context.dataset.label?.toString().includes('X-bar')) {
              const hit = violations.filter(v => v.index === index);
              hit.forEach(v => labels.push(`Rule ${v.ruleNumber}: ${v.description}`));
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
          text: chartOptions.yAxisLabel || 'Subgroup Mean (X̄)',
        },
      },
    },
  };

  const sOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: `S Chart (n=${sampleSize})`,
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(3)}`];
            if (chartOptions.showRuleViolations && context.dataset.label?.toString().includes('(S)')) {
              const val = subgroupStdDevs[index];
              if (val > sChartLimits.ucl) labels.push('Above UCL');
              else if (val < sChartLimits.lcl) labels.push('Below LCL');
            }
            return labels;
          }
        }
      }
    },
    scales: {
      x: { title: { display: true, text: chartOptions.xAxisLabel || 'Subgroup' } },
      y: { title: { display: true, text: 'Subgroup Std Dev (S)' } },
    },
  };

  return (
    <div className="space-y-6">
      <div style={{ height: '320px' }}>
        <Line data={xbarData} options={xbarOptions} />
      </div>
      <div style={{ height: '320px' }}>
        <Line data={sData} options={sOptions} />
      </div>
    </div>
  );
};

export default XBarSChart;
