# SPC Analysis Tool – Offline Build and ArgoCD Deployment Guide

This guide covers building a production image with all required assets for an offline Kubernetes cluster, pushing it to your private registry, and creating a `prod-values.yaml` for an ArgoCD-driven Helm deployment.

## 1) Build the Image (Connected Machine)
- Prerequisites: Docker/Podman, internet access, optional Trivy for scanning.
- Commands:
  - `docker build -t ghcr.io/your-org/spc-analysis-tool:0.1.0 .`
  - Optional: `trivy image --exit-code 1 ghcr.io/your-org/spc-analysis-tool:0.1.0`
  - Test locally: `docker run --rm -p 8080:80 ghcr.io/your-org/spc-analysis-tool:0.1.0`
    - Visit `http://localhost:8080/healthz` → `ok`

## 2) Move Image to Offline Environment
- Retag for your private registry (example):
  - `docker tag ghcr.io/your-org/spc-analysis-tool:0.1.0 registry.internal.example.com/spc/spc-analysis-tool:0.1.0`
- Push to your registry host (connected environment):
  - `docker push registry.internal.example.com/spc/spc-analysis-tool:0.1.0`
- If you cannot push directly from the connected machine, save and load via air-gap:
  - `docker save -o spc-analysis-tool_0.1.0.tar registry.internal.example.com/spc/spc-analysis-tool:0.1.0`
  - Transfer the tar to the registry host, then:
    - `docker load -i spc-analysis-tool_0.1.0.tar`
    - `docker push registry.internal.example.com/spc/spc-analysis-tool:0.1.0`

Note: `docker save` will include all base image layers the build depends on, so cluster nodes only pull from your internal registry.

## 3) Create Image Pull Secret in the Cluster
If your registry requires auth, create a pull secret in the target namespace (e.g., `spc-prod`):
- `kubectl create namespace spc-prod`
- `kubectl -n spc-prod create secret docker-registry regcred \
  --docker-server=registry.internal.example.com \
  --docker-username=<user> --docker-password=<pass> --docker-email=<email>`

## 4) Production Helm Values
A production-focused values file is included at:
- `deploy/helm/spc-analysis-tool/prod-values.yaml`

Update at minimum:
- `image.repository`: `registry.internal.example.com/spc/spc-analysis-tool`
- `image.tag`: `0.1.0` (or an immutable digest `sha256:...`)
- `imagePullSecrets`: `[{ name: regcred }]` if your registry is private
- `ingress.hosts[0].host` and `tls.secretName` to match your DNS/Certificate

Optional toggles:
- `nginxExporter.enabled` and `serviceMonitor.enabled` if you run Prometheus Operator
- `limitRange/resourceQuota.enabled` if you want app-level namespace constraints

## 5) ArgoCD Application Manifest
Example Application (edit `repoURL`, `targetRevision`, and destination namespace/project):

```
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: spc-analysis-tool
  namespace: argocd
spec:
  project: default
  destination:
    namespace: spc-prod
    server: https://kubernetes.default.svc
  source:
    repoURL: https://git.example.com/your-org/spc-analysis-tool.git
    targetRevision: main
    path: deploy/helm/spc-analysis-tool
    helm:
      valueFiles:
        - prod-values.yaml
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Apply it:
- `kubectl apply -f argo-application.yaml`
- In ArgoCD UI, Sync and verify Healthy/Synced

## 6) Sanity Check Without ArgoCD (Optional)
- `helm template spc ./deploy/helm/spc-analysis-tool -f ./deploy/helm/spc-analysis-tool/prod-values.yaml | kubeconform -strict -ignore-missing-schemas`
- `helm upgrade --install spc ./deploy/helm/spc-analysis-tool -n spc-prod -f ./deploy/helm/spc-analysis-tool/prod-values.yaml`

## 7) Offline/Prod Readiness Notes
- Security context: runs as non-root with read-only root FS. Nginx writable paths are mounted via emptyDir volumes.
- NetworkPolicy: egress limited to DNS by default; add CIDRs if you need to reach internal APIs.
- Runtime config: ConfigMap mounts `/config/runtime-config.js`. `index.html` optionally loads it; safe if missing.
- Metrics: enable nginxExporter and serviceMonitor if Prometheus Operator is installed. Service exposes a metrics port conditionally.
- HPA/PDB: HPA uses autoscaling/v2 with CPU utilization; PDB ensures at least one Pod remains during voluntary disruptions.

## 8) What to Change for Your Cluster
- Set `image.repository` and image `tag`/`digest` to your private registry reference.
- Set ingress `className`, `hosts`, and `tls` secret to match your ingress controller and certs.
- Ensure the `regcred` secret exists in the same namespace and reference it via `imagePullSecrets` in values.
- If the cluster is truly air-gapped, disable any external egress in `values.networkPolicy.allowedEgressCIDRs`.

## 9) Troubleshooting
- Pods CrashLoopBackOff: describe the Pod and check permission errors; verify `fsGroup=101` applied and volumes mounted.
- 404 on `/config/runtime-config.js`: ensure ConfigMap enabled and mounted; otherwise harmless.
- Ingress 404: check ingress class, DNS, TLS secret, and that Service name/port match.
- HPA not scaling: check metrics-server presence and HPA status conditions.

