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

  // Calculate sigma for X-bar chart (using proper range method)
  const constants = getControlChartConstants(sampleSize);
  const rBar = calculateMean(subgroupRanges);
  const sigmaEstimate = rBar / constants.d2; // Correct sigma estimation from range
  
  const xbarControl = { 
    ucl: xbarLimits.ucl, 
    lcl: xbarLimits.lcl, 
    centerLine: xbarLimits.centerLine, 
    sigma: sigmaEstimate / Math.sqrt(sampleSize) // Standard error of the mean
  };
  
  // Detect rule violations for X-bar chart
  const xbarSeriesPoints = subgroupMeans.map(v => ({ v }));
  const xbarViolations = detectRuleViolations(xbarSeriesPoints as any, 'v', xbarControl);
  
  // Calculate sigma for R chart (R charts don't follow normal distribution)
  // The standard approach for R charts is to use the control chart constants
  // For Western Electric rules on R charts, we need to approximate the sigma
  // Since R charts are based on range distribution, not normal distribution
  let rSigmaEstimate: number;
  if (constants.d3 > 0) {
    // For larger sample sizes where d3 > 0, we can estimate sigma
    rSigmaEstimate = (rChartLimits.ucl - rChartLimits.centerLine) / 3;
  } else {
    // For small sample sizes (n=2,3,4,5,6) where d3 = 0 (LCL = 0)
    // We use the relationship with the mean range
    rSigmaEstimate = rChartLimits.centerLine / 3; // Simple approximation
  }
  
  const rControl = {
    ucl: rChartLimits.ucl,
    lcl: rChartLimits.lcl,
    centerLine: rChartLimits.centerLine,
    sigma: rSigmaEstimate
  };
  
  // Detect rule violations for R chart
  const rSeriesPoints = subgroupRanges.map(v => ({ v }));
  const rViolations = detectRuleViolations(rSeriesPoints as any, 'v', rControl);
  
  // Enhanced debug logging
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[XBarRChart] Sample size: ${sampleSize}`);
    console.debug(`[XBarRChart] Constants:`, constants);
    console.debug(`[XBarRChart] R̄: ${rBar.toFixed(4)}, Sigma estimate: ${sigmaEstimate.toFixed(4)}`);
    console.debug(`[XBarRChart] X-bar control limits:`, xbarControl);
    console.debug(`[XBarRChart] R control limits:`, rControl);
    console.debug(`[XBarRChart] Subgroup means sample:`, subgroupMeans.slice(0, 5));
    console.debug(`[XBarRChart] Subgroup ranges sample:`, subgroupRanges.slice(0, 5));
    console.debug(`[XBarRChart] X-bar violations:`, xbarViolations);
    console.debug(`[XBarRChart] R chart violations:`, rViolations);
    
    // Test specific points against limits
    console.debug(`[XBarRChart] Testing first 5 X-bar points:`);
    subgroupMeans.slice(0, 5).forEach((mean, i) => {
      console.debug(`  Point ${i}: ${mean.toFixed(4)} (UCL: ${xbarControl.ucl.toFixed(4)}, LCL: ${xbarControl.lcl.toFixed(4)})`);
    });
    
    console.debug(`[XBarRChart] Testing first 5 R points:`);
    subgroupRanges.slice(0, 5).forEach((range, i) => {
      console.debug(`  Point ${i}: ${range.toFixed(4)} (UCL: ${rControl.ucl.toFixed(4)}, LCL: ${rControl.lcl.toFixed(4)})`);
    });
  }
  
  const defaultXbarColor = 'rgba(54, 162, 235, 0.9)';
  const xbarPointColors = subgroupMeans.map((_, i) => {
    if (!chartOptions.showRuleViolations) return defaultXbarColor;
    return xbarViolations.some(v => v.index === i) ? 'red' : defaultXbarColor;
  });

  const xbarData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Mean (X-bar)',
        data: subgroupMeans,
        borderColor: 'rgba(54, 162, 235, 0.9)',
        backgroundColor: xbarPointColors,
        pointBackgroundColor: xbarPointColors,
        // Provide a matching border color array so red points stand out even if fill not obvious
        pointBorderColor: xbarPointColors,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      },
      // Overlay dataset to ensure violations are unmistakably visible (larger solid red points)
      ...(chartOptions.showRuleViolations ? [
        {
          label: 'Rule Violations',
          data: subgroupMeans.map((v, i) => (xbarViolations.some((x: any) => x.index === i) ? v : null)),
          borderColor: 'red',
          backgroundColor: 'red',
          pointBackgroundColor: 'red',
          pointBorderColor: 'red',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
          // spanGaps keeps individual points without connecting nulls
          spanGaps: true as any,
        }
      ] : []),
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
        { label: '+1σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine + xbarControl.sigma), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-1σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine - xbarControl.sigma), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        { label: '+2σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine + 2*xbarControl.sigma), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-2σ', data: Array(subgroupMeans.length).fill(xbarLimits.centerLine - 2*xbarControl.sigma), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...((chartOptions.showControlLimits || chartOptions.showSigma3) ? [
        { label: 'UCL', data: Array(subgroupMeans.length).fill(xbarLimits.ucl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'LCL', data: Array(subgroupMeans.length).fill(xbarLimits.lcl), borderColor: 'rgba(255,99,132,0.9)', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false },
      ] : []),
    ],
  };

  const defaultRColor = 'rgba(255, 159, 64, 0.9)';
  const rPointColors = subgroupRanges.map((_, i) => {
    if (!chartOptions.showRuleViolations) return defaultRColor;
    return rViolations.some(v => v.index === i) ? 'red' : defaultRColor;
  });

  const rData = {
    labels,
    datasets: [
      {
        label: 'Subgroup Range (R)',
        data: subgroupRanges,
        borderColor: 'rgba(255, 159, 64, 0.9)',
        backgroundColor: rPointColors,
        pointBackgroundColor: rPointColors,
        pointBorderColor: rPointColors,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      },
      // Overlay dataset for R chart rule violations
      ...(chartOptions.showRuleViolations ? [
        {
          label: 'Rule Violations (R)',
          data: subgroupRanges.map((v, i) => (rViolations.some((x: any) => x.index === i) ? v : null)),
          borderColor: 'red',
          backgroundColor: 'red',
          pointBackgroundColor: 'red',
          pointBorderColor: 'red',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
          spanGaps: true as any,
        }
      ] : []),
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
        { label: '+1σ', data: Array(subgroupRanges.length).fill(rControl.centerLine + rControl.sigma), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-1σ', data: Array(subgroupRanges.length).fill(Math.max(0, rControl.centerLine - rControl.sigma)), borderColor: 'rgba(255,205,86,0.6)', borderDash: [2,2], borderWidth: 1, pointRadius: 0, fill: false },
      ] : []),
      ...(chartOptions.showSigma2 ? [
        { label: '+2σ', data: Array(subgroupRanges.length).fill(rControl.centerLine + 2*rControl.sigma), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
        { label: '-2σ', data: Array(subgroupRanges.length).fill(Math.max(0, rControl.centerLine - 2*rControl.sigma)), borderColor: 'rgba(255,159,64,0.6)', borderDash: [3,3], borderWidth: 1, pointRadius: 0, fill: false },
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
              const hit = xbarViolations.filter((v: any) => v.index === index);
              hit.forEach((v: any) => labels.push(`Rule ${v.ruleNumber}: ${v.description}`));
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
              const hit = rViolations.filter((v: any) => v.index === index);
              hit.forEach((v: any) => labels.push(`Rule ${v.ruleNumber}: ${v.description}`));
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
