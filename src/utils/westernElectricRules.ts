import { ControlLimits, DataPoint, RuleViolation } from '../types/DataTypes';

// Western Electric Rules for detecting special cause variation
export const detectRuleViolations = (
  data: DataPoint[],
  column: string,
  controlLimits: ControlLimits
): RuleViolation[] => {
  const violations: RuleViolation[] = [];
  const values = data.map(row => parseFloat(row[column]));
  const { ucl, lcl, centerLine, sigma } = controlLimits;
  
  // Rule 1: Any point beyond the control limits (> UCL or < LCL)
  for (let i = 0; i < values.length; i++) {
    if (values[i] > ucl) {
      violations.push({
        index: i,
        pointValue: values[i],
        ruleNumber: 1,
        description: 'Point beyond Upper Control Limit (UCL)'
      });
    } else if (values[i] < lcl) {
      violations.push({
        index: i,
        pointValue: values[i],
        ruleNumber: 1,
        description: 'Point beyond Lower Control Limit (LCL)'
      });
    }
  }
  
  // Rule 2: 9 consecutive points on the same side of the center line
  const checkConsecutiveOneSide = (startIndex: number) => {
    if (startIndex + 8 >= values.length) return false;
    
    const initialSide = values[startIndex] > centerLine;
    for (let i = startIndex + 1; i < startIndex + 9; i++) {
      const currentSide = values[i] > centerLine;
      if (currentSide !== initialSide) return false;
    }
    return true;
  };
  
  for (let i = 0; i < values.length - 8; i++) {
    if (checkConsecutiveOneSide(i)) {
      const side = values[i] > centerLine ? 'above' : 'below';
      for (let j = i; j < i + 9; j++) {
        violations.push({
          index: j,
          pointValue: values[j],
          ruleNumber: 2,
          description: `Part of 9 consecutive points ${side} the center line`
        });
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
      if (values[i] >= values[i + 1]) increasing = false;
      if (values[i] <= values[i + 1]) decreasing = false;
    }
    
    return increasing || decreasing;
  };
  
  for (let i = 0; i < values.length - 5; i++) {
    if (checkConsecutiveTrend(i)) {
      const trend = values[i] < values[i + 1] ? 'increasing' : 'decreasing';
      for (let j = i; j < i + 6; j++) {
        violations.push({
          index: j,
          pointValue: values[j],
          ruleNumber: 3,
          description: `Part of 6 consecutive points ${trend}`
        });
      }
      // Skip ahead
      i += 5;
    }
  }
  
  // Rule 4: 14 consecutive points alternating up and down
  const checkAlternating = (startIndex: number) => {
    if (startIndex + 13 >= values.length) return false;
    
    let alternating = true;
    for (let i = startIndex; i < startIndex + 13; i++) {
      if ((values[i] < values[i + 1] && values[i + 1] < values[i + 2]) || 
          (values[i] > values[i + 1] && values[i + 1] > values[i + 2])) {
        alternating = false;
        break;
      }
    }
    
    return alternating;
  };
  
  for (let i = 0; i < values.length - 13; i++) {
    if (checkAlternating(i)) {
      for (let j = i; j < i + 14; j++) {
        violations.push({
          index: j,
          pointValue: values[j],
          ruleNumber: 4,
          description: 'Part of 14 consecutive points alternating up and down'
        });
      }
      // Skip ahead
      i += 13;
    }
  }
  
  // Rule 5: 2 out of 3 consecutive points beyond 2 sigma on the same side
  const check2of3Beyond2Sigma = (startIndex: number) => {
    if (startIndex + 2 >= values.length) return false;
    
    const upperTwoSigma = centerLine + 2 * sigma;
    const lowerTwoSigma = centerLine - 2 * sigma;
    
    let countAbove = 0;
    let countBelow = 0;
    
    for (let i = startIndex; i < startIndex + 3; i++) {
      if (values[i] > upperTwoSigma) countAbove++;
      if (values[i] < lowerTwoSigma) countBelow++;
    }
    
    return countAbove >= 2 || countBelow >= 2;
  };
  
  for (let i = 0; i < values.length - 2; i++) {
    if (check2of3Beyond2Sigma(i)) {
      const above = values[i] > centerLine + 2 * sigma;
      const zone = above ? 'above +2σ' : 'below -2σ';
      
      for (let j = i; j < i + 3; j++) {
        const beyond2Sigma = above 
          ? values[j] > centerLine + 2 * sigma 
          : values[j] < centerLine - 2 * sigma;
          
        if (beyond2Sigma) {
          violations.push({
            index: j,
            pointValue: values[j],
            ruleNumber: 5,
            description: `Part of 2 out of 3 consecutive points ${zone}`
          });
        }
      }
      
      // Skip ahead
      i += 2;
    }
  }
  
  // Rule 6: 4 out of 5 consecutive points beyond 1 sigma on the same side
  const check4of5Beyond1Sigma = (startIndex: number) => {
    if (startIndex + 4 >= values.length) return false;
    
    const upperOneSigma = centerLine + sigma;
    const lowerOneSigma = centerLine - sigma;
    
    let countAbove = 0;
    let countBelow = 0;
    
    for (let i = startIndex; i < startIndex + 5; i++) {
      if (values[i] > upperOneSigma) countAbove++;
      if (values[i] < lowerOneSigma) countBelow++;
    }
    
    return countAbove >= 4 || countBelow >= 4;
  };
  
  for (let i = 0; i < values.length - 4; i++) {
    if (check4of5Beyond1Sigma(i)) {
      const above = values[i] > centerLine + sigma;
      const zone = above ? 'above +1σ' : 'below -1σ';
      
      for (let j = i; j < i + 5; j++) {
        const beyond1Sigma = above 
          ? values[j] > centerLine + sigma 
          : values[j] < centerLine - sigma;
          
        if (beyond1Sigma) {
          violations.push({
            index: j,
            pointValue: values[j],
            ruleNumber: 6,
            description: `Part of 4 out of 5 consecutive points ${zone}`
          });
        }
      }
      
      // Skip ahead
      i += 4;
    }
  }
  
  // Rule 7: 15 consecutive points within 1 sigma
  const check15WithinOneSigma = (startIndex: number) => {
    if (startIndex + 14 >= values.length) return false;
    
    const upperOneSigma = centerLine + sigma;
    const lowerOneSigma = centerLine - sigma;
    
    for (let i = startIndex; i < startIndex + 15; i++) {
      if (values[i] > upperOneSigma || values[i] < lowerOneSigma) {
        return false;
      }
    }
    
    return true;
  };
  
  for (let i = 0; i < values.length - 14; i++) {
    if (check15WithinOneSigma(i)) {
      for (let j = i; j < i + 15; j++) {
        violations.push({
          index: j,
          pointValue: values[j],
          ruleNumber: 7,
          description: 'Part of 15 consecutive points within 1σ (process too consistent)'
        });
      }
      // Skip ahead
      i += 14;
    }
  }
  
  // Rule 8: 8 consecutive points beyond 1 sigma on either side
  const check8BeyondOneSigma = (startIndex: number) => {
    if (startIndex + 7 >= values.length) return false;
    
    const upperOneSigma = centerLine + sigma;
    const lowerOneSigma = centerLine - sigma;
    
    for (let i = startIndex; i < startIndex + 8; i++) {
      if (values[i] <= upperOneSigma && values[i] >= lowerOneSigma) {
        return false;
      }
    }
    
    return true;
  };
  
  for (let i = 0; i < values.length - 7; i++) {
    if (check8BeyondOneSigma(i)) {
      for (let j = i; j < i + 8; j++) {
        violations.push({
          index: j,
          pointValue: values[j],
          ruleNumber: 8,
          description: 'Part of 8 consecutive points beyond 1σ on either side'
        });
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