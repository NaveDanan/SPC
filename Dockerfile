# Stage 1: Build the React (Vite) application
FROM node:20-alpine AS build
WORKDIR /app
# Install dependencies separately for better layer caching
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
# Build (set NODE_ENV=production for any build-time conditionals)
ENV NODE_ENV=production
RUN pnpm build

# Stage 2: Non-root runtime to serve static assets (no nginx)
FROM node:20-alpine AS runtime
WORKDIR /app

# Install static file server
RUN npm install -g serve

# Copy build artifacts
COPY --from=build /app/dist /app/dist

# Expose non-privileged port
EXPOSE 8080

# Run as non-root user provided by node image
USER node

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

# Labels for OCI compliance
LABEL org.opencontainers.image.source="https://github.com/NaveDanan/SPC" \
      org.opencontainers.image.description="SPC Analysis Tool - React SPA" \
      org.opencontainers.image.licenses="Apache-2.0"

CMD ["serve", "-s", "dist", "-l", "8080"]

