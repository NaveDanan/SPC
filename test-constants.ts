// Test the effect of sample size on control chart calculations
import { getControlChartConstants } from './src/utils/spcCalculations.ts';

console.log('Testing control chart constants for different sample sizes:');
console.log('');

for (let n = 2; n <= 10; n++) {
  const constants = getControlChartConstants(n);
  console.log(`Sample size ${n}:`);
  console.log(`  a2: ${constants.a2.toFixed(4)}, d2: ${constants.d2.toFixed(4)}, d3: ${constants.d3.toFixed(4)}, d4: ${constants.d4.toFixed(4)}`);
  
  // Example calculation with fixed data
  const rBar = 2.0; // Example average range
  const xBar = 10.0; // Example average
  
  const xbarUCL = xBar + constants.a2 * rBar;
  const xbarLCL = xBar - constants.a2 * rBar;
  const sigmaEstimate = rBar / constants.d2;
  const xbarSigma = sigmaEstimate / Math.sqrt(n);
  
  console.log(`  X-bar UCL: ${xbarUCL.toFixed(4)}, LCL: ${xbarLCL.toFixed(4)}, Sigma: ${xbarSigma.toFixed(4)}`);
  
  const rUCL = constants.d4 * rBar;
  const rLCL = Math.max(0, constants.d3 * rBar);
  
  console.log(`  R UCL: ${rUCL.toFixed(4)}, LCL: ${rLCL.toFixed(4)}`);
  console.log('');
}