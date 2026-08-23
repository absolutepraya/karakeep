import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SOURCE_PATH = path.join(ROOT, "docs/roadmap/roadmap.excalidraw");
const GENERATED_PATH = path.join(
  ROOT,
  "docs/roadmap/roadmap.generated.excalidraw",
);
const SVG_PATH = path.join(ROOT, "docs/roadmap/roadmap.svg");
const PNG_PATH = path.join(ROOT, "docs/roadmap/roadmap.png");
const DEFAULT_REPOSITORY = "absolutepraya/marka";

const NEUTRAL_STROKE = "#868e96";
const NEUTRAL_TEXT = "#495057";
const ARROW_STROKE = "#868e96";
const CANVAS_WIDTH = 1800;
const CANVAS_HEIGHT = 1280;

const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const model = validateScene(source);

if (process.argv.includes("--check")) {
  console.log(
    `Roadmap metadata valid: ${model.nodes.length} nodes, ${model.edges.length} dependencies`,
  );
  process.exit(0);
}

if (!process.argv.includes("--render")) {
  console.error("Usage: node scripts/render-roadmap.mjs --check|--render");
  process.exit(1);
}

const states = await fetchIssueStates(model.nodes);
const generated = createGeneratedScene(source, model.nodes, states);
const svg = renderSvg(model, states);

await writeFile(GENERATED_PATH, `${JSON.stringify(generated, null, 2)}\n`);
await writeFile(SVG_PATH, svg);
await sharp(Buffer.from(svg)).png().toFile(PNG_PATH);

console.log(`Rendered roadmap for ${model.nodes.length} issues`);
console.log(`  ${path.relative(ROOT, GENERATED_PATH)}`);
console.log(`  ${path.relative(ROOT, SVG_PATH)}`);
console.log(`  ${path.relative(ROOT, PNG_PATH)}`);

function validateScene(scene) {
  if (
    scene.type !== "excalidraw" ||
    scene.version !== 2 ||
    !Array.isArray(scene.elements)
  ) {
    throw new Error("Source is not a version 2 Excalidraw scene");
  }

  const nodes = scene.elements
    .filter((element) => element.customData?.roadmap?.kind === "issue")
    .map((element) => {
      const roadmap = element.customData.roadmap;
      if (!Number.isInteger(roadmap.issueNumber) || roadmap.issueNumber < 1) {
        throw new Error(
          `Invalid issue number on node ${roadmap.nodeId ?? element.id}`,
        );
      }
      if (!roadmap.nodeId || !roadmap.label || !roadmap.url) {
        throw new Error(
          `Incomplete roadmap metadata on issue ${roadmap.issueNumber}`,
        );
      }
      return { element, ...roadmap };
    });

  if (nodes.length === 0) {
    throw new Error("The source diagram contains no roadmap issue nodes");
  }

  const nodeIds = new Set();
  const issueNumbers = new Set();
  for (const node of nodes) {
    if (nodeIds.has(node.nodeId))
      throw new Error(`Duplicate roadmap node ${node.nodeId}`);
    if (issueNumbers.has(node.issueNumber))
      throw new Error(`Duplicate issue #${node.issueNumber}`);
    nodeIds.add(node.nodeId);
    issueNumbers.add(node.issueNumber);
  }

  const edges = scene.elements
    .filter((element) => element.customData?.roadmap?.kind === "dependency")
    .map((element) => ({ element, ...element.customData.roadmap }));
  const edgeKeys = new Set();
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(
        `Dependency ${edge.from} -> ${edge.to} references a missing node`,
      );
    }
    if (edge.from === edge.to)
      throw new Error(`Dependency ${edge.from} points to itself`);
    const key = `${edge.from}->${edge.to}`;
    if (edgeKeys.has(key)) throw new Error(`Duplicate dependency ${key}`);
    edgeKeys.add(key);
  }

  const adjacency = new Map(nodes.map((node) => [node.nodeId, []]));
  for (const edge of edges) adjacency.get(edge.from).push(edge.to);
  const visiting = new Set();
  const visited = new Set();
  const visit = (nodeId) => {
    if (visiting.has(nodeId))
      throw new Error(`Dependency cycle includes ${nodeId}`);
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId)) visit(next);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const node of nodes) visit(node.nodeId);

  return { nodes, edges };
}

async function fetchIssueStates(nodes) {
  const repository = process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "marka-roadmap-renderer",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const entries = await Promise.all(
    nodes.map(async (node) => {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/issues/${node.issueNumber}`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(
          `GitHub issue #${node.issueNumber} lookup failed: HTTP ${response.status}`,
        );
      }
      const issue = await response.json();
      if (issue.pull_request)
        throw new Error(`#${node.issueNumber} is a pull request, not an issue`);
      if (issue.state !== "open" && issue.state !== "closed") {
        throw new Error(
          `#${node.issueNumber} returned unsupported state ${issue.state}`,
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
    if (!roadmap?.nodeId || !states.has(roadmap.nodeId)) return element;

    const state = states.get(roadmap.nodeId);
    const isClosed = state === "closed";
    const next = {
      ...element,
      customData: {
        ...element.customData,
        roadmap: { ...roadmap, status: state },
      },
    };
    if (isClosed && roadmap.kind === "issue") {
      next.opacity = 48;
      next.strokeColor = NEUTRAL_STROKE;
    }
    if (isClosed && roadmap.kind === "label") {
      next.opacity = 62;
      next.strokeColor = NEUTRAL_TEXT;
    }
    return next;
  });

  for (const node of nodes) {
    if (states.get(node.nodeId) !== "closed") continue;
    const rect = node.element;
    generated.elements.push({
      ...baseElement(
        `${node.nodeId}-complete`,
        "text",
        rect.x + rect.width - 54,
        rect.y + 12,
        32,
        32,
      ),
      text: "✓",
      originalText: "✓",
      fontSize: 24,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: NEUTRAL_TEXT,
      customData: {
        roadmap: {
          kind: "completion-marker",
          nodeId: node.nodeId,
          status: "closed",
        },
      },
    });
    generated.elements.push({
      ...baseElement(
        `${node.nodeId}-strike`,
        "line",
        rect.x + 26,
        rect.y + rect.height / 2,
        rect.width - 52,
        0,
      ),
      strokeColor: NEUTRAL_STROKE,
      strokeWidth: 3,
      points: [
        [0, 0],
        [rect.width - 52, 0],
      ],
      customData: {
        roadmap: {
          kind: "completion-strike",
          nodeId: node.nodeId,
          status: "closed",
        },
      },
    });
  }

  return generated;
}

function renderSvg({ nodes, edges }, states) {
  const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" role="img" aria-labelledby="title description">`,
  );
  parts.push('<title id="title">Marka file support roadmap</title>');
  parts.push(
    '<desc id="description">A top-to-bottom dependency roadmap for Marka issues 55 and 62 to 69.</desc>',
  );
  parts.push(
    `<rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#ffffff"/>`,
  );
  parts.push(
    `<text x="90" y="72" font-family="Inter, ui-sans-serif, sans-serif" font-size="34" font-weight="700" fill="#212529">Marka file support roadmap</text>`,
  );
  parts.push(
    `<text x="90" y="110" font-family="Inter, ui-sans-serif, sans-serif" font-size="18" fill="#868e96">Downward arrows show prerequisites. Colors show tracks. Checkmarks and strikethrough show closed issues.</text>`,
  );

  parts.push(
    `<rect x="55" y="270" width="1220" height="955" rx="28" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2" stroke-dasharray="10 10"/>`,
  );
  parts.push(
    `<text x="90" y="315" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#495057">PRODUCT DELIVERY</text>`,
  );
  parts.push(
    `<rect x="1305" y="270" width="440" height="510" rx="28" fill="#fffaf0" stroke="#ffe8cc" stroke-width="2" stroke-dasharray="10 10"/>`,
  );
  parts.push(
    `<text x="1340" y="315" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#995c00">OPERATIONS AND RELEASE</text>`,
  );

  for (const edge of edges) {
    const from = nodeMap.get(edge.from).element;
    const to = nodeMap.get(edge.to).element;
    parts.push(renderArrow(from, to));
  }

  const parent = nodeMap.get("issue-55");
  if (parent) parts.push(renderNode(parent, states.get(parent.nodeId), true));
  for (const node of nodes.filter((node) => node.nodeId !== "issue-55")) {
    parts.push(renderNode(node, states.get(node.nodeId), false));
  }

  parts.push(renderLegend());
  parts.push("</svg>");
  return parts.join("\n");
}

function renderNode(node, state, isParent) {
  const roadmap = node.element.customData.roadmap;
  const { x, y, width, height } = node.element;
  const closed = state === "closed";
  const fill = closed ? roadmap.fill : roadmap.fill;
  const fillOpacity = closed ? 0.42 : 1;
  const stroke = closed ? NEUTRAL_STROKE : roadmap.stroke;
  const text = closed ? NEUTRAL_TEXT : roadmap.text;
  const title = escapeXml(roadmap.label);
  const lines = title.split("\n");
  const lineHeight = isParent ? 34 : 28;
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2 + 9;
  const lineNodes = lines
    .map(
      (line, index) =>
        `<tspan x="${x + width / 2}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`,
    )
    .join("");
  const linkStart = `<a xlink:href="${escapeXml(roadmap.url)}" href="${escapeXml(roadmap.url)}" target="_blank">`;
  const linkEnd = "</a>";
  const check = closed
    ? `<text x="${x + width - 34}" y="${y + 36}" text-anchor="middle" font-family="Inter, ui-sans-serif, sans-serif" font-size="24" font-weight="700" fill="${NEUTRAL_TEXT}">✓</text>`
    : "";
  const strike = closed
    ? `<line x1="${x + 26}" y1="${y + height / 2}" x2="${x + width - 26}" y2="${y + height / 2}" stroke="${NEUTRAL_STROKE}" stroke-width="3" stroke-linecap="round"/>`
    : "";
  return `${linkStart}<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="3"/><text x="${x + width / 2}" y="${startY}" text-anchor="middle" font-family="Inter, ui-sans-serif, sans-serif" font-size="${isParent ? 28 : 22}" font-weight="${isParent ? 700 : 600}" fill="${text}">${lineNodes}</text>${check}${strike}${linkEnd}`;
}

function renderArrow(from, to) {
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height;
  const endX = to.x + to.width / 2;
  const endY = to.y;
  const bend = Math.max(50, (endY - startY) * 0.42);
  const d = `M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`;
  return `<path d="${d}" fill="none" stroke="${ARROW_STROKE}" stroke-width="3" stroke-linecap="round" marker-end="url(#arrowhead)"/>`;
}

function renderLegend() {
  return `<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${ARROW_STROKE}"/></marker></defs><g transform="translate(1335 830)"><text x="0" y="0" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" font-weight="700" fill="#495057">LEGEND</text><rect x="0" y="24" width="30" height="22" rx="6" fill="#a5d8ff" stroke="#228be6" stroke-width="2"/><text x="44" y="41" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" fill="#495057">Foundation</text><rect x="0" y="58" width="30" height="22" rx="6" fill="#96f2d7" stroke="#087f5b" stroke-width="2"/><text x="44" y="75" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" fill="#495057">Media</text><rect x="0" y="92" width="30" height="22" rx="6" fill="#d0bfff" stroke="#6741d9" stroke-width="2"/><text x="44" y="109" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" fill="#495057">Reader</text><rect x="0" y="126" width="30" height="22" rx="6" fill="#ffd8a8" stroke="#e8590c" stroke-width="2"/><text x="44" y="143" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" fill="#495057">Operations</text><line x1="0" y1="178" x2="30" y2="178" stroke="${NEUTRAL_STROKE}" stroke-width="3"/><text x="44" y="184" font-family="Inter, ui-sans-serif, sans-serif" font-size="16" fill="#495057">Closed issue</text></g>`;
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
    roughness: 0,
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

function escapeXml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
}

export { validateScene };
