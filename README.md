<div align="center">
  <img width="558" src="./screenshots/marka-logo-readme.png" alt="Marka" />
</div>

<p align="center">
  <strong>A private library for everything worth keeping.</strong><br />
  Save links, notes, images, PDFs, and web pages, then find them again when they matter.
</p>

Marka is a self-hostable bookmark library built for people who want their saved knowledge close, searchable, and under their control.

## What you can do

- Save links, notes, images, PDFs, and web pages in one place
- Fetch titles, descriptions, previews, screenshots, and archived content automatically
- Organize everything with lists, tags, rules, and collaborative sharing
- Search across your saved content with full-text search
- Add highlights while reading and find them again later
- Use optional AI tagging and summarization, including local-model setups
- Capture content through browser extensions, RSS, CLI, API, and MCP tooling

## Self-host Marka

For a Linux `amd64` host with Docker Engine, Docker Compose v2, and OpenSSL already installed:

```bash
curl -fsSLo /tmp/marka-setup.sh https://raw.githubusercontent.com/absolutepraya/marka/main/scripts/install.sh && bash /tmp/marka-setup.sh
```

The guided installer configures the application, search, browser rendering, and optional AI. It writes secrets to restricted env files, validates the generated Compose stack, and starts the deployment.

The default listener is `127.0.0.1:3000`. For an Internet-facing deployment, put a reverse proxy with TLS in front of it. The installer does not install Docker, configure DNS, change firewall rules, or provision certificates.

For reproducible setup, replace `main` with a reviewed release tag or commit SHA:

```bash
REF=<tag-or-commit-sha>; curl -fsSLo /tmp/marka-setup.sh "https://raw.githubusercontent.com/absolutepraya/marka/${REF}/scripts/install.sh" && bash /tmp/marka-setup.sh
```

Read the [guided installation guide](docs/docs/02-installation/11-guided-docker-setup.md) for all configuration modes and rollback details.

## Develop Marka

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution rules and [`docs/operator-setup.md`](docs/operator-setup.md) for local development and deployment workflows.

## License

Marka is licensed under [AGPL-3.0](LICENSE).

## Attribution

Marka builds on the open-source [Karakeep](https://github.com/karakeep-app/karakeep) project.
