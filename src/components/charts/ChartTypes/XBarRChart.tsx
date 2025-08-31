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
import { computeXbarRComponents, calculateMean, getControlChartConstants } from '../../../utils/spcCalculations';
import { detectRuleViolations } from '../../../utils/westernElectricRules';

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
  let subgroupMeans: number[] = [];
  let subgroupRanges: number[] = [];
  let xbarLimits = { ucl: 0, lcl: 0, centerLine: 0 } as { ucl: number; lcl: number; centerLine: number };
  let rChartLimits = { ucl: 0, lcl: 0, centerLine: 0 } as { ucl: number; lcl: number; centerLine: number };
  let labels: string[] = [];

  if (selectedColumns.length > 1) {
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
    subgroupRanges = groups.map(g => Math.max(...g) - Math.min(...g));
    const constants = getControlChartConstants(sampleSize);
    const xbar = calculateMean(subgroupMeans);
    const rbar = calculateMean(subgroupRanges);
    xbarLimits = { ucl: xbar + constants.a2 * rbar, lcl: xbar - constants.a2 * rbar, centerLine: xbar };
    rChartLimits = { ucl: constants.d4 * rbar, lcl: Math.max(0, constants.d3 * rbar), centerLine: rbar };
    labels = subgroupMeans.map((_, i) => `${i + 1}`);
  } else {
    const values = data.map(row => parseFloat(row[selectedColumn]));
    const res = computeXbarRComponents(values, sampleSize);
    subgroupMeans = res.subgroupMeans;
    subgroupRanges = res.subgroupRanges;
    xbarLimits = res.xbarLimits;
    rChartLimits = res.rChartLimits;
    labels = subgroupMeans.map((_, index) => `${index + 1}`);
  }

  const sigmaXbarUp = (xbarLimits.ucl - xbarLimits.centerLine) / 3;
  const sigmaXbarDown = (xbarLimits.centerLine - xbarLimits.lcl) / 3;
  const xbarControl = { ucl: xbarLimits.ucl, lcl: xbarLimits.lcl, centerLine: xbarLimits.centerLine, sigma: Math.max(sigmaXbarUp, sigmaXbarDown) } as any;
  const seriesPoints = subgroupMeans.map(v => ({ v }));
  const violations = detectRuleViolations(seriesPoints as any, 'v', xbarControl);
  const defaultXbarColor = 'rgba(54, 162, 235, 0.9)';
  const xbarPointColors = subgroupMeans.map((_, i) => {
    if (!chartOptions.showRuleViolations) return defaultXbarColor;
    return violations.some(v => v.index === i) ? 'red' : defaultXbarColor;
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

  const rSigmaUp = (rChartLimits.ucl - rChartLimits.centerLine) / 3;
  const rSigmaDown = (rChartLimits.centerLine - rChartLimits.lcl) / 3;
  const rData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Range (R)',
        data: subgroupRanges,
        borderColor: 'rgba(255, 159, 64, 0.9)',
        backgroundColor: subgroupRanges.map(v => {
          if (!chartOptions.showRuleViolations) return 'rgba(255, 159, 64, 0.9)';
          return (v > rChartLimits.ucl || v < rChartLimits.lcl) ? 'red' : 'rgba(255, 159, 64, 0.9)';
        }),
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
      ...(chartOptions.showSigma1 ? [
        { label: '+1σ', data: Array(subgroupRanges.length).fill(rChartLimits.centerLine + rSigmaUp), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-1σ', data: Array(subgroupRanges.length).fill(rChartLimits.centerLine - rSigmaDown), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        { label: '+2σ', data: Array(subgroupRanges.length).fill(rChartLimits.centerLine + 2*rSigmaUp), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-2σ', data: Array(subgroupRanges.length).fill(rChartLimits.centerLine - 2*rSigmaDown), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...((chartOptions.showControlLimits || chartOptions.showSigma3) ? [
        { label: 'UCL (R)', data: Array(subgroupRanges.length).fill(rChartLimits.ucl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'LCL (R)', data: Array(subgroupRanges.length).fill(rChartLimits.lcl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
      ] : []),
    ],
  };

  const xbarOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: chartOptions.title || `X-bar Chart (n=${sampleSize})`, font: { size: 16 } },
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
      tooltip: {
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const labels = [`${context.dataset.label}: ${context.parsed.y.toFixed(3)}`];
            if (chartOptions.showRuleViolations && context.dataset.label?.toString().includes('(R)')) {
              const val = subgroupRanges[index];
              if (val > rChartLimits.ucl) labels.push('Above UCL');
              else if (val < rChartLimits.lcl) labels.push('Below LCL');
            }
            return labels;
          }
        }
      }
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
