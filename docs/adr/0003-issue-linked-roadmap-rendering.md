# Issue-linked roadmap rendering

Status: accepted

The #55 file-support roadmap needs to remain understandable as work progresses without turning every issue update into a manual diagram edit. The roadmap is therefore a human-authored Excalidraw dependency canvas whose generated status projection is synchronized from GitHub issue state.

## Decision

The authored source is `docs/roadmap/roadmap.excalidraw`. It contains explicit issue-node metadata, stable node identities, and dependency relationships. The initial canvas covers #55 and the current roadmap issues #62 to #69. Arrows point from prerequisites to dependent issues; containment of a child issue under #55 is not itself a dependency.

The renderer produces `roadmap.generated.excalidraw`, `roadmap.svg`, and `roadmap.png` under `docs/roadmap/`. The root README embeds the PNG inside a marked Roadmap section and links to the SVG and editable source. Generated files and that marked README block are bot-owned. The authored source, node placement, track colors, labels, and dependency layout remain human-owned.

GitHub issue state is the only automated status input. Closed issues retain a faint version of their authored track color and receive neutral styling, a checkmark, and strikethrough. Reopened issues return to their open styling. Labels do not control colors or lifecycle state, and dependent issues do not receive derived blocked styling.

Pull request validation renders in check-only mode. The synchronization workflow renders and commits only generated outputs after pushes to `main`, issue close or reopen events, and manual dispatches. It uses read access to issues and write access to repository contents, never edits the authored source, skips empty commits, and fails without partial output when validation or issue lookup fails. Generated output contains no timestamps.

## Considered options

- Rewriting the authored Excalidraw file in CI was rejected because it would mix human layout changes with generated state and risk overwriting work.
- Automatically discovering and placing every GitHub issue was rejected because issue placement, scope, and dependencies require human judgment.
- Using issue labels for colors or status was rejected because labels are not a stable visual contract for this roadmap.
- Writing dependency relationships back to GitHub was deferred because the diagram is the roadmap model while GitHub remains the issue-state source.

## Consequences

The README stays current after issue or merge events, while the source diagram remains stable and editable. Contributors must update the source when roadmap structure changes, but ordinary implementation PRs do not need diagram churn. The current board is the only published view for v1; Git history provides the change history, and automatic layout, issue discovery, historical snapshots, and multiple canvases remain out of scope.
