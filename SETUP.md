# SPC Analysis Tool - Setup Guide

This document provides comprehensive instructions for setting up the SPC Analysis Tool development environment.

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [Installation Steps](#installation-steps)
4. [Development Workflow](#development-workflow)
5. [Docker Setup](#docker-setup)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### Windows (PowerShell)

```powershell
# Basic setup
.\setup.ps1

# Setup with Docker build
.\setup.ps1 -Docker

# Force reinstall dependencies
.\setup.ps1 -Force
```

### macOS/Linux (Bash)

```bash
# Make script executable (first time only)
chmod +x setup.sh

# Basic setup
./setup.sh

# Setup with Docker build
./setup.sh --docker

# Force reinstall dependencies
./setup.sh --force
```

## System Requirements

### Minimum Requirements

- **Node.js**: Version 18 or higher
- **Package Manager**: pnpm (managed via corepack)
- **RAM**: 2GB minimum for development
- **Disk Space**: 500MB for node_modules and build artifacts

### Recommended Requirements

- **Node.js**: Version 20 LTS or higher
- **RAM**: 4GB or more for comfortable development
- **Git**: For version control

### Optional Requirements

- **Docker**: For containerized deployment and testing
- **Kubernetes**: For production deployment (requires Helm)
- **Helm**: For Kubernetes package management

## Installation Steps

### Step 1: Install Node.js

#### Windows

1. Visit https://nodejs.org/
2. Download the LTS version (20+)
3. Run the installer and follow the prompts
4. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

#### macOS

Using Homebrew:
```bash
brew install node
node --version
```

Or download from https://nodejs.org/

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install nodejs npm
node --version
```

Or using NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Clone Repository

```bash
git clone https://github.com/NaveDanan/SPC.git
cd SPC
```

### Step 3: Run Setup Script

#### Windows (PowerShell)

```powershell
# Allow script execution if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

.\setup.ps1
```

#### macOS/Linux

```bash
chmod +x setup.sh
./setup.sh
```

### Step 4: Manual Setup (Alternative)

If you prefer to set up manually:

```bash
# Enable corepack (manages pnpm)
corepack enable

# Install dependencies
pnpm install --frozen-lockfile

# Verify build
pnpm build

# Run linter
pnpm lint
```

## Development Workflow

### Available Commands

```bash
# Start development server (with hot reload)
pnpm dev

# Build for production
pnpm build

# Preview production build locally
pnpm preview

# Run ESLint
pnpm lint

# Format code (if prettier is configured)
pnpm format
```

### Development Server

After running `pnpm dev`, open your browser to the URL shown in the terminal (typically `http://localhost:5173`).

The application will automatically reload when you make changes to the source files.

### AI Assistant: Streaming + Markdown/LaTeX

- Configure runtime AI settings in `public/config/runtime-config.js` (or Helm `config.data.runtime-config.js`):

```js
window.APP_CONFIG = {
  ENV: "offline",
  FEATURES: {},
  AI: {
    API_URL: "",
    API_KEY: "",
    MODEL: "",
  },
};
```
- The chat now streams responses when the provider supports `POST /v1/chat/completions` with `stream: true` (OpenAI-compatible).
- Assistant messages support basic Markdown (headings, lists, links, code blocks) and TeX math using `$...$` / `$$...$$`.
- For more predictable and consistent responses, run the optional DSPy gateway (`services/dspy-gateway`) and set `AI_API_URL` in root `.env`.

#### Optional DSPy Gateway (Consistency Mode)

```powershell
cd services/dspy-gateway
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Edit root .env and set AI_API_URL / AI_API_KEY / AI_MODEL
# Optional: AI_API_BASE (custom upstream URL), AI_GATEWAY_PORT (default: 8001)
# If AI_MODEL is not provider-prefixed (e.g. openai/<MODEL_ID>), set AI_PROVIDER.
python main.py
```

Then set front-end runtime config:

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

Restart `pnpm dev` after changing runtime config.
- For high-quality math rendering, include KaTeX or MathJax via CDN in `index.html` (optional):

  KaTeX (recommended):
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  ```

  MathJax (alternative):
  ```html
  <script>
    window.MathJax = { tex: { inlineMath: [['$','$']], displayMath: [['$$','$$']] } };
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  ```

  Without these, LaTeX shows as plain text placeholders.

### Project Structure

```
src/
├── components/
│   ├── analysis/          # SPC analysis components
│   ├── charts/            # Chart display and controls
│   ├── layout/            # Main layout components
│   └── upload/            # Data upload components
├── context/               # React context for state management
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
│   ├── spcCalculations.ts # SPC calculation logic
│   ├── fileUtils.ts       # File handling utilities
│   └── westernElectricRules.ts # Rule detection logic
├── App.tsx                # Main app component
├── main.tsx               # Entry point
└── index.css              # Global styles
```

## Docker Setup

### Prerequisites

- Docker 20.10+
- Docker Compose (optional)

### Build Docker Image

```bash
# Using setup script
.\setup.ps1 -Docker        # Windows
./setup.sh --docker        # macOS/Linux

# Or manually
docker build -t spc-analysis-tool:latest .
```

### Run Docker Container

```bash
# Run on port 8080
docker run --rm -p 8080:80 spc-analysis-tool:latest

# Run with custom port
docker run --rm -p 3000:80 spc-analysis-tool:latest
```

Open http://localhost:8080 in your browser.

### Optional: Enable CORS for static assets

The container Nginx config includes permissive CORS headers that reflect the request `Origin` and answers `OPTIONS` preflight with 204. This lets you embed or fetch assets from other domains.

- File: `deploy/docker/nginx.conf` (CORS section in the `server` block)
- Headers added: `Access-Control-Allow-Origin`, `...-Methods`, `...-Headers`
- Preflight: responds to `OPTIONS` with `204` and cache (`Max-Age: 86400`)

To restrict allowed origins, replace the CORS origin logic with a whitelist:

```
map $http_origin $cors_origin {
  default "";
  ~^https?://(localhost:\\d+|app.example.com)$ $http_origin;
}
```

If you prefer to disable CORS entirely for production, remove the CORS add_header and `OPTIONS` block from the same file and rebuild the image.

### Docker Development

For development with hot-reload through Docker:

```bash
docker run --rm \
  -v $(pwd)/src:/app/src \
  -p 5173:5173 \
  node:20-alpine \
  sh -c "cd /app && pnpm install && pnpm dev"
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured to access your cluster
- Helm 3.0+

### Install with Helm

```bash
# Using default values
helm upgrade --install spc-analysis-tool deploy/helm/spc-analysis-tool \
  -n spc --create-namespace

# Using production values
helm upgrade --install spc-analysis-tool deploy/helm/spc-analysis-tool \
  -n spc --create-namespace \
  -f deploy/helm/spc-analysis-tool/prod-values.yaml

# Custom values
helm upgrade --install spc-analysis-tool deploy/helm/spc-analysis-tool \
  -n spc --create-namespace \
  -f deploy/helm/spc-analysis-tool/values.yaml \
  --set image.tag=v1.0.0 \
  --set ingress.enabled=true \
  --set ingress.host=spc.example.com
```

### Verify Deployment

```bash
# Check deployment status
kubectl get deployment -n spc
kubectl get pods -n spc
kubectl get svc -n spc

# View logs
kubectl logs -n spc -l app=spc-analysis-tool
```

### Uninstall

```bash
helm uninstall spc-analysis-tool -n spc
```

## Troubleshooting

### Issue: "pnpm is not recognized"

**Windows Solution:**
```powershell
# Enable corepack
corepack enable

# Clear npm cache
npm cache clean --force
```

**macOS/Linux Solution:**
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Issue: Node.js version incompatibility

```bash
# Check current version
node --version

# Using nvm (Node Version Manager)
nvm install 20
nvm use 20
```

### Issue: Build fails with memory error

**Windows:**
```powershell
# Increase Node memory
$env:NODE_OPTIONS = "--max-old-space-size=4096"
pnpm build
```

**macOS/Linux:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm build
```

### Issue: Port already in use

```bash
# Development server (default 5173)
pnpm dev -- --port 3000

# Preview server (default 4173)
pnpm preview -- --port 3001
```

### Issue: Dependencies not installing

```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and lockfile
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

### Issue: Docker build fails

```bash
# Clear Docker cache
docker builder prune

# Build without cache
docker build --no-cache -t spc-analysis-tool:latest .
```

### Issue: ESLint errors

```bash
# Run linter with detailed output
pnpm lint

# Fix auto-fixable issues
pnpm lint -- --fix
```

## Performance Tips

### Development

1. Use Node.js 20+ for better performance
2. Keep node_modules on a local SSD for faster installs
3. Use WSL2 on Windows for better file I/O performance
4. Enable IDE caching features

### Production Build

1. The build output is in the `dist/` folder
2. Use a CDN for serving static assets
3. Enable gzip compression in your web server
4. Consider HTTP/2 for better performance

## Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev)
- [Chart.js Documentation](https://www.chartjs.org)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [pnpm Documentation](https://pnpm.io)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the project README.md
3. Check existing GitHub issues
4. Create a new GitHub issue with detailed information

## License

This project is provided as-is. See LICENSE file for details.
