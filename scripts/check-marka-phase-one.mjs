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

function productMatch(line, index) {
  const match = /karakeep/gi.exec(line.slice(index));
  if (!match) return undefined;

  const start = index + match.index;
  const previous = line[start - 1];
  if (previous === "@") return undefined;

  if (line.slice(start).startsWith("karakeep-export-${")) {
    return "karakeep-export-<timestamp>.json";
  }

  return line.slice(start, start + match[0].length);
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

async function scanDetails(file) {
  const absolutePath = resolve(root, file);
  const contents = await readFile(absolutePath, "utf8");
  const matches = [];

  for (const [lineNumber, line] of contents.split("\n").entries()) {
    let offset = 0;
    while (offset < line.length) {
      const observed = productMatch(line, offset);
      const foundAt = line.toLowerCase().indexOf("karakeep", offset);
      if (foundAt === -1) break;
      offset = foundAt + "karakeep".length;
      if (!observed) continue;

      const rule = matchingRule(file, line);
      const reason =
        rule?.reason ??
        (isLegacyImportLine(file, line)
          ? "legacy-compatible import format label"
          : undefined);
      matches.push({ file, lineNumber: lineNumber + 1, observed, reason });
    }
  }

  return matches;
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
