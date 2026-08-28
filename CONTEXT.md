# Marka Content Context

This glossary defines the content terms used by Marka's bookmark library and its focused viewing surfaces.

## Content model

**Bookmark type**:
A top-level classification of a bookmark as a link, text, asset, or unknown content.
_Avoid_: making media or Office files separate top-level bookmark types.

**Asset subtype**:
The format-specific classification of an asset bookmark, such as image, PDF, video, or audio.
_Avoid_: treating an asset subtype as a new bookmark type.

**Text format**:
The authoring format of a text bookmark, either Markdown or plain text.
_Avoid_: assuming every text bookmark is Markdown.

## Viewing surfaces

**Preview**:
The general bookmark surface that selects the appropriate viewer for links, text, images, PDFs, video, and audio.
_Avoid_: using Preview and Reader View as synonyms.

**Reader View**:
A focused, read-only surface for readable cached HTML, Markdown, and plain-text content.
_Avoid_: using Reader View for binary media or Office editing.

**Office View**:
A future provider-backed surface for full-fidelity Office document viewing, separate from the derived Reader View representation.
_Avoid_: making a viewing provider part of the core bookmark content model.
