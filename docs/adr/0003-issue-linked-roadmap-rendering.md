# Issue-linked roadmap rendering

Status: accepted

## Context

Marka needs one public visual roadmap that shows the current full future-facing product and platform issue set while remaining editable in Excalidraw. GitHub Issues remain the source of truth for concrete work and state, while the diagram owns visual structure and dependency meaning.

## Decision

The authored source is docs/roadmap/roadmap.excalidraw. The initial single canvas contains the current scoped issues #25, #26, #28, #34, #37, #38, #46, #55, #62 to #69, #72 to #75, and #78. The source stores explicit issue metadata, stable node identities, links, colors, placement, area labels, and hard-prerequisite edges.

The roadmap flows from top to bottom. It uses a portrait-friendly layout with simple normal-case area labels: Content support, Reader and media, Collaboration, Public surfaces, and Platform and operations. A compact legend below the title maps authored fill colors to those areas; colors are grouping cues only, not status or priority. Grouping and visual spacing are containment only. An arrow means the source issue is a hard prerequisite for the destination issue.

The source uses Excalidraw's hand-drawn shapes and arrows with Excalifont text. Generated SVG and PNG outputs are exported through Excalidraw's own export APIs in a headless Chromium process. Generated outputs are roadmap.generated.excalidraw, roadmap.svg, and roadmap.png. The root README embeds the PNG and links the source and SVG.

GitHub open or closed state is the only automated status input. A closed issue's generated node uses the neutral gray done fill and border, while its issue number and title text become muted and receive text-only strikethrough, plus a small checkmark. The rectangle is never struck through. Reopening restores the open styling. Labels do not control status, color, or blocked state.

Pull request checks validate the source and deterministic generated outputs without committing, and verify that the platform-rendered PNG is non-empty. PNG bytes are not compared across runners because browser rasterization can vary by operating system. Synchronization renders after pushes to main, issue close or reopen events, and manual dispatch. It may commit only generated roadmap outputs and the marked README block. It never edits the authored source, skips empty commits, and fails without partial output when metadata, issue lookup, or rendering fails.

## Considered options

- Rewriting the authored Excalidraw file in CI was rejected because it would mix human layout changes with generated state.
- Automatically discovering and placing issues was rejected because scope, placement, and dependencies require human judgment.
- A custom flat SVG renderer was rejected because it loses Excalidraw's hand-drawn visual language.
- Using issue labels for colors or status was rejected because labels are not a stable visual contract.
- Using Now, Next, Later bands or dates was rejected because the full issue graph already communicates direction without adding a second planning model.
- Writing dependency relationships back to GitHub was deferred because the diagram is the visual dependency model while GitHub remains the issue-state source.

## Consequences

The README stays current after issue or merge events, and the editable source remains human-owned. Contributors must update the source when the roadmap scope, structure, labels, or dependencies change. Ordinary implementation PRs do not need diagram churn when the roadmap structure is unchanged. The current canvas is the only published view for now; historical snapshots, automatic layout, automatic issue discovery, and multiple canvases remain out of scope.
