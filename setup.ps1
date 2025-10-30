# SPC Analysis Tool - Setup Script
# This script sets up the development environment for the SPC Analysis Tool project
# Supports Windows (PowerShell), macOS, and Linux (bash)

param(
    [switch]$SkipNodeCheck = $false,
    [switch]$Force = $false,
    [switch]$Docker = $false,
    [switch]$Help = $false
)

function Show-Help {
    Write-Host @"
SPC Analysis Tool - Setup Script

Usage: .\setup.ps1 [OPTIONS]

OPTIONS:
  -Help              Show this help message
  -SkipNodeCheck     Skip Node.js version check
  -Force             Force reinstall of dependencies
  -Docker            Also build the Docker image
  
DESCRIPTION:
  This script sets up the development environment for the SPC Analysis Tool.
  
  It performs the following steps:
  1. Checks system prerequisites (Node.js, pnpm)
  2. Enables corepack for pnpm management
  3. Installs project dependencies using pnpm
  4. Verifies the build process
  5. (Optional) Builds Docker image

EXAMPLES:
  # Basic setup
  .\setup.ps1
  
  # Setup with Docker build
  .\setup.ps1 -Docker
  
  # Force reinstall dependencies
  .\setup.ps1 -Force

REQUIREMENTS:
  - Node.js 18+ (20+ recommended)
  - PowerShell 5.0+ (or bash for macOS/Linux)

"@
}

if ($Help) {
    Show-Help
    exit 0
}

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

Write-Host "
╔════════════════════════════════════════════╗
║  SPC Analysis Tool - Environment Setup     ║
╚════════════════════════════════════════════╝
" -ForegroundColor Cyan

# Check if running on Windows
$IsWindows = $PSVersionTable.Platform -eq "Win32NT" -or $PSVersionTable.OS -like "*Windows*"
$IsMac = $PSVersionTable.OS -like "*Darwin*"
$IsLinux = $PSVersionTable.OS -like "*Linux*"

Write-Info "Operating System: $(if ($IsWindows) { 'Windows' } elseif ($IsMac) { 'macOS' } else { 'Linux' })"

# Step 1: Check Node.js installation
Write-Host ""
Write-Host "Step 1: Checking prerequisites..." -ForegroundColor Cyan

try {
    $nodeVersion = node --version
    Write-Success "Node.js installed: $nodeVersion"
    
    if (-not $SkipNodeCheck) {
        $nodeMajorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($nodeMajorVersion -lt 18) {
            Write-Error-Custom "Node.js 18+ is required. Current version: $nodeVersion"
            exit 1
        }
        if ($nodeMajorVersion -lt 20) {
            Write-Warning-Custom "Node.js 20+ is recommended for best performance. Current version: $nodeVersion"
        }
    }
} catch {
    Write-Error-Custom "Node.js is not installed or not in PATH"
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Step 2: Enable corepack and ensure pnpm
Write-Host ""
Write-Host "Step 2: Setting up pnpm..." -ForegroundColor Cyan

try {
    $currentDir = Get-Location
    
    # Enable corepack
    Write-Info "Enabling corepack..."
    corepack enable
    Write-Success "Corepack enabled"
    
    # Get expected pnpm version from package.json
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $expectedPnpmVersion = $packageJson.packageManager -replace 'pnpm@(.+)\+.*', '$1'
    
    $pnpmVersion = pnpm --version
    Write-Success "pnpm installed: v$pnpmVersion"
    
    # Prepare pnpm
    Write-Info "Preparing pnpm for this project..."
    pnpm --version | Out-Null
    Write-Success "pnpm is ready"
    
} catch {
    Write-Error-Custom "Failed to set up pnpm: $_"
    exit 1
}

# Step 3: Install dependencies
Write-Host ""
Write-Host "Step 3: Installing project dependencies..." -ForegroundColor Cyan

try {
    if ($Force) {
        Write-Warning-Custom "Force flag detected - removing node_modules and lockfile..."
        if (Test-Path "node_modules") {
            Remove-Item -Recurse -Force "node_modules" | Out-Null
        }
    }
    
    Write-Info "Running pnpm install..."
    if ($Force) {
        pnpm install --no-frozen-lockfile
    } else {
        pnpm install --frozen-lockfile
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed successfully"
    } else {
        Write-Error-Custom "Failed to install dependencies"
        exit 1
    }
    
} catch {
    Write-Error-Custom "Failed during dependency installation: $_"
    exit 1
}

# Step 4: Verify build
Write-Host ""
Write-Host "Step 4: Verifying build configuration..." -ForegroundColor Cyan

try {
    Write-Info "Building project to verify setup..."
    pnpm build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Build verification successful"
        
        # Check if dist folder was created
        if (Test-Path "dist") {
            $distSize = (Get-ChildItem -Recurse "dist" | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Success "Production build created (size: $([Math]::Round($distSize, 2)) MB)"
        }
    } else {
        Write-Error-Custom "Build verification failed"
        exit 1
    }
    
} catch {
    Write-Error-Custom "Build verification failed: $_"
    exit 1
}

# Step 5: Lint check
Write-Host ""
Write-Host "Step 5: Running linter..." -ForegroundColor Cyan

try {
    Write-Info "Running ESLint..."
    pnpm lint
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Lint check passed"
    } else {
        Write-Warning-Custom "Lint warnings detected - review them before committing"
    }
    
} catch {
    Write-Error-Custom "Lint check failed: $_"
    exit 1
}

# Step 6: Optional Docker build
if ($Docker) {
    Write-Host ""
    Write-Host "Step 6: Building Docker image..." -ForegroundColor Cyan
    
    try {
        $dockerVersion = docker --version
        Write-Info "Docker detected: $dockerVersion"
        
        Write-Info "Building Docker image..."
        docker build -t spc-analysis-tool:latest .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker image built successfully"
            Write-Info "To run the container, use: docker run --rm -p 8080:80 spc-analysis-tool:latest"
        } else {
            Write-Error-Custom "Docker build failed"
            exit 1
        }
        
    } catch {
        if ($_ -match "docker is not recognized|docker: command not found") {
            Write-Warning-Custom "Docker is not installed. Skipping Docker build."
            Write-Host "Install Docker from https://www.docker.com/ to use the -Docker flag" -ForegroundColor Yellow
        } else {
            Write-Error-Custom "Docker error: $_"
            exit 1
        }
    }
}

# Summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          Setup Complete! 🎉               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start development server:"
Write-Host "     pnpm dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Build for production:"
Write-Host "     pnpm build" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Preview production build:"
Write-Host "     pnpm preview" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Run linter:"
Write-Host "     pnpm lint" -ForegroundColor Yellow
Write-Host ""

if ($Docker) {
    Write-Host "  5. Run Docker container:"
    Write-Host "     docker run --rm -p 8080:80 spc-analysis-tool:latest" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Project Structure:" -ForegroundColor Cyan
Write-Host "  Source code:     ./src" -ForegroundColor Gray
Write-Host "  Components:      ./src/components" -ForegroundColor Gray
Write-Host "  Public assets:   ./public" -ForegroundColor Gray
Write-Host "  Kubernetes:      ./deploy/helm" -ForegroundColor Gray
Write-Host "  Docker:          ./Dockerfile" -ForegroundColor Gray
Write-Host ""

Write-Host "For more information, see README.md" -ForegroundColor Cyan
Write-Host ""

exit 0
