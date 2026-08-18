# Marka MCP server

This package contains the MCP server for Marka.

It exposes bookmark/list/tag operations for external MCP-compatible tools and agents.

## Supported tools

- search bookmarks
- create bookmarks
- create lists
- attach and detach tags
- add and remove bookmarks from lists

At the moment, this package exposes **tools only** (no MCP resources).

## Use with Claude Desktop

### From npm

```json
{
  "mcpServers": {
    "karakeep": {
      "command": "npx",
      "args": ["@karakeep/mcp"],
      "env": {
        "KARAKEEP_API_ADDR": "https://<YOUR_SERVER_ADDR>",
        "KARAKEEP_API_KEY": "<YOUR_TOKEN>",
        "KARAKEEP_CUSTOM_HEADERS": "{\"CF-Access-Client-Id\": \"...\", \"CF-Access-Client-Secret\": \"...\"}"
      }
    }
  }
}
```

### From Docker

```json
{
  "mcpServers": {
    "karakeep": {
      "command": "docker",
      "args": [
        "run",
        "-e",
        "KARAKEEP_API_ADDR=https://<YOUR_SERVER_ADDR>",
        "-e",
        "KARAKEEP_API_KEY=<YOUR_TOKEN>",
        "-e",
        "KARAKEEP_CUSTOM_HEADERS={\"CF-Access-Client-Id\": \"...\", \"CF-Access-Client-Secret\": \"...\"}",
        "ghcr.io/karakeep-app/karakeep-mcp:latest"
      ]
    }
  }
}
```

The Docker example above uses the upstream published image. If you want a fork-specific image, build and publish one yourself.

## Local development

From the repository root:

```bash
pnpm --filter @karakeep/mcp run
```

Other useful commands:

```bash
pnpm --filter @karakeep/mcp build
pnpm --filter @karakeep/mcp lint
pnpm --filter @karakeep/mcp format:fix
pnpm --filter @karakeep/mcp typecheck
```
