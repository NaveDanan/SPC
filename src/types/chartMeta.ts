import { ChartType } from './DataTypes';

export interface ChartExampleUseCase {
  title: string;
  scenario: string;
  whyUseful: string;
}

export interface ChartMeta {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  dataExpectations: string[];
  exampleUseCases: ChartExampleUseCase[];
}

export const chartMeta: Record<ChartType, ChartMeta> = {
  individual: {
    name: 'Individual (I) Chart',
    description: 'Monitors a single continuous measurement per sample (subgroup size = 1). Useful when only one observation is collected at each time point, common for expensive or destructive tests in semiconductor processes.',
    strengths: [
      'Works with subgroup size of 1 when rational subgrouping not possible',
      'Simple to interpret center line and control limits',
      'Good for high-mix / low-volume situations'
    ],
    weaknesses: [
      'Less efficient than X-bar charts when logical subgroups can be formed',
      'Assumes approximate normality; heavy tails can inflate false signals',
      'More sensitive to short-term noise'
    ],
    dataExpectations: [
      'Continuous variable (e.g. nm, Å, ohms, volts)',
      'One measurement per time/lot/wafer',
      'Relatively stable sampling interval',
      'Limited special-cause variation during baseline period'
    ],
    exampleUseCases: [
      {
        title: 'Critical Dimension (CD) Line Width',
        scenario: 'Track post-etch gate line width (nm) measured from a single metrology site per wafer lot.',
        whyUseful: 'Detects drifts in lithography or etch processes that slowly change feature size before yield loss occurs.'
      },
      {
        title: 'Gate Oxide Thickness',
        scenario: 'Monitor a single ellipsometry reading of gate oxide thickness per wafer for an R&D qualification run.',
        whyUseful: 'Provides quick stability view when multiple measurements per wafer are unavailable.'
      }
    ]
  },
  pChart: {
    name: 'P Chart (Proportion Nonconforming)',
    description: 'Tracks the proportion (percentage) of nonconforming units when the sample size can vary. Suitable for binomial pass/fail outcomes such as die yield.',
    strengths: [
      'Handles varying sample sizes naturally',
      'Intuitive percentage scale for communication',
      'Appropriate for attribute (pass/fail) data'
    ],
    weaknesses: [
      'Less sensitive at very low defect rates (may need rare-event charts)',
      'Requires independence between units sampled',
      'Control limits widen/shrink with sample size causing visual complexity'
    ],
    dataExpectations: [
      'Counts of total units inspected and number failing',
      'Approximate binomial behavior (constant probability within subgroup)',
      'Sufficient counts so np and n(1-p) are not extremely small'
    ],
    exampleUseCases: [
      {
        title: 'Die Electrical Test Yield',
        scenario: 'Monitor proportion of dies failing parametric electrical test per wafer when wafers can have edge exclusion or partial patterns (varying die counts).',
        whyUseful: 'Early detection of systemic process shifts impacting overall yield.'
      }
    ]
  },
  npChart: {
    name: 'NP Chart (Number Nonconforming)',
    description: 'Plots the count of nonconforming units per sample when the sample size is constant. A scaled version of the p chart that keeps integer counts.',
    strengths: [
      'Simple interpretation of raw defect counts',
      'Constant control limits when sample size fixed',
      'Good for operator/shop-floor visibility'
    ],
    weaknesses: [
      'Requires constant sample size',
      'Not suitable for very large n with tiny proportions (loss of resolution)',
      'Less intuitive when stakeholders expect percentages'
    ],
    dataExpectations: [
      'Constant sample size each subgroup (e.g., fixed die count)',
      'Binary classification pass/fail or conforming/nonconforming',
      'Stable inspection methodology'
    ],
    exampleUseCases: [
      {
        title: 'Defective Dies per Wafer',
        scenario: 'Track the number of failing dies per wafer for a product with fixed die count across lots.',
        whyUseful: 'Highlights sudden excursions in defectivity when sample size does not vary.'
      }
    ]
  },
  xBarS: {
    name: 'X-bar S Chart',
    description: 'Monitors both the subgroup mean (X-bar) and standard deviation (S) for continuous data with moderate subgroup sizes (n ≥ 4). Suitable when within-subgroup variation matters.',
    strengths: [
      'Separates monitoring of process mean and variability',
      'Uses standard deviation for better performance with larger n',
      'More efficient than Individuals chart when rational subgroups exist'
    ],
    weaknesses: [
      'Requires consistent subgrouping logic (e.g., consecutive wafers, same tool)',
      'Higher data collection effort vs Individuals chart',
      'Assumes approximate normality within subgroups'
    ],
    dataExpectations: [
      'Continuous measurements',
      'Subgroup size typically 4–10 wafers or sites',
      'Rational subgroup: within-subgroup variation represents short-term noise',
      'Limited tool/product mixing in a single subgroup'
    ],
    exampleUseCases: [
      {
        title: 'Via Resistance Across Wafers',
        scenario: 'Measure contact resistance on 5 wafers from each lot and chart subgroup average and standard deviation.',
        whyUseful: 'Detects both drift in mean resistance and increase in variability indicating process instability.'
      },
      {
        title: 'Film Thickness Uniformity',
        scenario: 'Collect 6 site thickness measurements on wafers and subgroup by run to track deposition stability.',
        whyUseful: 'Separates mean film growth rate shifts from intra-wafer variation increases.'
      }
    ]
  },
  xBarR: {
    name: 'X-bar R Chart',
    description: 'Monitors the subgroup mean (X-bar) and the subgroup range (R) for continuous data with small subgroup sizes (typically 2–10). Preferred when only a few observations per subgroup are available.',
    strengths: [
      'Efficient for small subgroup sizes using range as variability proxy',
      'Simple to compute and explain on the shop floor',
      'Separates mean (X-bar) and short-term spread (R) monitoring'
    ],
    weaknesses: [
      'Less statistically efficient than S-based charts for larger n',
      'Range is sensitive to outliers within a subgroup',
      'Requires rational subgrouping; mixing tools/conditions reduces sensitivity'
    ],
    dataExpectations: [
      'Continuous measurements with small, fixed subgroup size (e.g., n = 3–5)',
      'Subgroups formed so within-subgroup variation represents short-term noise',
      'Enough subgroups over time to establish stable baseline limits'
    ],
    exampleUseCases: [
      {
        title: 'Etch Depth — 3 Sites per Wafer',
        scenario: 'Measure etch depth at three standard metrology sites per wafer and subgroup by wafer/run.',
        whyUseful: 'Tracks drift in mean etch depth while monitoring short-term spread via range when n is small.'
      },
      {
        title: 'Critical Dimension — 5 Dice per Lot',
        scenario: 'Sample five devices per lot for line width; chart subgroup means and ranges lot by lot.',
        whyUseful: 'Detects both centering shifts and sudden increases in within-lot variability with minimal sampling.'
      }
    ]
  },
  ewma: {
    name: 'EWMA Chart',
    description: 'Exponentially Weighted Moving Average chart emphasizes recent data while retaining historical context to detect small persistent shifts sooner than Shewhart charts.',
    strengths: [
      'High sensitivity to small drifts',
      'Smooths noisy signals giving clearer trend visibility',
      'Configurable lambda tunes responsiveness vs stability'
    ],
    weaknesses: [
      'Parameter (lambda) selection requires engineering judgment',
      'Slower than Shewhart for large sudden shifts',
      'Historical initialization can influence early points'
    ],
    dataExpectations: [
      'Sequential time-ordered continuous measurements',
      'Roughly stable variance over monitoring period',
      'Appropriate baseline established for initial mean and sigma'
    ],
    exampleUseCases: [
      {
        title: 'CMP Removal Rate Drift',
        scenario: 'Track chemical-mechanical planarization removal rate (nm/min) per run to detect gradual pad wear or slurry concentration drift.',
        whyUseful: 'Identifies subtle degradation before it triggers Shewhart rule violations.'
      },
      {
        title: 'Etch Endpoint Signal',
        scenario: 'Monitor normalized optical emission intensity to catch small drifts due to chamber seasoning.',
        whyUseful: 'Improves early detection of process shift affecting endpoint accuracy.'
      }
    ]
  },
  histogram: {
    name: 'Histogram',
    description: 'Displays the distribution of a continuous variable without time order to assess shape, spread, and potential multi-modality.',
    strengths: [
      'Visualizes distribution shape (skew, tails, bimodality)',
      'Supports capability and normality discussions',
      'Useful exploratory tool before choosing control strategy'
    ],
    weaknesses: [
      'No time sequencing — cannot show when a shift occurred',
      'Bin selection can distort perception',
      'Not a control chart (no control limits)'
    ],
    dataExpectations: [
      'Independent continuous observations',
      'Sufficient sample size (typically > 30)',
      'Representative sampling across conditions of interest'
    ],
    exampleUseCases: [
      {
        title: 'Post-Deposition Thickness Distribution',
        scenario: 'Aggregate film thickness measurements from multiple lots to assess overall process centering and spread.',
        whyUseful: 'Reveals tails or secondary modes indicating tool-to-tool differences or recipe splits.'
      }
    ]
  },
  scatterPlot: {
    name: 'Scatter Plot',
    description: 'Shows relationship (correlation, pattern) between two continuous variables to uncover potential cause-and-effect or co-variation.',
    strengths: [
      'Identifies linear or nonlinear relationships',
      'Highlights clusters, outliers, and stratification',
      'Supports regression / DOE follow-up'
    ],
    weaknesses: [
      'Requires paired observations',
      'No direct control limits or stability assessment',
      'Correlation ≠ causation; confounding possible'
    ],
    dataExpectations: [
      'Paired continuous measurements (X vs Y)',
      'Synchronized sampling (same lot/wafer/time)',
      'Sufficient range/variation in predictor variable'
    ],
    exampleUseCases: [
      {
        title: 'Furnace Temperature vs Dopant Concentration',
        scenario: 'Plot diffusion furnace setpoint temperature against measured dopant sheet concentration.',
        whyUseful: 'Reveals sensitivity of concentration to minor temperature variations guiding tighter control.'
      },
      {
        title: 'Deposition Pressure vs Film Density',
        scenario: 'Examine relationship between chamber pressure and resulting dielectric film density.',
        whyUseful: 'Supports optimization of recipe window balancing density and throughput.'
      }
    ]
  }
};
