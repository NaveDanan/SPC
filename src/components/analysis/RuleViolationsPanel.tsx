import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getWesternElectricRulesDescription } from '../../utils/westernElectricRules';

const RuleViolationsPanel: React.FC = () => {
  const { processedData } = useAppContext();
  
  // Get rule descriptions
  const rules = getWesternElectricRulesDescription();
  
  if (!processedData) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">Process Analysis</h3>
        <p className="text-gray-500">Upload and process data to view analysis</p>
      </div>
    );
  }
  
  const { ruleViolations, controlLimits } = processedData;
  
  // Group violations by rule number
  const violationsByRule = ruleViolations.reduce((acc, violation) => {
    const { ruleNumber } = violation;
    if (!acc[ruleNumber]) {
      acc[ruleNumber] = [];
    }
    acc[ruleNumber].push(violation);
    return acc;
  }, {} as Record<number, typeof ruleViolations>);
  
  // Count violations by rule
  const violationCounts = Object.entries(violationsByRule).map(([ruleNumber, violations]) => ({
    ruleNumber: parseInt(ruleNumber),
    count: violations.length,
  }));
  
  // Is the process in control?
  const isProcessInControl = ruleViolations.length === 0;
  
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">Process Analysis</h3>
      
      {/* Process Status */}
      <div className={`p-3 rounded-md mb-4 ${isProcessInControl ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="flex items-center">
          {isProcessInControl ? (
            <div className="flex items-center text-green-700">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="font-medium">Process is in control</p>
            </div>
          ) : (
            <div className="flex items-center text-red-700">
              <AlertTriangle size={20} className="mr-2" />
              <p className="font-medium">Process is out of control</p>
            </div>
          )}
        </div>
        <p className={`text-sm mt-1 ${isProcessInControl ? 'text-green-600' : 'text-red-600'}`}>
          {isProcessInControl 
            ? 'No rule violations detected. The process appears to be stable and in control.'
            : `${ruleViolations.length} rule violations detected across ${Object.keys(violationsByRule).length} rule types.`
          }
        </p>
      </div>
      
      {/* Rule Violations */}
      {!isProcessInControl && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Rule Violations Summary</h4>
          <div className="space-y-2">
            {violationCounts.map(({ ruleNumber, count }) => {
              const rule = rules.find(r => r.ruleNumber === ruleNumber);
              return (
                <div key={ruleNumber} className="bg-gray-50 p-3 rounded-md">
                  <p className="font-medium text-sm text-gray-800">
                    Rule {ruleNumber}: {rule?.description}
                  </p>
                  <p className="text-sm text-gray-600">
                    {count} {count === 1 ? 'violation' : 'violations'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Control Limits Info */}
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">Control Limits</h4>
        <div className="bg-gray-50 p-3 rounded-md">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-600">Center Line:</p>
              <p className="font-medium">{controlLimits.centerLine.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-gray-600">Process Sigma:</p>
              <p className="font-medium">{controlLimits.sigma.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-gray-600">Upper Control Limit:</p>
              <p className="font-medium">{controlLimits.ucl.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-gray-600">Lower Control Limit:</p>
              <p className="font-medium">{controlLimits.lcl.toFixed(3)}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Western Electric Rules */}
      <div>
        <h4 className="font-medium text-gray-700 mb-2">Western Electric Rules</h4>
        <div className="bg-gray-50 p-3 rounded-md text-sm">
          <ul className="list-decimal pl-5 space-y-1">
            {rules.map(rule => (
              <li key={rule.ruleNumber} className="text-gray-700">
                {rule.description}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RuleViolationsPanel;