# Content support and derived transcript boundaries

Status: accepted

For the #55 file-support roadmap, #62 remains a standalone foundation issue. It defines one support contract and fixes current mismatches between upload validation, top-level bookmarks, attachments, previews, readers, and cleanup, but it does not add new first-class media or document types. Top-level content, attachments, and raw downloadable assets remain distinct promises.

YouTube caption support is separate from #62. A saved YouTube URL is a YouTube link bookmark with asynchronously derived caption transcript content and a separately generated transcript summary. The transcript model should be provider-neutral so later media transcription for uploaded audio and video can reuse it. Transcript ingestion belongs in a new child issue under #55, while focused-reader presentation belongs in #66. Uploaded audio and video transcription remains later work after #64 and #65.

This split keeps #62 small and independently shippable, allows text and media work to proceed in parallel after the contract lands, preserves the distinction between source text and generated summaries, and avoids coupling upload validation to provider-specific media processing.

## Current format matrix

| Format | User upload | Top-level bookmark | Attachment | Preview or reader promise | Raw download |
| --- | --- | --- | --- | --- | --- |
| Image | Yes | Yes, image preview | Yes | Complete for top-level image bookmarks | Yes |
| PDF | Yes | Yes, PDF preview | Yes | Complete for top-level PDF bookmarks | Yes |
| Markdown | Yes, converted to a text bookmark | Yes, text reader | No asset attachment | Complete through the text bookmark path | N/A |
| Video | Yes, attachment only | No, rejected before upload | Yes, generic or video attachment | Raw attachment only until #64 and later reader work | Yes |
| HTML | Yes, attachment only | No, rejected before upload | Yes, generic or precrawled attachment | Raw attachment only, with existing link/archive paths remaining separate | Yes |
| ZIP | No | No | No | No preview or reader | Yes, internal asset use |

The attachment column does not imply playback, focused reading, or a dedicated renderer. Generic uploaded attachments are downloadable raw assets unless a later issue adds the corresponding surface.
