# Screenshot-first lightweight VPS deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Karakeep's dedicated Chrome container with an authenticated shared Browserless renderer, run a lean screenshot-first worker topology, and remove false embedding activity from production.

**Architecture:** Split the current all-in-one image into the Dockerfile's existing `web` and `workers` targets. A screenshot-first workers entrypoint retains capture, extraction, AI enrichment, search, feeds, rules, webhooks, backups, imports, and bounded asset preprocessing, while the crawler opens a token-authenticated Browserless session per crawl and applies its residential proxy to the isolated Playwright context. SQLite, assets, and queue state remain in the existing VPS `/data` volume.

**Tech Stack:** Next.js 16, Node.js 24, TypeScript, Vitest, Hono, tRPC, Drizzle SQLite, Liteque, Playwright, Browserless Chrome, Docker Compose, GitHub Actions, Watchtower.

## Global Constraints

- Keep Karakeep, SQLite, Meilisearch, and data on the existing VPS. Do not move the application to another host.
- Preserve screenshot-first link capture, Reader Mode, private HTML extraction, automatic tags, automatic summaries, search, RSS feeds, rules, webhooks, scheduled backups, manual imports, and asset preprocessing.
- Every Karakeep browser-rendered capture uses the configured residential proxy. RSSHub keeps its existing direct route and never receives Karakeep proxy credentials.
- Set `EMBEDDING_ENABLE_AUTO_INDEXING=false` explicitly in production and `.env.sample`. Do not enable semantic vector indexing.
- Disable URL PDF capture, full-page archive capture, video downloading, resident admin maintenance, and the header embedding indicator.
- Browserless is private, token-protected, and never host-published. Use an internal Docker network shared only by Browserless, Karakeep workers, and RSSHub.
- Do not log Browserless tokens, WebSocket query strings, or residential proxy credentials.
- Retain existing generic Chrome environment variables for local/upstream compatibility. The new Browserless configuration takes precedence only when both URL and token are configured.
- Do not claim a fixed 512 MiB memory saving. Measure idle and active-crawl memory before and after cutover.

---

## File map

| File | Responsibility |
| --- | --- |
| `packages/shared/config.ts` | Parse and expose Browserless base URL plus token, with explicit validation. |
| `apps/workers/browserlessConnector.ts` | Construct and redact authenticated Browserless WebSocket endpoints. |
| `apps/workers/browserlessConnector.test.ts` | Prove URL construction, no token leakage in redacted output, and invalid configuration handling. |
| `apps/workers/workers/crawlerWorker.ts` | Prefer the connector and use an on-demand Browserless session per crawl. |
| `apps/workers/screenshotFirst.ts` | Start only the approved resident worker set. |
| `apps/workers/workerProfiles.ts` | Define pure, testable named worker profiles without starting a runtime. |
| `apps/workers/tsdown.config.ts` | Build the screenshot-first entrypoint into `dist/`. |
| `docker/root/etc/s6-overlay/s6-rc.d/svc-workers/run` | Select the generic or screenshot-first compiled worker entrypoint safely. |
| `docker/Dockerfile` | Set the `workers` target to the screenshot-first runtime mode. |
| `apps/web/components/dashboard/header/ProcessingStatusIndicator.tsx` | Remove embedding from the visible processing-status contract. |
| `apps/web/components/dashboard/header/ProcessingStatusIndicator.test.tsx` | Verify the header renders only supported active task kinds. |
| `packages/trpc/routers/bookmarks.ts` | Stop returning embedding as an active processing task. |
| `packages/trpc/routers/bookmarks.test.ts` | Verify stale embedding status does not affect totals or task output. |
| `packages/db/drizzle/0086_clear_disabled_embedding_status.sql` | Clear stale pending embedding status after operator queue preflight. |
| `.env.sample` | Document explicit screenshot-first environment values without secrets. |
| `.workers.env.sample` | Document worker-only renderer, proxy, and AI configuration without secrets. |
| `.gitignore` | Prevent the worker-only production secret file from being committed. |
| `deploy/docker-compose.prod.yml` | Define split web and worker services; remove dedicated Chrome; keep private Meilisearch and Watchtower updates. |
| `.github/workflows/docker.yml` | Publish version-compatible web and worker image tags from the same commit. |
| `docs/operator-setup.md` | Record the new production topology, private renderer requirements, and safe migration procedure. |

## Task 1: Make processing status reflect actual enabled work

**Files:**
- Modify: `packages/trpc/routers/bookmarks.ts:976-1057`
- Modify: `packages/trpc/routers/bookmarks.test.ts:78-114`
- Modify: `apps/web/components/dashboard/header/ProcessingStatusIndicator.tsx:11-36`
- Modify: `apps/web/components/dashboard/header/ProcessingStatusIndicator.test.tsx:9-51`

**Interfaces:**
- Consumes: existing `bookmarks.getProcessingStatus` tRPC procedure.
- Produces: `{ total: number; tasks: Array<{ kind: "crawling" | "tagging" | "summarizing" | "importing"; count: number }> }`.
- Invariant: an `embeddingStatus = "pending"` row never contributes to the header total or task list.

- [ ] **Step 1: Make the tRPC test express the new contract**

  In `packages/trpc/routers/bookmarks.test.ts`, retain the existing two bookmark setup calls and import session. Change the expected response to exclude embedding and to count only crawl, tagging, summarization, and import work:

  ```ts
  await expect(api.getProcessingStatus()).resolves.toEqual({
    total: 5,
    tasks: [
      { kind: "crawling", count: 1 },
      { kind: "tagging", count: 2 },
      { kind: "summarizing", count: 1 },
      { kind: "importing", count: 1 },
    ],
  });
  ```

- [ ] **Step 2: Run the focused tRPC test and confirm failure**

  Run:

  ```bash
  pnpm --filter @karakeep/trpc test -- bookmarks.test.ts -t "returns only the current account's active processing work"
  ```

  Expected: failure because the current procedure includes `{ kind: "embedding", count: 2 }` and returns `total: 7`.

- [ ] **Step 3: Remove embedding from the procedure output and database query**

  In `packages/trpc/routers/bookmarks.ts`:

  ```ts
  kind: z.enum(["crawling", "tagging", "summarizing", "importing"]),
  ```

  Remove the embedding query from `Promise.all`, remove its binding from the destructuring assignment, and remove this task from the returned task list:

  ```ts
  { kind: "embedding" as const, count: embedding[0]?.count ?? 0 },
  ```

  Keep user scoping and zero-count filtering unchanged.

- [ ] **Step 4: Update the header test before changing the component**

  In `ProcessingStatusIndicator.test.tsx`, make the mocked API data use supported kinds:

  ```ts
  data: {
    total: 3,
    tasks: [
      { kind: "crawling", count: 1 },
      { kind: "tagging", count: 2 },
    ],
  },
  ```

  Replace the embedding assertion with:

  ```ts
  expect(screen.getByText("Tagging")).toBeTruthy();
  expect(screen.queryByText("Embedding")).toBeNull();
  ```

- [ ] **Step 5: Run the focused header test and confirm failure**

  Run:

  ```bash
  pnpm --filter @karakeep/web test -- ProcessingStatusIndicator.test.tsx
  ```

  Expected: failure because the component still imports `BrainCircuit` and declares the embedding label/icon mapping.

- [ ] **Step 6: Remove the embedding presentation mapping**

  In `ProcessingStatusIndicator.tsx`, remove `BrainCircuit` from the Lucide import. Delete both mapping entries:

  ```ts
  embedding: "Embedding",
  embedding: BrainCircuit,
  ```

  Do not add a fallback icon. The API output and the two exact maps must remain exhaustive over the same four task kinds.

- [ ] **Step 7: Run focused tests and verify success**

  Run:

  ```bash
  pnpm --filter @karakeep/trpc test -- bookmarks.test.ts -t "returns only the current account's active processing work"
  pnpm --filter @karakeep/web test -- ProcessingStatusIndicator.test.tsx
  ```

  Expected: both commands pass; the UI no longer has an embedding task kind.

- [ ] **Step 8: Commit the processing-status correction**

  ```bash
  git add packages/trpc/routers/bookmarks.ts packages/trpc/routers/bookmarks.test.ts apps/web/components/dashboard/header/ProcessingStatusIndicator.tsx apps/web/components/dashboard/header/ProcessingStatusIndicator.test.tsx
  git commit -m "fix: remove disabled embeddings from processing status"
  ```

## Task 2: Add a token-safe Browserless connection contract

**Files:**
- Modify: `packages/shared/config.ts:96-100,341-347`
- Create: `apps/workers/browserlessConnector.ts`
- Create: `apps/workers/browserlessConnector.test.ts`
- Modify: `apps/workers/workers/crawlerWorker.ts:270-296,584-592,1109-1127`

**Interfaces:**
- Consumes: `BROWSERLESS_URL`, `BROWSERLESS_TOKEN`, `BROWSER_CONNECT_ONDEMAND`, existing `BROWSER_WEBSOCKET_URL`, and existing `BROWSER_WEB_URL`.
- Produces: `buildBrowserlessWebSocketUrl(baseUrl: string, token: string | undefined): string` and `redactBrowserConnectionUrl(connectionUrl: string): string`.
- Invariant: `BROWSERLESS_URL` requires `BROWSERLESS_TOKEN`; the generated connection URL carries the token only in memory and redacted logs never contain it.
- Invariant: Browserless configuration takes precedence when complete; existing WebSocket and CDP URLs remain the fallback for local and upstream-compatible deployments.

- [ ] **Step 1: Write connector tests first**

  Create `apps/workers/browserlessConnector.test.ts` with tests for the pure configuration helper. Use `describe`, `expect`, and `it` from Vitest. The tests must cover all three cases:

  ```ts
  expect(
    buildBrowserlessWebSocketUrl("ws://shared-browserless:3000", "test-token"),
  ).toBe("ws://shared-browserless:3000/?token=test-token");

  expect(
    redactBrowserConnectionUrl("ws://shared-browserless:3000/?token=test-token"),
  ).toBe("ws://shared-browserless:3000/?token=redacted");

  expect(() => buildBrowserlessWebSocketUrl("ws://shared-browserless:3000", undefined))
    .toThrow("BROWSERLESS_TOKEN is required when BROWSERLESS_URL is set");
  ```

- [ ] **Step 2: Run the new test and confirm failure**

  Run:

  ```bash
  pnpm --filter @karakeep/workers test -- browserlessConnector.test.ts
  ```

  Expected: failure because `browserlessConnector.ts` does not exist.

- [ ] **Step 3: Add explicit shared configuration**

  Add optional raw environment fields in `packages/shared/config.ts` beside the existing browser settings:

  ```ts
  BROWSERLESS_URL: z.string().url().optional(),
  BROWSERLESS_TOKEN: z.string().min(1).optional(),
  ```

  Expose them beneath `crawler` as:

  ```ts
  browserlessUrl: val.BROWSERLESS_URL,
  browserlessToken: val.BROWSERLESS_TOKEN,
  ```

  Validate the paired invariant after parsing: either both values are absent or both are present. Throw `BROWSERLESS_TOKEN is required when BROWSERLESS_URL is set` when only a URL is configured, and the analogous `BROWSERLESS_URL is required when BROWSERLESS_TOKEN is set` when only a token is configured.

- [ ] **Step 4: Implement the pure connector module**

  Create `apps/workers/browserlessConnector.ts`:

  ```ts
  export function buildBrowserlessWebSocketUrl(
    baseUrl: string,
    token: string | undefined,
  ): string {
    if (!token) {
      throw new Error("BROWSERLESS_TOKEN is required when BROWSERLESS_URL is set");
    }
    const url = new URL(baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }

  export function redactBrowserConnectionUrl(connectionUrl: string): string {
    const url = new URL(connectionUrl);
    if (url.searchParams.has("token")) {
      url.searchParams.set("token", "redacted");
    }
    url.username = "";
    url.password = "";
    return url.toString();
  }
  ```

  The implementation is intentionally pure. It must not import `serverConfig`, Playwright, or logging.

- [ ] **Step 5: Update crawler browser selection and session lifecycle**

  In `crawlerWorker.ts`, use `serverConfig.crawler.browserlessUrl` and `browserlessToken` before the existing browser URL checks. Build the URL through `buildBrowserlessWebSocketUrl`, log only `redactBrowserConnectionUrl(...)`, and connect with:

  ```ts
  chromium.connect(connectionUrl, { timeout: 5000 });
  ```

  Keep the existing `BROWSER_WEBSOCKET_URL` branch and `BROWSER_WEB_URL` CDP branch as fallback branches.

  In the Browserless branch, require `BROWSER_CONNECT_ONDEMAND=true`. Throw a descriptive startup error if Browserless configuration is present while on-demand connection is false, because a persistent shared Browserless connection would permanently consume renderer capacity. Existing per-job cleanup already calls `browser.close()` when on-demand mode is enabled; preserve that behavior.

- [ ] **Step 6: Run connector and crawler test coverage**

  Run:

  ```bash
  pnpm --filter @karakeep/workers test -- browserlessConnector.test.ts
  pnpm --filter @karakeep/workers typecheck
  ```

  Expected: both commands pass. Inspect test output to confirm no token string appears.

- [ ] **Step 7: Commit the Browserless connector**

  ```bash
  git add packages/shared/config.ts apps/workers/browserlessConnector.ts apps/workers/browserlessConnector.test.ts apps/workers/workers/crawlerWorker.ts
  git commit -m "feat: connect crawler to shared browserless"
  ```

## Task 3: Create the screenshot-first worker entrypoint

**Files:**
- Create: `apps/workers/screenshotFirst.ts`
- Modify: `apps/workers/tsdown.config.ts:3-10`
- Modify: `docker/root/etc/s6-overlay/s6-rc.d/svc-workers/run:1-8`
- Modify: `docker/Dockerfile:202-210`
- Create: `apps/workers/workerProfiles.ts`
- Create: `apps/workers/workerProfiles.test.ts`

**Interfaces:**
- Produces: a compiled `dist/screenshotFirst.js` worker runtime.
- Resident worker names: `crawler`, `lowPriorityCrawler`, `inference`, `search`, `feed`, `ruleEngine`, `webhook`, `backup`, `assetPreprocessing`, and `import`.
- Excluded names: `embeddings`, `video`, and `adminMaintenance`.
- Invariant: asset preprocessing concurrency comes from `ASSET_PREPROCESSING_NUM_WORKERS=1`; the runtime does not start an embeddings runner.

- [ ] **Step 1: Write the failing worker-profile test**

  Create `apps/workers/workerProfiles.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";

  import {
    SCREENSHOT_FIRST_IMPORT_WORKER,
    SCREENSHOT_FIRST_QUEUE_WORKERS,
  } from "./workerProfiles";

  describe("screenshot-first worker profile", () => {
    it("starts exactly the approved workers", () => {
      expect(SCREENSHOT_FIRST_QUEUE_WORKERS).toEqual([
        "crawler",
        "lowPriorityCrawler",
        "inference",
        "search",
        "feed",
        "ruleEngine",
        "webhook",
        "backup",
        "assetPreprocessing",
      ]);
      expect(SCREENSHOT_FIRST_QUEUE_WORKERS).not.toContain("embeddings");
      expect(SCREENSHOT_FIRST_QUEUE_WORKERS).not.toContain("video");
      expect(SCREENSHOT_FIRST_QUEUE_WORKERS).not.toContain("adminMaintenance");
      expect(SCREENSHOT_FIRST_IMPORT_WORKER).toBe("import");
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm failure**

  Run:

  ```bash
  pnpm --filter @karakeep/workers test -- workerProfiles.test.ts
  ```

  Expected: failure because `workerProfiles.ts` does not exist.

- [ ] **Step 3: Implement the profile and entrypoint without importing excluded worker modules**

  Create `apps/workers/workerProfiles.ts`:

  ```ts
  export const SCREENSHOT_FIRST_QUEUE_WORKERS = [
    "crawler",
    "lowPriorityCrawler",
    "inference",
    "search",
    "feed",
    "ruleEngine",
    "webhook",
    "backup",
    "assetPreprocessing",
  ] as const;

  export const SCREENSHOT_FIRST_IMPORT_WORKER = "import" as const;
  ```

  In `apps/workers/screenshotFirst.ts`, import `SCREENSHOT_FIRST_QUEUE_WORKERS` and `SCREENSHOT_FIRST_IMPORT_WORKER` from `./workerProfiles`. Copy the runtime lifecycle from `apps/workers/index.ts`: dotenv loading, plugin loading, tracing, event logging, queue preparation/startup, HTTP server lifecycle, graceful shutdown, feed scheduling, backup scheduling, and import polling.

  Import only these worker classes:

  ```ts
  import { AssetPreprocessingWorker } from "./workers/assetPreprocessingWorker";
  import { BackupSchedulingWorker, BackupWorker } from "./workers/backupWorker";
  import { CrawlerWorker } from "./workers/crawlerWorker";
  import { FeedRefreshingWorker, FeedWorker } from "./workers/feedWorker";
  import { OpenAiWorker } from "./workers/inference/inferenceWorker";
  import { ImportWorker } from "./workers/importWorker";
  import { RuleEngineWorker } from "./workers/ruleEngineWorker";
  import { SearchIndexingWorker } from "./workers/searchWorker";
  import { WebhookWorker } from "./workers/webhookWorker";
  ```

  Build queue runners only from the exact exported profile list. Do not import `EmbeddingsWorker`, `VideoWorker`, or `AdminMaintenanceWorker` anywhere in this entrypoint.

  Make the profile's startup deterministic by validating `WORKERS_ENABLED_WORKERS` when it is set: reject a configured worker name outside the screenshot-first set with an error that names the unsupported worker. This prevents a production environment typo from silently changing the resource profile.

- [ ] **Step 4: Build the new entrypoint**

  Change `tsdown.config.ts` to compile all three entry files:

  ```ts
  entry: ["index.ts", "screenshotFirst.ts", "scripts/parseHtmlSubprocess.ts"],
  ```

  Run:

  ```bash
  pnpm --filter @karakeep/workers build
  ```

  Expected: `apps/workers/dist/screenshotFirst.js` exists and the build exits successfully.

- [ ] **Step 5: Select the entrypoint safely from s6**

  Replace the final `exec` in `docker/root/etc/s6-overlay/s6-rc.d/svc-workers/run` with a closed `case` expression:

  ```sh
  case "${WORKER_PROFILE:-full}" in
    full) entrypoint="index.js" ;;
    screenshot-first) entrypoint="screenshotFirst.js" ;;
    *)
      echo "Unknown WORKER_PROFILE: ${WORKER_PROFILE}" >&2
      exit 1
      ;;
  esac

  exec node "dist/${entrypoint}"
  ```

  Set `WORKER_PROFILE=screenshot-first` in the Dockerfile `workers` target. Do not change the `aio` or `web` targets; they retain their established behavior.

- [ ] **Step 6: Verify build and focused tests**

  Run:

  ```bash
  pnpm --filter @karakeep/workers test -- workerProfiles.test.ts
  pnpm --filter @karakeep/workers typecheck
  docker build --target workers -f docker/Dockerfile .
  ```

  Expected: all three commands succeed. The image build proves `dist/screenshotFirst.js` is copied into the workers runtime image.

- [ ] **Step 7: Commit the worker profile**

  ```bash
  git add apps/workers/screenshotFirst.ts apps/workers/workerProfiles.ts apps/workers/workerProfiles.test.ts apps/workers/tsdown.config.ts docker/root/etc/s6-overlay/s6-rc.d/svc-workers/run docker/Dockerfile
  git commit -m "feat: add screenshot-first worker profile"
  ```

## Task 4: Add explicit stale-embedding cleanup and production defaults

**Files:**
- Create: `packages/db/drizzle/0086_clear_disabled_embedding_status.sql` and Drizzle-generated `packages/db/drizzle/meta/0086_snapshot.json`
- Modify: `.env.sample:1-12`
- Create: `.workers.env.sample`
- Modify: `.gitignore:34-36`
- Modify: `docs/operator-setup.md:140-157`

**Interfaces:**
- Consumes: queue preflight proving no `embeddings` jobs exist.
- Produces: `embeddingStatus = NULL` for old `pending` rows; no mutation of `success` or `failure` history.
- Invariant: the migration runs only after the operator captures evidence that the embeddings queue is empty.

- [ ] **Step 1: Record the queue-safety preflight in the operator documentation**

  Add this exact preflight under the production deployment procedure in `docs/operator-setup.md`:

  ```bash
  docker exec -i karakeep-fork-web-1 node <<'NODE'
  const Database = require("better-sqlite3");
  const db = new Database("/data/queue.db", { readonly: true });
  const rows = db.prepare(
    "SELECT queue, status, COUNT(*) AS count FROM tasks WHERE queue = 'embeddings' GROUP BY queue, status",
  ).all();
  if (rows.length !== 0) {
    console.error(JSON.stringify(rows));
    process.exit(1);
  }
  console.log("Embedding queue is empty");
  NODE
  ```

  Document that a non-empty result blocks the cleanup. Do not print any `.env` values or proxy configuration.

- [ ] **Step 2: Generate the custom data migration**

  Run:

  ```bash
  pnpm db:generate --custom --name clear-disabled-embedding-status
  ```

  Expected: Drizzle creates `packages/db/drizzle/0086_clear_disabled_embedding_status.sql`, appends the entry to `packages/db/drizzle/meta/_journal.json`, and writes the matching `0086_snapshot.json`. Do not create a second migration by hand.

- [ ] **Step 3: Write the one-way SQL into the generated migration**

  Replace the generated empty SQL file with:

  ```sql
  UPDATE bookmarks
  SET embedding_status = NULL
  WHERE embedding_status = 'pending';
  ```

  Keep the migration deliberately narrow. Do not change `success` or `failure`, and do not touch tagging or summarization states.

- [ ] **Step 4: Make common and worker-only deployment policy explicit**

  Append these non-secret common settings to `.env.sample`:

  ```dotenv
  EMBEDDING_ENABLE_AUTO_INDEXING=false
  INFERENCE_ENABLE_AUTO_TAGGING=true
  INFERENCE_ENABLE_AUTO_SUMMARIZATION=true
  CRAWLER_STORE_SCREENSHOT=true
  CRAWLER_FULL_PAGE_SCREENSHOT=false
  CRAWLER_STORE_PDF=false
  CRAWLER_FULL_PAGE_ARCHIVE=false
  CRAWLER_VIDEO_DOWNLOAD=false
  ASSET_PREPROCESSING_NUM_WORKERS=1
  WORKER_PROFILE=screenshot-first
  ```

  Create `.workers.env.sample` with worker-only key names and no real secrets:

  ```dotenv
  # Copy to .workers.env on the VPS. Never commit the copied file.
  BROWSERLESS_URL=ws://shared-browserless:3000
  BROWSERLESS_TOKEN=<set-on-vps>
  BROWSER_CONNECT_ONDEMAND=true
  CRAWLER_HTTP_PROXY=<set-on-vps>
  CRAWLER_HTTPS_PROXY=<set-on-vps>
  CRAWLER_NO_PROXY=<set-on-vps>
  OPENAI_API_KEY=<set-on-vps>
  ```

  Keep `BROWSERLESS_TOKEN`, residential proxy values, and `OPENAI_API_KEY` out of the shared `.env` so the web process never receives them.

  Add this line under the existing local environment-file rules in `.gitignore`:

  ```gitignore
  .workers.env
  ```

- [ ] **Step 5: Verify migration metadata and types**

  Run:

  ```bash
  pnpm --filter @karakeep/db typecheck
  ```

  Expected: typechecking passes and the generated migration metadata contains exactly one `0086_clear_disabled_embedding_status` entry.

- [ ] **Step 6: Commit explicit policy and cleanup migration**

  ```bash
  git add packages/db/drizzle .env.sample .workers.env.sample .gitignore docs/operator-setup.md
  git commit -m "fix: clear stale disabled embedding status"
  ```
## Task 5: Publish split images and deploy split Karakeep services

**Files:**
- Modify: `.github/workflows/docker.yml:45-71`
- Modify: `deploy/docker-compose.prod.yml:9-74`
- Modify: `docs/operator-setup.md:121-157`

**Interfaces:**
- Produces: `ghcr.io/<owner>/karakeep:web-main` and `ghcr.io/<owner>/karakeep:workers-main` from the same CI commit.
- Consumes: `KARAKEEP_WEB_IMAGE`, `KARAKEEP_WORKERS_IMAGE`, `BROWSERLESS_URL`, `BROWSERLESS_TOKEN`, and the explicit screenshot-first policy environment variables.
- Invariant: the web service owns migrations; workers do not start until web is healthy; Watchtower updates both Karakeep services.

- [ ] **Step 1: Add the Docker image publishing matrix**

  Replace the single AIO build step with two `docker/build-push-action` steps that use the same context, Dockerfile, amd64 platform, cache settings, and `SERVER_VERSION` build argument:

  ```yaml
  - name: Build and push web image
    uses: docker/build-push-action@ca052bb54ab0790a636c9b5f226502c73d547a25
    with:
      context: .
      file: docker/Dockerfile
      target: web
      platforms: linux/amd64
      build-args: SERVER_VERSION=${{ github.event.workflow_run.head_sha || github.sha }}
      push: true
      tags: |
        ${{ steps.meta.outputs.image_name }}:web-main
        ${{ steps.meta.outputs.image_name }}:web-${{ steps.meta.outputs.sha_tag }}
      cache-from: type=gha
      cache-to: type=gha,mode=max
  ```

  Add an analogous `target: workers` step with:

  ```yaml
  tags: |
    ${{ steps.meta.outputs.image_name }}:workers-main
    ${{ steps.meta.outputs.image_name }}:workers-${{ steps.meta.outputs.sha_tag }}
  ```

- [ ] **Step 2: Validate workflow formatting before Compose changes**

  Run:

  ```bash
  pnpm exec oxfmt --check .github/workflows/docker.yml
  ```

  Expected: Oxfmt exits successfully. This fork intentionally does not use Prettier.

- [ ] **Step 3: Split `deploy/docker-compose.prod.yml` into web and workers**

  Replace the existing all-in-one `web` image reference with:

  ```yaml
  image: ${KARAKEEP_WEB_IMAGE:-ghcr.io/absolutepraya/karakeep:web-main}
  ```

  Add a `workers` service with:

  ```yaml
  workers:
    image: ${KARAKEEP_WORKERS_IMAGE:-ghcr.io/absolutepraya/karakeep:workers-main}
    restart: unless-stopped
    mem_limit: 512m
    depends_on:
      web:
        condition: service_healthy
      meilisearch:
        condition: service_started
    volumes:
      - data:/data
    env_file:
      - ${KARAKEEP_ENV_FILE:-.env}
      - ${KARAKEEP_WORKERS_ENV_FILE:-.workers.env}
    environment:
      DATA_DIR: /data
      MEILI_ADDR: http://meilisearch:7700
      WORKER_PROFILE: screenshot-first
      BROWSER_CONNECT_ONDEMAND: "true"
    networks:
      - default
      - renderer
  ```

  Change web's existing `env_file` to `${KARAKEEP_ENV_FILE:-.env}`. Keep web on the default private network, with its localhost-only port bind. Give web `mem_limit: 512m`, retain its health check, volume, and migration behavior. Add the Watchtower enable label to both web and workers. Remove the Karakeep `chrome` service and its `BROWSER_WEB_URL` configuration from this canonical Compose file.

  Add the external renderer network:

  ```yaml
  networks:
    renderer:
      external: true
      name: karakeep-renderer
  ```

  Do not publish a Browserless port in the Karakeep Compose file.

- [ ] **Step 4: Validate resolved Compose configuration**

  Run:

  ```bash
  KARAKEEP_ENV_FILE=.env.sample KARAKEEP_WORKERS_ENV_FILE=.workers.env.sample docker compose --env-file .env.sample -f deploy/docker-compose.prod.yml config --no-interpolate >/dev/null
  ```

  Expected: the command exits successfully. Inspect the generated model only in a trusted local terminal and confirm `web`, `workers`, `meilisearch`, and `watchtower` resolve; no `chrome` service appears; the worker joins `karakeep-renderer`; only web has a `ports` entry.

- [ ] **Step 5: Update fork operator documentation**

  In `docs/operator-setup.md`, replace the AIO-only image language with the split target names and document:

  - web runs Next.js plus migrations
  - workers run `WORKER_PROFILE=screenshot-first`
  - Browserless uses a private external `karakeep-renderer` network and `BROWSERLESS_TOKEN`
  - `.workers.env` contains `BROWSERLESS_TOKEN`, proxy credentials, and `OPENAI_API_KEY`; the web service must not receive them
  - Browserless `CONCURRENT=2`, `QUEUED=4`, `TIMEOUT=45000`
  - Watchtower updates both web and workers
  - no Browserless port is public

- [ ] **Step 6: Run local deployment checks**

  Run:

  ```bash
  docker build --target web -f docker/Dockerfile .
  docker build --target workers -f docker/Dockerfile .
  KARAKEEP_ENV_FILE=.env.sample KARAKEEP_WORKERS_ENV_FILE=.workers.env.sample docker compose --env-file .env.sample -f deploy/docker-compose.prod.yml config --no-interpolate >/dev/null
  ```

  Expected: both images build and Compose resolves without a Chrome service.

- [ ] **Step 7: Commit split deployment support**

  ```bash
  git add .github/workflows/docker.yml deploy/docker-compose.prod.yml docs/operator-setup.md
  git commit -m "feat: deploy lightweight split karakeep services"
  ```

## Task 6: Execute guarded VPS renderer cutover

**Files:**
- Modify on VPS after diffing: `~/rsshub/docker-compose.yml`
- Modify on VPS after diffing: `~/rsshub/.env`
- Modify on VPS after diffing: `~/karakeep-fork/docker-compose.yml`
- Modify on VPS after diffing: `~/karakeep-fork/.env`
- Create and modify on VPS after diffing: `~/karakeep-fork/.workers.env`
- No repository source files are created in this task.

**Interfaces:**
- Consumes: validated `web-main` and `workers-main` images, `karakeep-renderer` Docker network, a newly generated Browserless token, and the existing Karakeep residential proxy configuration.
- Produces: private shared Browserless access for RSSHub and Karakeep workers.
- Invariant: neither Browserless token nor proxy credentials are printed, committed, pasted into logs, or copied between projects.

- [ ] **Step 1: Capture safe deployment state before any edit**

  On the VPS, inspect the current Compose files and print only environment key names. Back up the Compose files, `.env` files, and `~/karakeep-fork/.workers.env` locally on the VPS with timestamped filenames. Do not copy them to the Mac and do not print secret values.

  Run and retain the output:

  ```bash
  docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}} {{.PIDs}}'
  docker exec -i karakeep-fork-web-1 node <<'NODE'
  const Database = require("better-sqlite3");
  const db = new Database("/data/queue.db", { readonly: true });
  const rows = db.prepare(
    "SELECT queue, status, COUNT(*) AS count FROM tasks WHERE queue = 'embeddings' GROUP BY queue, status",
  ).all();
  if (rows.length) process.exit(1);
  console.log("Embedding queue is empty");
  NODE
  ```

  Expected: a resource baseline is recorded and the embedding queue is empty.

- [ ] **Step 2: Create private renderer network and token-protect Browserless**

  Create the network once:

  ```bash
  docker network create --internal karakeep-renderer
  ```

  Add Browserless to that network. Add `TOKEN`, `CONCURRENT=2`, `QUEUED=4`, and `TIMEOUT=45000` to the Browserless environment. Keep Browserless without a `ports:` mapping. Update RSSHub's existing `PUPPETEER_WS_ENDPOINT` to its token-authenticated private endpoint without printing the endpoint.

  Recreate only the RSSHub Browserless service, then verify its configured health endpoint using the token from inside a trusted container. Verify that a tokenless connection is rejected and that `docker port rsshub-browserless-1` is empty.

- [ ] **Step 3: Prove RSSHub still renders**

  Invoke one existing RSSHub route that uses the renderer. Verify a successful response and inspect RSSHub logs for a successful renderer session. Do not use Karakeep yet.

- [ ] **Step 4: Deploy split Karakeep while retaining its old Chrome service**

  Apply the split `web` and `workers` services and common production `.env` settings, including explicit embedding, screenshot, inference, and asset-preprocessing policy. Create `~/karakeep-fork/.workers.env` with `BROWSERLESS_URL`, `BROWSERLESS_TOKEN`, `BROWSER_CONNECT_ONDEMAND=true`, the existing residential crawler proxy settings, and `OPENAI_API_KEY`. Confirm those worker-only keys are absent from `~/karakeep-fork/.env`.

  Keep the existing Karakeep Chrome container running for this first deployment but ensure workers select the complete Browserless configuration. Confirm web and workers both become healthy and no token appears in logs.

- [ ] **Step 5: Verify residential-proxy capture end to end**

  Save a disposable bookmark pointing at an IP-reporting URL. Verify through the stored screenshot or safe crawl result that the observed source address is the expected residential proxy egress. Then verify:

  - a screenshot asset exists
  - extracted content appears in Reader Mode
  - automatic tagging completes
  - automatic summarization completes
  - the bookmark appears in search
  - Browserless session count returns to baseline after capture

  Do not include the proxy URL, proxy username, proxy password, or raw token in test evidence.

- [ ] **Step 6: Verify capacity and retry behavior**

  Open two short authenticated Browserless sessions from trusted disposable test clients, then start a third Karakeep capture. Confirm the third capture queues or retries according to configured capacity, the bookmark remains saved, and final completion succeeds after capacity is released. Confirm no RSSHub route is broken during the test.

- [ ] **Step 7: Apply stale embedding cleanup and verify the UI**

  Run the generated database migration only after repeating the empty embeddings-queue preflight. Verify `embeddingStatus = 'pending'` count is zero. Refresh the application and confirm the header processing indicator no longer shows Embedding or counts the old 854 stale rows.

- [ ] **Step 8: Remove dedicated Karakeep Chrome after observation**

  After a stable observation window with successful captures, remove the Karakeep Chrome service and `BROWSER_WEB_URL` from the live Karakeep Compose configuration, recreate the stack, and verify no `karakeep-fork-chrome-*` container exists.

- [ ] **Step 9: Record post-cutover measurements and rollback evidence**

  Repeat the `docker stats` command at idle and during one capture. Record web, workers, Meilisearch, and Browserless memory separately. Verify the previous timestamped Karakeep Compose, `.env`, and `.workers.env` backups can restore the dedicated Chrome configuration if Browserless behavior regresses.

- [ ] **Step 10: Commit source documentation only**

  Do not commit VPS `.env` files, `.workers.env` files, Compose copies containing secrets, or deployment backups. If the guarded cutover uncovered a source-level documentation correction, commit only that repository change:

  ```bash
  git add docs/operator-setup.md
  git commit -m "docs: record shared renderer rollout"
  ```

## Task 7: Run final repository verification

**Files:**
- Modify only if a preceding verification failure identifies a specific defect.

**Interfaces:**
- Consumes: all implementation tasks above.
- Produces: evidence that the repository and deployment contract remain coherent.

- [ ] **Step 1: Run focused behavioral suites**

  ```bash
  pnpm --filter @karakeep/trpc test -- bookmarks.test.ts -t "returns only the current account's active processing work"
  pnpm --filter @karakeep/web test -- ProcessingStatusIndicator.test.tsx
  pnpm --filter @karakeep/workers test -- browserlessConnector.test.ts workerProfiles.test.ts
  ```

  Expected: every focused suite passes.

- [ ] **Step 2: Run affected workspace quality checks**

  ```bash
  pnpm --filter @karakeep/workers typecheck
  pnpm --filter @karakeep/trpc typecheck
  pnpm --filter @karakeep/web typecheck
  pnpm --filter @karakeep/workers lint
  pnpm --filter @karakeep/trpc lint
  pnpm --filter @karakeep/web lint
  pnpm --filter @karakeep/workers format
  pnpm --filter @karakeep/trpc format
  pnpm --filter @karakeep/web format
  ```

  Expected: all commands pass with zero type errors, lint findings, and formatting changes.

- [ ] **Step 3: Verify Docker artifacts and documentation consistency**

  ```bash
  docker build --target web -f docker/Dockerfile .
  docker build --target workers -f docker/Dockerfile .
  KARAKEEP_ENV_FILE=.env.sample KARAKEEP_WORKERS_ENV_FILE=.workers.env.sample docker compose --env-file .env.sample -f deploy/docker-compose.prod.yml config --no-interpolate >/dev/null
  ```

  Confirm the resolved Compose model in a trusted local terminal has no Karakeep Chrome service, two Watchtower-labeled Karakeep services, private Browserless reachability only through `karakeep-renderer`, and no secret in checked-in source.

- [ ] **Step 4: Review changed files and commit any final verification-only corrections**

  Review the exact changed files against `docs/superpowers/specs/2026-07-12-lightweight-vps-deployment-design.md`. If verification reveals no source correction, do not create an empty commit. If it reveals one, make the narrow correction, rerun the corresponding focused check, and commit it with a precise `fix:` message.
