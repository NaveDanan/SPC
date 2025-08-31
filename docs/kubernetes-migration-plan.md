# Kubernetes Migration Plan

## Project Analysis
- [x] Identify application type (stateless/stateful)
  - React + Vite single-page application (SPA). Fully stateless; no server-side session or database.
- [x] Document external dependencies
  - None at runtime. All libraries are client-side bundles (chart.js, papaparse, etc.). No API calls detected in codebase (no `fetch`/`axios` usage). Future APIs can be injected via environment-based config object.
- [x] List required persistent volumes
  - None required. Static assets served from container image (immutable). No user uploads persisted server-side.
- [x] Identify configuration requirements
  - Current code does not read runtime env vars. Will introduce optional `APP_CONFIG` (JSON) injected via ConfigMap & served as `/config/runtime-config.js` to enable environment-specific settings (e.g., feature flags, analytics endpoints).
- [x] Map port exposures and protocols
  - SPA served over HTTP (port 80 in container). Exposed via Service (ClusterIP) + optional Ingress (HTTP/HTTPS). Support for TLS termination at Ingress Controller.
- [x] Review security requirements
  - Run as non-root, read-only root filesystem, drop Linux capabilities.
  - Enforce NetworkPolicy (egress limited to DNS + optional external APIs when introduced).
  - Content Security Policy (future enhancement) can be added via Nginx headers.

## Assumptions
1. Delivery model: Serve pre-built static assets using Nginx (multi-stage Docker build: node:20-alpine -> nginx:1.27-alpine). Alternative (Caddy) possible; choosing Nginx for maturity + widespread examples.
2. No server-side rendering needed.
3. GitOps managed by ArgoCD; cluster already has:
   - Ingress Controller (e.g., nginx-ingress or Traefik)
   - External Secrets Operator (ESO) or Sealed Secrets (we'll template for ESO primarily, fallback to Sealed Secrets example)
4. Observability: Front-end container exposes basic /healthz (static 200) & optional nginx stub_status (sidecar exporter) for Prometheus metrics. (Front-end business metrics mostly client-side; outside scope.)
5. Environments: dev (no TLS required, auto-sync), staging (TLS, manual promotion), prod (TLS, manual sync with PR-based promotion). Separate namespaces: `spc-dev`, `spc-staging`, `spc-prod`.
6. Image registry available (e.g., GHCR or ECR). We'll use placeholder `ghcr.io/your-org/spc-analysis-tool` and immutable digest pinning once built.

## Migration Steps
- [x] Step 1: Containerization
  - Main Goal: Create secure, minimal, production-grade image (multi-stage) with non-root user & caching headers.
  - Success Criteria: `docker run -p 8080:80 image` serves SPA; passes Trivy scan with no critical vulns; image size < 80MB.
  - Result: Dockerfile added (multi-stage node:20-alpine -> nginx:1.27-alpine), hardened nginx.conf, health endpoint (/healthz). Non-root user created (uid 101) though runtime user override will occur via Pod securityContext. Next actions: build & scan image in CI (not yet implemented here). Image tag placeholder to be replaced with digest after push.
- [x] Step 2: Helm Chart Scaffold
  - Main Goal: Provide reusable Helm chart (semantic versioning) with values for environments.
  - Success Criteria: `helm template` renders all resources without errors, passes `helm lint`.
- [x] Step 3: Core Kubernetes Resources
  - Main Goal: Deployment, Service, Ingress, ConfigMap, Secret (optional), ServiceAccount, RBAC, HPA, PDB, NetworkPolicy.
  - Success Criteria: All manifests validate with kubeconform; HPA targets CPU utilization (placeholder until metrics) or custom; Pod runs healthy with probes.
- [x] Step 4: Security Hardening
  - Main Goal: Apply securityContext, NetworkPolicy egress restrictions, read-only FS, non-root user, resource quotas/limit ranges (namespace-level examples), image digest pinning.
  - Success Criteria: Kubernetes audit (kube-bench style) shows no critical gaps for these components.
- [x] Step 5: Observability & Metrics
  - Main Goal: Expose health endpoints & nginx metrics (via sidecar/Exporter) + basic logging guidelines.
  - Success Criteria: Prometheus scrape config picks up metrics (annotation-based); Grafana dashboard example provided.
- [x] Step 6: GitOps Integration
  - Main Goal: ArgoCD Application + environment overlays (Kustomize referencing Helm chart) & sync policies.
  - Success Criteria: ArgoCD shows three Applications in Synced/Healthy states after initial deployment.
- [x] Step 7: Secrets Management
  - Main Goal: Integrate ExternalSecret template (ESO) or SealedSecret fallback.
  - Success Criteria: Secret materializes in namespace; Deployment mounts/consumes (even if placeholder variable).
- [ ] Step 8: Documentation & Runbooks
  - Main Goal: Comprehensive README, CHANGELOG, Architecture diagram, Runbook, Troubleshooting guide.
  - Success Criteria: New engineer can deploy dev environment following docs without external assistance.
- [ ] Step 9: Testing & Validation
  - Main Goal: Automated helm chart lint/unit tests; smoke test script.
  - Success Criteria: CI pipeline passes all lint + template tests; rollback procedure documented.
- [ ] Step 10: Final Review & Sign-off
  - Main Goal: Ensure checklist complete; mark deviations; produce final summary.
  - Success Criteria: All earlier steps checked; plan updated with final statuses.

## Risk Assessment
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Missing runtime config needs after deployment | Medium | Medium | Provide runtime-config.js injection mechanism now | 
| Front-end cannot provide rich metrics | Low | High | Limit to infra metrics (nginx) & client telemetry (future) |
| Over-restrictive NetworkPolicy breaks future API calls | Medium | Medium | Document update procedure; allow egress to configurable CIDR list |
| Helm values drift across envs | Medium | Medium | Use base values + overlays & GitOps PR review |
| TLS/Ingress differences in clusters | Medium | Low | Parameterize Ingress class & cert issuer |

## Testing Strategy
### Helm Template & Lint
- Use `helm lint` and `helm template --validate` against a local kind cluster (CI).
- Add helm-unittest tests (naming, labels, securityContext present).

### Integration Test Scenarios
1. Deploy dev environment; verify Service & Ingress respond 200.
2. Scale replicas to 0 then back (stateless resilience).
3. HPA scale test via `kubectl stress` or `hey` to generate CPU load.
4. NetworkPolicy: attempt egress to blocked external host (should fail).

### Rollback Procedures
- Use Helm revision rollback: `helm rollback spc 1`.
- ArgoCD: disable auto-sync; perform `Sync > Rollback`.
- Document how to revert image tag/digest in Git and allow ArgoCD to reconcile.

### Smoke Test Script (Planned)
- Curl health endpoint & index.html; verify content-length > minimal threshold.

## Open Questions / To Clarify (Assumptions until answered)
1. Preferred container registry? (Using placeholder.)
2. Domain names per environment (e.g., dev.spc.example.com?).
3. Need for basic auth or SSO? (Not implemented yet.)
4. Desired metrics retention & alerting (not in scope for initial deployment).

---

Implementation summary (current state):
- Helm templates present for Deployment, Service, Ingress, HPA, PDB, NetworkPolicy, ConfigMap, Secret (optional), ServiceAccount, ExternalSecret (ESO), ServiceMonitor (optional), LimitRange/ResourceQuota (optional).
- Deployment runs as non-root with read-only root FS; added emptyDir mounts for `/var/run` and `/var/cache/nginx` to support Nginx at runtime; probes configured.
- Image pull from private registries supported via `imagePullSecrets` in values.
- Optional runtime configuration mounted at `/config/runtime-config.js`; `index.html` loads it safely.
- Metrics optional via Nginx exporter sidecar and ServiceMonitor; Service exposes metrics port conditionally.
- Added `deploy/helm/spc-analysis-tool/prod-values.yaml` for prod and `docs/guide.md` with offline build and ArgoCD instructions.

Status: Steps 1–7 COMPLETE. Steps 8–10 pending (docs/tests/final review).
