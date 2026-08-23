# YouTube transcript provenance and summary ownership

Status: accepted

Marka keeps one bookmark summary. For YouTube links, the selected caption transcript is the summary input rather than a second transcript-specific summary. The transcript preserves a provider-derived source transcript and a user-editable working transcript, while raw subtitle artifacts are retained as system-managed source attachments so manual edits do not destroy provenance. Refreshes replace the current provider artifacts without overwriting manual transcript edits; an explicit reset may restore the latest source. This keeps the model reusable for later audio and video transcription without confusing multiple summaries.

Offset-based highlights and reading progress carry the working transcript revision. Reader clients must not apply those offsets to a different revision, while ordinary page highlights and progress remain revisionless.

## Considered options

- A separate transcript summary was rejected because it would create two competing user-facing summaries.
- Storing only the editable transcript was rejected because it would lose the provider source and make reset or provenance impossible.
- Keeping source text only in the database was rejected because users should be able to download the original caption artifacts.
