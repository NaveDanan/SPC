<p align="center">
  <img src="public/images/full_logo.png" alt="SPC Analysis Tool" width="320" />
</p>

# SPC Analysis Tool

A modern, client‑side Statistical Process Control (SPC) web application for exploring data, generating control charts, and detecting special‑cause variation using Western Electric rules. Built with React + TypeScript, Chart.js, and Vite.

## Features

- Data import: upload CSV, XLS, or XLSX files (multi‑sheet Excel supported).
- Spreadsheet‑like editor: sort, edit, copy/paste, resize columns, and manage multiple sheets.
- Control charts: Individual (I), P, NP, X‑bar S, EWMA, plus Histogram and Scatter Plot.
- Rule detection: highlights Western Electric rule violations with contextual tooltips.
- On‑chart overlays: center line, ±1σ/±2σ/±3σ bands, UCL/LCL, configurable titles and labels.
- Summary stats: mean (CL), σ, UCL, LCL, and capability indicators (Cpl/Cpu/Cpk display).
- Export: save processed data to CSV or Excel from the browser.
- Responsive UI: Tailwind‑styled panels, control sidebar, and helpful chart guidance.
- AI guidance: Ask the built-in assistant to review uploaded data and recommend SPC chart types with context-aware advice.
- Deployable anywhere: Docker image and Helm chart for Kubernetes with best‑practice manifests.

## Screenshots

<p>
  <img src="public/images/README/SPC_full_page-data_input.png" alt="Data input and spreadsheet preview" width="800" />
</p>

<p>
  <img src="public/images/README/Analysis.png" alt="SPC analysis and chart visualization" width="800" />
</p>

<p>
  <img src="public/images/README/Chart_Control.png" alt="Chart controls and configuration" width="800" />
</p>

## Quick Start (Local)

- Prerequisites: Node.js 18+ (or 20+), npm or pnpm.
- Install deps: `npm install` (or `pnpm install`).
- Run dev: `npm run dev` then open the local URL shown by Vite.
- Build: `npm run build` (outputs static assets to `dist/`).

## AI Chart Assistant Configuration

The "Ask AI" workflow connects to your OpenAI-compatible self-hosted endpoint and is configured only via runtime config.

### Runtime config (required)

For offline/air-gapped deployment, configure AI via `public/config/runtime-config.js` (or Helm ConfigMap mount).

```js
window.APP_CONFIG = {
  ENV: "prod",
  FEATURES: {},
  AI: {
    API_URL: "",
    API_KEY: "",
    MODEL: "",
  },
};
```

The app reads `window.APP_CONFIG.AI.*` first, then falls back to `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL` from `.env` (`VITE_AI_*` is still supported as legacy fallback).

Once configured, click the **Ask AI** button in the Data Input panel to open the assistant. It summarises the current dataset (including selected columns, subgroup size, and early statistics), auto-requests an initial recommendation, and stays available for follow-up questions.

### Optional: DSPy Gateway for More Consistent Answers

This repo includes a lightweight DSPy service at `services/dspy-gateway` that enforces short, structured SPC answers.

1. Start the DSPy gateway:

  ```bash
  cd services/dspy-gateway
  python -m venv .venv
  # Windows PowerShell:
  .venv\Scripts\Activate.ps1
  # macOS/Linux:
  # source .venv/bin/activate
  pip install -r requirements.txt
  copy .env.example .env  # (use cp on macOS/Linux)
  python main.py
  ```

2. Set AI variables in root `.env` and point runtime config to env-backed values (`public/config/runtime-config.js` or Helm values):

  ```js
  window.APP_CONFIG = {
    ENV: "local",
    FEATURES: {},
    AI: {
        API_URL: "",
        API_KEY: "",
        MODEL: "",
    },
  };
  ```

  Set these in `.env`: `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL`.
  Optional: `AI_API_BASE` (custom upstream base URL) and `AI_GATEWAY_PORT` (default `8001`).

The gateway exposes an OpenAI-compatible endpoint (`/v1/chat/completions`) so the existing UI works unchanged, while DSPy controls output style for more predictable, concise responses.

## Docker

- Build image: `docker build -t spc-analysis-tool .`
- Run container: `docker run --rm -p 8080:80 spc-analysis-tool`
- Open: http://localhost:8080

The image is a multi‑stage build (Node for build → Nginx runtime) and serves the production bundle.

## Kubernetes (Helm)

This repo ships with a Helm chart under `deploy/helm/spc-analysis-tool` for production‑ready deployment:

- Templates include `Deployment`, `Service`, `Ingress`, `HPA`, `PDB`, `NetworkPolicy`, `ServiceMonitor`, `ResourceQuota`, `LimitRange`, `ServiceAccount`, and optional `ExternalSecret`/`Secret`/`ConfigMap`.
- Default values: `deploy/helm/spc-analysis-tool/values.yaml` (see also `prod-values.yaml`).

Install/upgrade:

```
helm upgrade --install spc-analysis-tool deploy/helm/spc-analysis-tool \
  -n spc --create-namespace \
  -f deploy/helm/spc-analysis-tool/values.yaml
```

Tailor `values.yaml` for ingress host, resources, and any config map entries. For hardened clusters, set `securityContext`, `podSecurityContext`, and ingress annotations as needed.

## Tech Stack

- React 18 + TypeScript + Vite
- Chart.js + react-chartjs-2 (+ annotation plugin)
- Tailwind CSS
- PapaParse (CSV) and xlsx (Excel)
- jStat (stats utilities)
- Docker + Nginx; Helm for Kubernetes

## Project Structure

- App UI: `src/` (components under `components/analysis`, `components/charts`, `components/layout`, `components/upload`)
- Data processing: `src/utils/spcCalculations.ts`, `src/utils/westernElectricRules.ts`, `src/utils/fileUtils.ts`
- Types: `src/types/`
- Static assets: `public/`
- Docker runtime: `Dockerfile`, `deploy/docker/nginx.conf`
- Kubernetes chart: `deploy/helm/spc-analysis-tool/`

## Notes

- Data stays in the browser; no server is required to analyze files.
- Western Electric rules are used for highlighting potential special‑cause variation; validate results with your process context.

## License

This project is provided as‑is. Add your preferred license here if applicable.
