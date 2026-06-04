Local-only secret manifests live here.

These files are intentionally ignored by Git and excluded from Argo CD sync.

Workflow:
1. Copy each `*.example.yaml` file to the same name without `.example`.
2. Fill in real values locally.
3. Apply them manually before syncing the Argo CD application.

Commands:
```bash
cp k8s/local/coursebench-secrets.example.yaml k8s/local/coursebench-secrets.yaml
cp k8s/local/coursebench-pg-app-credentials.example.yaml k8s/local/coursebench-pg-app-credentials.yaml

kubectl apply -f k8s/local/coursebench-pg-app-credentials.yaml
kubectl apply -f k8s/local/coursebench-secrets.yaml
```
