# I–MR Control Chart (Knowledge)

This file summarizes formulas and steps used in the app for the Individuals–Moving Range (I–MR) chart implementation.

Overview
- I–MR consists of two stacked charts:
  - Individuals (I) chart: plots single observations to monitor the process mean.
  - Moving Range (MR) chart: plots the absolute difference between consecutive observations to monitor short‑term variability.
- Appropriate when logical subgroups cannot be formed (subgroup size = 1), samples are expensive or destructive, or data are naturally individual readings.

Definitions
- Observations: x1, x2, …, xN (time‑ordered).
- Moving ranges (lag 2): MRi = |xi − xi−1| for i = 2..N.
- Averages:
  - X̄ = mean of individual values.
  - MR̄ = mean of moving ranges.

Control Limits
- Sigma estimate (for Individuals chart) from moving range:
  - d2 for n = 2 is 1.128, so σ ≈ MR̄ / d2.
- I chart limits:
  - UCL_I = X̄ + 3σ
  - CL_I  = X̄
  - LCL_I = X̄ − 3σ
- MR chart limits (treated like an R chart with n = 2):
  - Use D3 = 0 and D4 = 3.267 for n = 2
  - UCL_MR = D4 · MR̄
  - CL_MR  = MR̄
  - LCL_MR = max(0, D3 · MR̄) = 0

Notes
- The first observation has no moving range; the MR chart therefore has N−1 points.
- MR points can be zero when two consecutive observations are equal.
- Rule detection on I chart uses I limits; MR chart can be monitored for outliers beyond its UCL.
