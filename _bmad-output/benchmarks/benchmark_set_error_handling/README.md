## Import Error-Handling Regression Fixtures

This fixture family expands beyond the Story 2.2 canonical dirty benchmarks. It is intended for manual and automated regression tests that need deterministic examples of every import failure or repair-gating path currently owned by the import preview workflow.

Use these files to verify that failures remain localized to preview/import state, that `Confirm Import` stays disabled while blocking import issues are open, and that parse failures or rejected previews do not mutate the canonical workspace.

Detailed expected behavior for every fixture is in [`FAILURE-MATRIX.md`](./FAILURE-MATRIX.md).

### CSV fixtures

- `csv/import.error.empty-source.csv` — empty text source / no readable tabular text.
- `csv/import.error.delimiter-only.csv` — delimiter-only rows with no previewable data values.
- `csv/import.error.malformed-quote.csv` — malformed CSV quote parse failure.
- `csv/import.error.delimiter-ambiguous.csv` — competing delimiter signals requiring explicit delimiter confirmation.
- `csv/import.error.header-duplicate.csv` — duplicate header names requiring first-row confirmation.
- `csv/import.error.header-low-confidence.csv` — low-confidence first-row interpretation requiring confirmation.
- `csv/import.error.type-mixed-numeric.csv` — mixed numeric/text values requiring explicit numeric/text column type confirmation.
- `csv/import.error.type-mixed-date.csv` — mixed date/text values requiring explicit date/text column type confirmation.
- `csv/import.error.missing-and-malformed-values.csv` — missing cells plus malformed values once numeric/date types are confirmed.
- `csv/import.error.drop-policy-empty-result.csv` — drop-invalid repair can remove every row and must remain blocked.
- `csv/import.error.additional-columns-late.csv` — columns appear beyond the visible preview window and must be acknowledged before confirmation.
- `csv/import.error.composite-cascade.csv` — staged cascade of delimiter, header, type, and missing-value repairs.

### Paste fixtures

- `paste/import.error.pasted-missing-malformed.txt` — pasted-table variant of missing and malformed value handling.
