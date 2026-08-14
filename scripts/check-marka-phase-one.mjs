import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const sourceFiles = [
  "apps/web/app/admin/admin_tools/page.tsx",
  "apps/web/app/admin/background_jobs/page.tsx",
  "apps/web/app/admin/overview/page.tsx",
  "apps/web/app/admin/users/page.tsx",
  "apps/web/app/settings/ai/page.tsx",
  "apps/web/app/settings/stats/page.tsx",
  "apps/web/app/settings/stats/layout.tsx",
  "apps/web/app/settings/subscription/page.tsx",
  "apps/web/components/admin/BasicStats.tsx",
  "apps/web/components/admin/CreateInviteDialog.tsx",
  "apps/web/components/dashboard/header/ProfileOptions.tsx",
  "apps/web/components/invite/InviteAcceptForm.tsx",
  "apps/web/components/public/lists/PublicListHeader.tsx",
  "apps/web/components/signin/SignInForm.tsx",
  "apps/web/components/wrapped/ShareButton.tsx",
  "apps/web/components/wrapped/WrappedContent.tsx",
  "apps/web/app/api/bookmarks/export/route.tsx",
  "README.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "docs/fork-setup.md",
  "docs/README.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/question.yml",
];

const allowlist = new Map([
  [
    "apps/web/app/api/bookmarks/export/route.tsx",
    [
      {
        pattern: /karakeep-export-\$\{new Date\(\)\.toISOString\(\)\}\.json/i,
        reason: "legacy-compatible export filename",
      },
    ],
  ],
  [
    "apps/web/components/admin/BasicStats.tsx",
    [
      {
        pattern:
          /https:\/\/api\.github\.com\/repos\/karakeep-app\/karakeep\/releases\/latest/i,
        reason: "upstream release API",
      },
      {
        pattern: /https:\/\/github\.com\/karakeep-app\/karakeep\/releases/i,
        reason: "upstream releases page",
      },
    ],
  ],
  [
    "apps/web/components/dashboard/header/ProfileOptions.tsx",
    [
      {
        pattern: /https:\/\/karakeep\.app\/apps/i,
        reason: "upstream apps destination",
      },
      {
        pattern: /https:\/\/docs\.karakeep\.app/i,
        reason: "upstream documentation destination",
      },
      {
        pattern: /https:\/\/x\.com\/karakeep_app/i,
        reason: "upstream social destination",
      },
      {
        pattern: /Upstream Karakeep apps and extensions/,
        reason: "upstream apps destination label",
      },
      {
        pattern: /Upstream Karakeep documentation/,
        reason: "upstream documentation destination label",
      },
      {
        pattern: /Follow upstream Karakeep on X/,
        reason: "upstream social destination label",
      },
    ],
  ],
]);

function productMatch(line, start) {
  const previous = line[start - 1];
  if (previous === "@") return undefined;

  if (line.slice(start).startsWith("karakeep-export-${")) {
    return { observed: "karakeep-export-<timestamp>.json", start };
  }

  return { observed: line.slice(start, start + "karakeep".length), start };
}

function matchingRule(file, line) {
  return allowlist.get(file)?.find(({ pattern }) => pattern.test(line));
}

function isLegacyImportLine(file, line) {
  return (
    file.startsWith("apps/web/lib/i18n/locales/") &&
    /"import_bookmarks_from_karakeep_export"\s*:/.test(line)
  );
}

const documentationIdentifierPatterns = [
  /\b(?:the\s+)?upstream\s+Karakeep\s+(?:project|repository|source|name)\b/gi,
  /\bKarakeep\b\s+is the upstream\s+(?:project|repository|source)\b/gi,
  /https:\/\/github\.com\/karakeep-app\/karakeep(?=[\/?#)\]>\s"']|$)/gi,
  /git@github\.com:karakeep-app\/karakeep\.git(?=[\s"'`]|$)/gi,
  /https:\/\/img\.shields\.io\/github\/v\/release\/karakeep-app\/karakeep(?=[\/?#)\]>\s"']|$)/gi,
  /https:\/\/(?:docs|try|cloud)\.karakeep\.app(?=[\/?#)\]>\s"']|$)/gi,
  /https:\/\/karakeep\.app(?=[\/?#)\]>\s"']|$)/gi,
  /(?:^|[^\w-])absolutepraya\/karakeep(?=[^\w-]|$)/gi,
  /\bKARAKEEP_[A-Z0-9_]*(?![\w-])/g,
  /ghcr\.io\/[\w<>-]+\/karakeep(?=[:\s"'`\])>,;]|$|@sha256:[a-f0-9]+(?=$|[\s"'`\])>,;]))/gi,
  /\bkarakeep-(?:renderer|fork-web-1)(?=[:\s"'`\])>,;]|$)/gi,
  /@karakeep\/docs(?=[:\s"'`\])>,;]|$)/gi,
  /karakeep-openapi-spec\.json(?=[:\s"'`\])>,;]|$)/gi,
];

function isDocumentationIdentifier(file, line, start) {
  if (!file.endsWith(".md") && !file.endsWith(".yml")) return false;

  return documentationIdentifierPatterns.some((pattern) =>
    [...line.matchAll(pattern)].some(
      (match) =>
        match.index !== undefined &&
        match.index <= start &&
        start < match.index + match[0].length,
    ),
  );
}

function scanContents(file, contents) {
  const matches = [];

  for (const [lineNumber, line] of contents.split("\n").entries()) {
    let offset = 0;
    while (offset < line.length) {
      const foundAt = line.toLowerCase().indexOf("karakeep", offset);
      if (foundAt === -1) break;
      offset = foundAt + "karakeep".length;
      const product = productMatch(line, foundAt);
      if (!product) continue;

      const rule = matchingRule(file, line);
      const reason =
        rule?.reason ??
        (isLegacyImportLine(file, line)
          ? "legacy-compatible import format label"
          : isDocumentationIdentifier(file, line, product.start)
            ? "explicit upstream attribution or operational identifier"
          : undefined);
      matches.push({
        file,
        lineNumber: lineNumber + 1,
        observed: product.observed,
        reason,
      });
    }
  }

  return matches;
}

async function scanDetails(file) {
  const absolutePath = resolve(root, file);
  return scanContents(file, await readFile(absolutePath, "utf8"));
}

export async function scan(file) {
  return (await scanDetails(file)).map(({ observed }) => observed);
}

async function filesToScan() {
  const localeFiles = [];
  for await (const file of glob(
    "apps/web/lib/i18n/locales/*/translation.json",
    {
      cwd: root,
    },
  )) {
    localeFiles.push(file);
  }
  return [...sourceFiles, ...localeFiles.sort()];
}

async function main() {
  for (const [file, line] of [
    ["README.md", "Karakeep is a self-hostable library."],
    [
      "README.md",
      "Karakeep is a self-hostable library for upstream users.",
    ],
    [
      ".github/ISSUE_TEMPLATE/feature_request.yml",
      "description: Request a feature for Karakeep",
    ],
  ]) {
    const matches = scanContents(file, line);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].reason, undefined);
  }
  const inlineUpstreamUrl = scanContents(
    "README.md",
    "Karakeep is a generic product. See https://docs.karakeep.app",
  );
  assert.equal(inlineUpstreamUrl.length, 2);
  assert.equal(inlineUpstreamUrl[0].reason, undefined);
  assert.notEqual(inlineUpstreamUrl[1].reason, undefined);
  const lookalikeUpstreamUrl = scanContents(
    "README.md",
    "See https://docs.karakeep.app.example",
  );
  assert.equal(lookalikeUpstreamUrl.length, 1);
  assert.equal(lookalikeUpstreamUrl[0].reason, undefined);
  const mixedAttribution = scanContents(
    "README.md",
    "Karakeep is generic. Karakeep is the upstream project.",
  );
  assert.equal(mixedAttribution.length, 2);
  assert.equal(mixedAttribution[0].reason, undefined);
  assert.notEqual(mixedAttribution[1].reason, undefined);
  for (const line of [
    "ghcr.io/owner/karakeep-evil:latest",
    "karakeep-renderer-evil",
    "karakeep-fork-web-1-evil",
  ]) {
    const lookalikeOperation = scanContents("README.md", line);
    assert.equal(lookalikeOperation.length, 1);
    assert.equal(lookalikeOperation[0].reason, undefined);
  }
  const immutableGhcrImage = scanContents(
    "README.md",
    "ghcr.io/owner/karakeep@sha256:abcdef",
  );
  assert.equal(immutableGhcrImage.length, 1);
  assert.notEqual(immutableGhcrImage[0].reason, undefined);
  const invalidGhcrDigest = scanContents(
    "README.md",
    "ghcr.io/owner/karakeep@not-a-digest",
  );
  assert.equal(invalidGhcrDigest.length, 1);
  assert.equal(invalidGhcrDigest[0].reason, undefined);
  const suffixedEnvironmentVariable = scanContents(
    "README.md",
    "KARAKEEP_PROD_SSH_HOST-evil",
  );
  assert.equal(suffixedEnvironmentVariable.length, 1);
  assert.equal(suffixedEnvironmentVariable[0].reason, undefined);
  assert.deepEqual(await scan("apps/web/components/signin/SignInForm.tsx"), []);
  assert.deepEqual(
    await scan("apps/web/components/wrapped/WrappedContent.tsx"),
    [],
  );
  assert.deepEqual(await scan("apps/web/app/api/bookmarks/export/route.tsx"), [
    "karakeep-export-<timestamp>.json",
  ]);

  const matches = (
    await Promise.all((await filesToScan()).map(scanDetails))
  ).flat();
  const failures = matches.filter(({ reason }) => !reason);
  const allowed = matches.filter(({ reason }) => reason);

  for (const { file, lineNumber, observed, reason } of allowed) {
    console.log(`ALLOWED ${file}:${lineNumber} ${observed} (${reason})`);
  }
  for (const { file, lineNumber, observed } of failures) {
    console.error(`STALE ${file}:${lineNumber} ${observed}`);
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
