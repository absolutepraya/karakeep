import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = path.join(ROOT, "docs/roadmap/roadmap.excalidraw");
const GENERATED_PATH = path.join(
  ROOT,
  "docs/roadmap/roadmap.generated.excalidraw",
);
const SVG_PATH = path.join(ROOT, "docs/roadmap/roadmap.svg");
const PNG_PATH = path.join(ROOT, "docs/roadmap/roadmap.png");
const README_PATH = path.join(ROOT, "README.md");
const DEFAULT_REPOSITORY = "absolutepraya/marka";
const EXPECTED_ISSUES = [
  25, 26, 28, 34, 37, 38, 46, 55, 62, 63, 64, 65, 66, 67, 68, 69, 72, 73, 74,
  75, 78,
];
const NEUTRAL_TEXT = "#495057";
const COMPLETED_NODE_FILL = "#e9ecef";
const COMPLETED_NODE_STROKE = "#adb5bd";

const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const model = validateScene(source);

if (process.argv.includes("--check")) {
  console.log(
    "Roadmap metadata valid: " +
      model.nodes.length +
      " nodes, " +
      model.edges.length +
      " dependencies",
  );
  process.exit(0);
}

if (!process.argv.includes("--render")) {
  console.error("Usage: node scripts/render-roadmap.mjs --check|--render");
  process.exit(1);
}

const states = await fetchIssueStates(model.nodes);
const generated = createGeneratedScene(source, model.nodes, states);
const rendered = await renderWithExcalidraw(generated);
const readme = await updateReadme();

await writeFile(GENERATED_PATH, JSON.stringify(generated, null, 2) + "\n");
await writeFile(SVG_PATH, rendered.svg);
await writeFile(PNG_PATH, rendered.png);
await writeFile(README_PATH, readme);

console.log("Rendered roadmap for " + model.nodes.length + " issues");
console.log("  " + path.relative(ROOT, GENERATED_PATH));
console.log("  " + path.relative(ROOT, SVG_PATH));
console.log("  " + path.relative(ROOT, PNG_PATH));

function validateScene(scene) {
  if (
    scene.type !== "excalidraw" ||
    scene.version !== 2 ||
    !Array.isArray(scene.elements)
  ) {
    throw new Error("Source is not a version 2 Excalidraw scene");
  }

  const textElements = scene.elements.filter(
    (element) => element.type === "text",
  );
  if (textElements.some((element) => element.fontFamily !== 5)) {
    throw new Error(
      "Every source text element must use Excalifont (fontFamily 5)",
    );
  }

  const nodes = scene.elements
    .filter((element) => element.customData?.roadmap?.kind === "issue")
    .map((element) => {
      const roadmap = element.customData.roadmap;
      if (!Number.isInteger(roadmap.issueNumber) || roadmap.issueNumber < 1) {
        throw new Error(
          "Invalid issue number on node " + (roadmap.nodeId || element.id),
        );
      }
      if (!roadmap.nodeId || !roadmap.label || !roadmap.url) {
        throw new Error(
          "Incomplete roadmap metadata on issue #" + roadmap.issueNumber,
        );
      }
      const label = scene.elements.find(
        (candidate) =>
          candidate.customData?.roadmap?.kind === "label" &&
          candidate.customData.roadmap.nodeId === roadmap.nodeId,
      );
      if (!label || label.text !== roadmap.label) {
        throw new Error(
          "Issue #" + roadmap.issueNumber + " has no matching label",
        );
      }
      if (
        !element.boundElements?.some(
          (binding) => binding.type === "text" && binding.id === label.id,
        )
      ) {
        throw new Error(
          "Issue #" + roadmap.issueNumber + " rectangle must bind its label",
        );
      }
      if (element.link !== roadmap.url || label.link !== roadmap.url) {
        throw new Error(
          "Issue #" + roadmap.issueNumber + " must link to GitHub",
        );
      }
      return { element, labelElement: label, ...roadmap };
    });

  if (nodes.length !== EXPECTED_ISSUES.length) {
    throw new Error(
      "Expected " +
        EXPECTED_ISSUES.length +
        " issue nodes, found " +
        nodes.length,
    );
  }

  const nodeIds = new Set();
  const issueNumbers = new Set();
  for (const node of nodes) {
    if (nodeIds.has(node.nodeId)) {
      throw new Error("Duplicate roadmap node " + node.nodeId);
    }
    if (issueNumbers.has(node.issueNumber)) {
      throw new Error("Duplicate issue #" + node.issueNumber);
    }
    nodeIds.add(node.nodeId);
    issueNumbers.add(node.issueNumber);
  }

  const expected = new Set(EXPECTED_ISSUES);
  if (
    issueNumbers.size !== expected.size ||
    [...issueNumbers].some((issueNumber) => !expected.has(issueNumber))
  ) {
    throw new Error(
      "Source issue set must be exactly: " +
        EXPECTED_ISSUES.map((number) => "#" + number).join(", "),
    );
  }

  const edges = scene.elements
    .filter((element) => element.customData?.roadmap?.kind === "dependency")
    .map((element) => ({ element, ...element.customData.roadmap }));
  const edgeKeys = new Set();
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(
        "Dependency " +
          edge.from +
          " -> " +
          edge.to +
          " references a missing node",
      );
    }
    if (edge.from === edge.to) {
      throw new Error("Dependency " + edge.from + " points to itself");
    }
    const key = edge.from + "->" + edge.to;
    if (edgeKeys.has(key)) {
      throw new Error("Duplicate dependency " + key);
    }
    edgeKeys.add(key);
  }

  const adjacency = new Map(nodes.map((node) => [node.nodeId, []]));
  for (const edge of edges) {
    adjacency.get(edge.from).push(edge.to);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (nodeId) => {
    if (visiting.has(nodeId)) {
      throw new Error("Dependency cycle includes " + nodeId);
    }
    if (visited.has(nodeId)) {
      return;
    }
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId)) {
      visit(next);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const node of nodes) {
    visit(node.nodeId);
  }

  return { nodes, edges };
}

async function fetchIssueStates(nodes) {
  const repository = process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "marka-roadmap-renderer",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };

  const entries = await Promise.all(
    nodes.map(async (node) => {
      const response = await fetch(
        "https://api.github.com/repos/" +
          repository +
          "/issues/" +
          node.issueNumber,
        { headers },
      );
      if (!response.ok) {
        throw new Error(
          "GitHub issue #" +
            node.issueNumber +
            " lookup failed: HTTP " +
            response.status,
        );
      }
      const issue = await response.json();
      if (issue.pull_request) {
        throw new Error(
          "#" + node.issueNumber + " is a pull request, not an issue",
        );
      }
      if (issue.state !== "open" && issue.state !== "closed") {
        throw new Error(
          "#" + node.issueNumber + " returned unsupported state " + issue.state,
        );
      }
      return [node.nodeId, issue.state];
    }),
  );

  return new Map(entries);
}

function createGeneratedScene(scene, nodes, states) {
  const generated = structuredClone(scene);
  generated.elements = generated.elements.map((element) => {
    const roadmap = element.customData?.roadmap;
    if (!roadmap?.nodeId || !states.has(roadmap.nodeId)) {
      return element;
    }

    const state = states.get(roadmap.nodeId);
    const next = {
      ...element,
      customData: {
        ...element.customData,
        roadmap: { ...roadmap, status: state },
      },
    };

    if (
      ["label", "issue-number", "issue-number-bold"].includes(roadmap.kind) &&
      state === "closed"
    ) {
      next.opacity = 68;
      next.strokeColor = NEUTRAL_TEXT;
    }
    if (roadmap.kind === "issue" && state === "closed") {
      next.backgroundColor = COMPLETED_NODE_FILL;
      next.strokeColor = COMPLETED_NODE_STROKE;
    }
    return next;
  });

  for (const node of nodes) {
    if (states.get(node.nodeId) !== "closed") {
      continue;
    }
    generated.elements.push(...createCompletionMarker(node));
    generated.elements.push(...createTextStrikes(node, node.labelElement));
    const numberElements = generated.elements.filter(
      (element) =>
        element.customData?.roadmap?.nodeId === node.nodeId &&
        ["issue-number", "issue-number-bold"].includes(
          element.customData.roadmap.kind,
        ),
    );
    for (const numberElement of numberElements) {
      generated.elements.push(...createTextStrikes(node, numberElement));
    }
  }

  return generated;
}

function createCompletionMarker(node) {
  const rect = node.element;
  const checkbox = {
    ...baseElement(
      node.nodeId + "-complete-box",
      "rectangle",
      rect.x + rect.width - 58,
      rect.y + 14,
      30,
      30,
    ),
    strokeColor: COMPLETED_NODE_STROKE,
    backgroundColor: "#ffffff",
    strokeWidth: 2,
    roughness: 1,
    roundness: { type: 3 },
    groupIds: [node.nodeId],
    link: node.url,
    customData: {
      roadmap: {
        kind: "completion-checkbox",
        nodeId: node.nodeId,
        status: "closed",
      },
    },
  };
  const checkmark = {
    ...baseElement(
      node.nodeId + "-complete-check",
      "text",
      rect.x + rect.width - 58,
      rect.y + 12,
      30,
      30,
    ),
    text: "✓",
    originalText: "✓",
    fontSize: 22,
    fontFamily: 5,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: NEUTRAL_TEXT,
    groupIds: [node.nodeId],
    link: node.url,
    customData: {
      roadmap: {
        kind: "completion-marker",
        nodeId: node.nodeId,
        status: "closed",
      },
    },
  };
  return [checkbox, checkmark];
}

function createTextStrikes(node, label) {
  const lines = label.text.split("\n");
  const lineHeight = label.fontSize * label.lineHeight;
  const lineGap =
    (lineHeight - label.fontSize * 0.886 + label.fontSize * -0.374) / 2;
  const verticalOffset = label.fontSize * 0.886 + lineGap;
  const strikeOffset = label.fontSize * 0.3;

  return lines.map((line, index) => {
    const width = Math.min(
      label.width - 20,
      Math.max(32, line.length * label.fontSize * 0.48),
    );
    const x = label.x + (label.width - width) / 2;
    const y =
      label.y + verticalOffset + index * lineHeight - strikeOffset;

    return {
      ...baseElement(
        node.nodeId + "-strike-" + label.id + "-" + index,
        "line",
        x,
        y,
        width,
        0,
      ),
      strokeColor: NEUTRAL_TEXT,
      strokeWidth: 2,
      roughness: 2,
      points: [
        [0, 0],
        [width, 0],
      ],
      groupIds: [node.nodeId],
      customData: {
        roadmap: {
          kind: "completion-strike",
          nodeId: node.nodeId,
          textElementId: label.id,
          status: "closed",
        },
      },
    };
  });
}

async function renderWithExcalidraw(scene) {
  const bundle = await esbuild.build({
    stdin: {
      contents:
        "import { exportToSvg, exportToCanvas } from " +
        "'@excalidraw/excalidraw';" +
        "window.__renderRoadmap = async (scene) => {" +
        "const appState = {...scene.appState, exportWithDarkMode:false," +
        "exportBackground:true, viewBackgroundColor:'#ffffff'};" +
        "const options = {elements:scene.elements, appState, files:scene.files || {}," +
        "exportPadding:100};" +
        "const svg = await exportToSvg(options);" +
        "const canvas = await exportToCanvas(options);" +
        "return {svg:svg.outerHTML, png:canvas.toDataURL('image/png')};" +
        "};",
      resolveDir: ROOT,
      sourcefile: "roadmap-export-entry.js",
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    write: false,
    loader: { ".css": "empty" },
  });

  const launchOptions = {
    headless: true,
    args: ["--no-sandbox"],
  };
  const executablePath = await findChromiumExecutable();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    throw new Error(
      "Unable to start Chromium for faithful Excalidraw export. " +
        "Run pnpm exec playwright install chromium or set ROADMAP_CHROMIUM_PATH.",
      { cause: error },
    );
  }

  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const result = await page.evaluate(
      (value) => window.__renderRoadmap(value),
      scene,
    );
    const prefix = "data:image/png;base64,";
    if (!result.png.startsWith(prefix)) {
      throw new Error("Excalidraw PNG export did not return a PNG data URL");
    }
    return {
      svg: result.svg,
      png: Buffer.from(result.png.slice(prefix.length), "base64"),
    };
  } finally {
    await browser.close();
  }
}

async function findChromiumExecutable() {
  const candidates = [
    process.env.ROADMAP_CHROMIUM_PATH,
    chromium.executablePath(),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return undefined;
}

async function updateReadme() {
  const readme = await readFile(README_PATH, "utf8");
  const block =
    "<!-- ROADMAP:START -->\n" +
    "## Roadmap\n\n" +
    "[![Marka Roadmap](./docs/roadmap/roadmap.png)]" +
    "(./docs/roadmap/roadmap.svg)\n\n" +
    "[Open the editable Excalidraw source](./docs/roadmap/roadmap.excalidraw)\n" +
    "<!-- ROADMAP:END -->";
  const marker = /<!-- ROADMAP:START -->[\s\S]*?<!-- ROADMAP:END -->/;
  if (!marker.test(readme)) {
    throw new Error("README is missing the marked Roadmap block");
  }
  return readme.replace(marker, block);
}

function baseElement(id, type, x, y, width, height) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#495057",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: null,
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    index: null,
    isDeleted: false,
    boundElements: null,
    updated: 0,
    link: null,
    locked: false,
  };
}

export { validateScene };
