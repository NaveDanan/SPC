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

# Stage 2: Minimal Nginx image to serve static assets
FROM nginx:1.27-alpine AS runtime
# Create non-root user (uid:gid 101:101 matches distroless convention)
RUN addgroup -g 101 -S app && adduser -S app -u 101 -G app

# Remove default nginx config and add hardened config
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/app.conf

# Copy build artifacts
COPY --from=build /app/dist /usr/share/nginx/html
# Runtime configuration placeholder (mounted or created by init container)
RUN mkdir -p /usr/share/nginx/html/config && chown -R app:app /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Security: drop unnecessary permissions
# (nginx image runs as root by default to bind 80; we'll override user in Kubernetes using securityContext)

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://localhost/healthz || exit 1

# Labels for OCI compliance
LABEL org.opencontainers.image.source="https://https://github.com/NaveDanan/SPC" \
      org.opencontainers.image.description="SPC Analysis Tool - React SPA" \
      org.opencontainers.image.licenses="Apache-2.0"

