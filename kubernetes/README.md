# Kubernetes deployment

This directory contains Kubernetes / Kustomize deployment material for Karakeep.

## Using it

If you are deploying from these manifests directly:

```bash
make deploy
```

Before deploying, review and update the local configuration inputs such as `.env` or any environment-specific overlays you use.

## Note

This fork’s day-to-day operator flow is centered around Docker image builds plus pull-based deployment (`docs/fork-setup.md`), not Kubernetes-first operations.

If you are looking for the main self-hosting path, start with:
- `README.md`
- `docs/fork-setup.md`
- upstream docs at <https://docs.karakeep.app>
