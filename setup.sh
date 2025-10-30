#!/bin/bash

# SPC Analysis Tool - Setup Script
# This script sets up the development environment for the SPC Analysis Tool project
# Supports macOS and Linux (bash)

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Flags
SKIP_NODE_CHECK=false
FORCE=false
DOCKER=false
HELP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-node-check)
            SKIP_NODE_CHECK=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --docker)
            DOCKER=true
            shift
            ;;
        --help|-h)
            HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Functions
print_help() {
    cat << EOF
SPC Analysis Tool - Setup Script

Usage: ./setup.sh [OPTIONS]

OPTIONS:
  --help              Show this help message
  --skip-node-check   Skip Node.js version check
  --force             Force reinstall of dependencies
  --docker            Also build the Docker image

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
  ./setup.sh

  # Setup with Docker build
  ./setup.sh --docker

  # Force reinstall dependencies
  ./setup.sh --force

REQUIREMENTS:
  - Node.js 18+ (20+ recommended)
  - bash or zsh

EOF
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

if [ "$HELP" = true ]; then
    print_help
    exit 0
fi

# Detect OS
OS_TYPE="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS_TYPE="Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macOS"
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  SPC Analysis Tool - Environment Setup     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

print_info "Operating System: $OS_TYPE"

# Step 1: Check Node.js installation
echo ""
echo -e "${CYAN}Step 1: Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js installed: $NODE_VERSION"

if [ "$SKIP_NODE_CHECK" = false ]; then
    NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js 18+ is required. Current version: $NODE_VERSION"
        exit 1
    fi
    
    if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
        print_warning "Node.js 20+ is recommended for best performance. Current version: $NODE_VERSION"
    fi
fi

# Step 2: Enable corepack and ensure pnpm
echo ""
echo -e "${CYAN}Step 2: Setting up pnpm...${NC}"

print_info "Enabling corepack..."
corepack enable
print_success "Corepack enabled"

# Get expected pnpm version from package.json
EXPECTED_PNPM_VERSION=$(grep -o '"packageManager": "[^"]*' package.json | sed 's/"packageManager": "pnpm@//' | sed 's/+.*//')

PNPM_VERSION=$(pnpm --version)
print_success "pnpm installed: v$PNPM_VERSION"

print_info "Preparing pnpm for this project..."
pnpm --version > /dev/null
print_success "pnpm is ready"

# Step 3: Install dependencies
echo ""
echo -e "${CYAN}Step 3: Installing project dependencies...${NC}"

if [ "$FORCE" = true ]; then
    print_warning "Force flag detected - removing node_modules and lockfile..."
    rm -rf node_modules .pnpm-store || true
fi

print_info "Running pnpm install..."

if [ "$FORCE" = true ]; then
    pnpm install --no-frozen-lockfile
else
    pnpm install --frozen-lockfile
fi

print_success "Dependencies installed successfully"

# Step 4: Verify build
echo ""
echo -e "${CYAN}Step 4: Verifying build configuration...${NC}"

print_info "Building project to verify setup..."

if pnpm build; then
    print_success "Build verification successful"
    
    if [ -d "dist" ]; then
        DIST_SIZE=$(du -sh dist | awk '{print $1}')
        print_success "Production build created (size: $DIST_SIZE)"
    fi
else
    print_error "Build verification failed"
    exit 1
fi

# Step 5: Lint check
echo ""
echo -e "${CYAN}Step 5: Running linter...${NC}"

print_info "Running ESLint..."

if pnpm lint; then
    print_success "Lint check passed"
else
    print_warning "Lint warnings detected - review them before committing"
fi

# Step 6: Optional Docker build
if [ "$DOCKER" = true ]; then
    echo ""
    echo -e "${CYAN}Step 6: Building Docker image...${NC}"
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_info "Docker detected: $DOCKER_VERSION"
        
        print_info "Building Docker image..."
        if docker build -t spc-analysis-tool:latest .; then
            print_success "Docker image built successfully"
            print_info "To run the container, use: docker run --rm -p 8080:80 spc-analysis-tool:latest"
        else
            print_error "Docker build failed"
            exit 1
        fi
    else
        print_warning "Docker is not installed. Skipping Docker build."
        echo "Install Docker from https://www.docker.com/ to use the --docker flag"
    fi
fi

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Setup Complete! 🎉               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}Next steps:${NC}"
echo "  1. Start development server:"
echo -e "     ${YELLOW}pnpm dev${NC}"
echo ""
echo "  2. Build for production:"
echo -e "     ${YELLOW}pnpm build${NC}"
echo ""
echo "  3. Preview production build:"
echo -e "     ${YELLOW}pnpm preview${NC}"
echo ""
echo "  4. Run linter:"
echo -e "     ${YELLOW}pnpm lint${NC}"
echo ""

if [ "$DOCKER" = true ]; then
    echo "  5. Run Docker container:"
    echo -e "     ${YELLOW}docker run --rm -p 8080:80 spc-analysis-tool:latest${NC}"
    echo ""
fi

echo -e "${CYAN}Project Structure:${NC}"
echo -e "  Source code:     ${GRAY}./src${NC}"
echo -e "  Components:      ${GRAY}./src/components${NC}"
echo -e "  Public assets:   ${GRAY}./public${NC}"
echo -e "  Kubernetes:      ${GRAY}./deploy/helm${NC}"
echo -e "  Docker:          ${GRAY}./Dockerfile${NC}"
echo ""

echo -e "${CYAN}For more information, see README.md${NC}"
echo ""

exit 0
