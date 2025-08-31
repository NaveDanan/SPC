# X-bar S Control Chart (Knowledge)

This file summarizes formulas and steps used in the app for the X-bar S chart implementation.

Overview
- An X-bar S chart is used when the subgroup size n ≥ 10 (or when standard deviation is a more stable estimate than range).
- It consists of two charts stacked vertically:
  - X-bar chart (top): plots subgroup means and monitors process mean.
  - S chart (bottom): plots subgroup standard deviations and monitors process variability.

Subgrouping
- Given individual observations, group the data into consecutive, non-overlapping subgroups of size n.
- Discard any incomplete trailing subgroup.

Definitions
- For subgroup i with observations x_{i1}, …, x_{in}:
  - Subgroup mean: \bar{x}_i = (1/n) Σ x_{ij}
  - Subgroup std dev (unbiased): s_i = sqrt( Σ (x_{ij} − \bar{x}_i)^2 / (n − 1) )
- Across k complete subgroups:
  - X-bar-bar (grand mean): \bar{\bar{x}} = (1/k) Σ \bar{x}_i
  - S-bar: \bar{s} = (1/k) Σ s_i

Control Chart Constants (depend on subgroup size n)
- A3, B3, B4, c4 are used.
- Typical values are standard and included in code tables.

Control Limits
- X-bar chart (uses S-bar):
  - UCL_Xbar = \bar{\bar{x}} + A3 · \bar{s}
  - CL_Xbar  = \bar{\bar{x}}
  - LCL_Xbar = \bar{\bar{x}} − A3 · \bar{s}
- S chart:
  - UCL_S = B4 · \bar{s}
  - CL_S  = \bar{s}
  - LCL_S = B3 · \bar{s}

Sigma Estimate
- A compatible estimate of process sigma is \sigma ≈ \bar{s} / c4.

Notes
- Use subgroup means as X-bar chart points; use s_i as S chart points.
- If B3 is 0 for small n, LCL_S is clamped at 0 (as per constants table).

