// Simple Node.js script to test rule violation detection
const { detectRuleViolations } = require('./src/utils/westernElectricRules.ts');

// Test data that should trigger violations
console.log('Testing rule violation detection...');

// Create test data with obvious violations
const testControl = {
  ucl: 10,
  lcl: 0,
  centerLine: 5,
  sigma: 1.67  // (10-5)/3
};

// Test data with Rule 1 violation (beyond UCL)
const testData1 = [
  { v: 5 }, { v: 5.5 }, { v: 12 }, { v: 5 }, { v: 4.5 }  // point 3 is beyond UCL
];

console.log('Test 1 - Rule 1 violation:');
console.log('Data:', testData1.map(d => d.v));
console.log('Control limits:', testControl);

try {
  const violations1 = detectRuleViolations(testData1, 'v', testControl);
  console.log('Violations found:', violations1);
} catch (error) {
  console.error('Error:', error);
}

// Test data with multiple consecutive points on same side (Rule 2)
const testData2 = Array(10).fill(0).map((_, i) => ({ v: 6 })); // 10 points above centerline

console.log('\nTest 2 - Rule 2 violation (consecutive points):');
console.log('Data:', testData2.map(d => d.v));

try {
  const violations2 = detectRuleViolations(testData2, 'v', testControl);
  console.log('Violations found:', violations2);
} catch (error) {
  console.error('Error:', error);
}