import { ControlLimits, DataPoint, RuleViolation } from '../types/DataTypes';

// Western Electric Rules for detecting special cause variation
export const detectRuleViolations = (
  data: DataPoint[],
  column: string,
  controlLimits: ControlLimits
): RuleViolation[] => {
  const violations: RuleViolation[] = [];
  const values = data.map((row) => {
    const parsed = parseFloat(String(row[column]));
    return Number.isFinite(parsed) ? parsed : null;
  });
  const { ucl, lcl, centerLine, sigma } = controlLimits;

  const valueAt = (index: number): number | null => values[index] ?? null;
  const sigmaAt = (index: number): number => {
    const pointSigma = controlLimits.sigmaSeries?.[index];
    return Number.isFinite(pointSigma) && pointSigma > 0 ? pointSigma : sigma;
  };
  const uclAt = (index: number): number => {
    const pointUcl = controlLimits.uclSeries?.[index];
    return Number.isFinite(pointUcl) ? pointUcl : ucl;
  };
  const lclAt = (index: number): number => {
    const pointLcl = controlLimits.lclSeries?.[index];
    return Number.isFinite(pointLcl) ? pointLcl : lcl;
  };
  const pushViolation = (index: number, ruleNumber: number, description: string) => {
    const pointValue = valueAt(index);
    if (pointValue === null) {
      return;
    }
    violations.push({ index, pointValue, ruleNumber, description });
  };
  
  // Rule 1: Any point beyond the control limits (> UCL or < LCL)
  for (let i = 0; i < values.length; i++) {
    const value = valueAt(i);
    if (value === null) {
      continue;
    }
    if (value > uclAt(i)) {
      pushViolation(i, 1, 'Point beyond Upper Control Limit (UCL)');
    } else if (value < lclAt(i)) {
      pushViolation(i, 1, 'Point beyond Lower Control Limit (LCL)');
    }
  }
  
  // Rule 2: 9 consecutive points on the same side of the center line
  const checkConsecutiveOneSide = (startIndex: number) => {
    if (startIndex + 8 >= values.length) return false;
    
    const firstValue = valueAt(startIndex);
    if (firstValue === null || firstValue === centerLine) return false;
    const initialSide = firstValue > centerLine;
    for (let i = startIndex + 1; i < startIndex + 9; i++) {
      const currentValue = valueAt(i);
      if (currentValue === null || currentValue === centerLine) return false;
      const currentSide = currentValue > centerLine;
      if (currentSide !== initialSide) return false;
    }
    return true;
  };
  
  for (let i = 0; i < values.length - 8; i++) {
    if (checkConsecutiveOneSide(i)) {
      const side = (valueAt(i) ?? centerLine) > centerLine ? 'above' : 'below';
      for (let j = i; j < i + 9; j++) {
        pushViolation(j, 2, `Part of 9 consecutive points ${side} the center line`);
      }
      // Skip ahead to avoid detecting the same pattern multiple times
      i += 8;
    }
  }
  
  // Rule 3: 6 consecutive points all increasing or all decreasing
  const checkConsecutiveTrend = (startIndex: number) => {
    if (startIndex + 5 >= values.length) return false;
    
    let increasing = true;
    let decreasing = true;
    
    for (let i = startIndex; i < startIndex + 5; i++) {
      const current = valueAt(i);
      const next = valueAt(i + 1);
      if (current === null || next === null) return false;
      if (current >= next) increasing = false;
      if (current <= next) decreasing = false;
    }
    
    return increasing || decreasing;
  };
  
  for (let i = 0; i < values.length - 5; i++) {
    if (checkConsecutiveTrend(i)) {
      const trend = (valueAt(i) ?? 0) < (valueAt(i + 1) ?? 0) ? 'increasing' : 'decreasing';
      for (let j = i; j < i + 6; j++) {
        pushViolation(j, 3, `Part of 6 consecutive points ${trend}`);
      }
      // Skip ahead
      i += 5;
    }
  }
  
  // Rule 4: 14 consecutive points alternating up and down
  const checkAlternating = (startIndex: number) => {
    if (startIndex + 13 >= values.length) return false;
    
    let alternating = true;
    for (let i = startIndex; i < startIndex + 12; i++) {
      const a = valueAt(i);
      const b = valueAt(i + 1);
      const c = valueAt(i + 2);
      if (a === null || b === null || c === null || a === b || b === c) return false;
      if ((a < b && b < c) || (a > b && b > c)) {
        alternating = false;
        break;
      }
    }
    
    return alternating;
  };
  
  for (let i = 0; i < values.length - 13; i++) {
    if (checkAlternating(i)) {
      for (let j = i; j < i + 14; j++) {
        pushViolation(j, 4, 'Part of 14 consecutive points alternating up and down');
      }
      // Skip ahead
      i += 13;
    }
  }
  
  // Rule 5: 2 out of 3 consecutive points beyond 2 sigma on the same side
  const check2of3Beyond2Sigma = (startIndex: number) => {
    if (startIndex + 2 >= values.length) return false;
    
    let countAbove = 0;
    let countBelow = 0;
    
    for (let i = startIndex; i < startIndex + 3; i++) {
      const value = valueAt(i);
      const pointSigma = sigmaAt(i);
      if (value === null || !Number.isFinite(pointSigma) || pointSigma <= 0) return false;
      if (value > centerLine + 2 * pointSigma) countAbove++;
      if (value < centerLine - 2 * pointSigma) countBelow++;
    }
    
    return countAbove >= 2 || countBelow >= 2;
  };
  
  for (let i = 0; i < values.length - 2; i++) {
    if (check2of3Beyond2Sigma(i)) {
      let aboveCount = 0;
      let belowCount = 0;
      for (let j = i; j < i + 3; j++) {
        const value = valueAt(j);
        const pointSigma = sigmaAt(j);
        if (value !== null && value > centerLine + 2 * pointSigma) aboveCount++;
        if (value !== null && value < centerLine - 2 * pointSigma) belowCount++;
      }
      const above = aboveCount >= belowCount;
      const zone = above ? 'above +2σ' : 'below -2σ';
      
      for (let j = i; j < i + 3; j++) {
        const value = valueAt(j);
        const pointSigma = sigmaAt(j);
        if (value === null) continue;
        const beyond2Sigma = above 
          ? value > centerLine + 2 * pointSigma 
          : value < centerLine - 2 * pointSigma;
          
        if (beyond2Sigma) {
          pushViolation(j, 5, `Part of 2 out of 3 consecutive points ${zone}`);
        }
      }
      
      // Skip ahead
      i += 2;
    }
  }
  
  // Rule 6: 4 out of 5 consecutive points beyond 1 sigma on the same side
  const check4of5Beyond1Sigma = (startIndex: number) => {
    if (startIndex + 4 >= values.length) return false;
    
    let countAbove = 0;
    let countBelow = 0;
    
    for (let i = startIndex; i < startIndex + 5; i++) {
      const value = valueAt(i);
      const pointSigma = sigmaAt(i);
      if (value === null || !Number.isFinite(pointSigma) || pointSigma <= 0) return false;
      if (value > centerLine + pointSigma) countAbove++;
      if (value < centerLine - pointSigma) countBelow++;
    }
    
    return countAbove >= 4 || countBelow >= 4;
  };
  
  for (let i = 0; i < values.length - 4; i++) {
    if (check4of5Beyond1Sigma(i)) {
      let aboveCount = 0;
      let belowCount = 0;
      for (let j = i; j < i + 5; j++) {
        const value = valueAt(j);
        const pointSigma = sigmaAt(j);
        if (value !== null && value > centerLine + pointSigma) aboveCount++;
        if (value !== null && value < centerLine - pointSigma) belowCount++;
      }
      const above = aboveCount >= belowCount;
      const zone = above ? 'above +1σ' : 'below -1σ';
      
      for (let j = i; j < i + 5; j++) {
        const value = valueAt(j);
        const pointSigma = sigmaAt(j);
        if (value === null) continue;
        const beyond1Sigma = above 
          ? value > centerLine + pointSigma 
          : value < centerLine - pointSigma;
          
        if (beyond1Sigma) {
          pushViolation(j, 6, `Part of 4 out of 5 consecutive points ${zone}`);
        }
      }
      
      // Skip ahead
      i += 4;
    }
  }
  
  // Rule 7: 15 consecutive points within 1 sigma
  const check15WithinOneSigma = (startIndex: number) => {
    if (startIndex + 14 >= values.length) return false;
    
    for (let i = startIndex; i < startIndex + 15; i++) {
      const value = valueAt(i);
      const pointSigma = sigmaAt(i);
      if (value === null || value > centerLine + pointSigma || value < centerLine - pointSigma) {
        return false;
      }
    }
    
    return true;
  };
  
  for (let i = 0; i < values.length - 14; i++) {
    if (check15WithinOneSigma(i)) {
      for (let j = i; j < i + 15; j++) {
        pushViolation(j, 7, 'Part of 15 consecutive points within 1σ (process too consistent)');
      }
      // Skip ahead
      i += 14;
    }
  }
  
  // Rule 8: 8 consecutive points beyond 1 sigma on either side
  const check8BeyondOneSigma = (startIndex: number) => {
    if (startIndex + 7 >= values.length) return false;
    
    for (let i = startIndex; i < startIndex + 8; i++) {
      const value = valueAt(i);
      const pointSigma = sigmaAt(i);
      if (value === null || (value <= centerLine + pointSigma && value >= centerLine - pointSigma)) {
        return false;
      }
    }
    
    return true;
  };
  
  for (let i = 0; i < values.length - 7; i++) {
    if (check8BeyondOneSigma(i)) {
      for (let j = i; j < i + 8; j++) {
        pushViolation(j, 8, 'Part of 8 consecutive points beyond 1σ on either side');
      }
      // Skip ahead
      i += 7;
    }
  }
  
  return violations;
};

// Get description of Western Electric Rules
export const getWesternElectricRulesDescription = (): { ruleNumber: number; description: string }[] => {
  return [
    { ruleNumber: 1, description: 'One or more points beyond 3σ from the centerline' },
    { ruleNumber: 2, description: '9 consecutive points on the same side of the centerline' },
    { ruleNumber: 3, description: '6 consecutive points all increasing or all decreasing' },
    { ruleNumber: 4, description: '14 consecutive points alternating up and down' },
    { ruleNumber: 5, description: '2 out of 3 consecutive points beyond 2σ on the same side' },
    { ruleNumber: 6, description: '4 out of 5 consecutive points beyond 1σ on the same side' },
    { ruleNumber: 7, description: '15 consecutive points within 1σ (indicates too little variation)' },
    { ruleNumber: 8, description: '8 consecutive points beyond 1σ on either side of the centerline' }
  ];
};
