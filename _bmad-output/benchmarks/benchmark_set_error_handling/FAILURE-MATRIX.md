# Import Error-Handling Fixture Matrix

These datasets are regression inputs for the import preview and repair workflow. They intentionally include invalid, ambiguous, or incomplete data. They are not benchmark-owned Story 2.2 fixtures, so tests should not expect a clean/dirty benchmark badge unless a test explicitly wires a benchmark scenario.

Global regression assertions for every fixture:

1. Source selection alone must not add a canonical dataset.
2. `Confirm Import` must be disabled while any blocking import issue is open.
3. Parse failures must surface as import action errors, not crash the route.
4. `Reject Import` or a failed parse must leave the canonical workspace dataset count unchanged.
5. Once the documented repairs are applied, confirmable fixtures should commit through `WorkspaceKernel` and show `Preview confirmed. The canonical workspace now reflects this imported dataset.`

## Fixture details

| Fixture | Failure category | Expected failure / issue | Regression repair path |
| --- | --- | --- | --- |
| `csv/import.error.empty-source.csv` | Text source validation | Import fails before preview with `The selected import source did not contain readable tabular text.` | No repair card. Select a valid source. Canonical dataset count remains unchanged. |
| `csv/import.error.delimiter-only.csv` | No previewable rows | Import fails after parsing because rows contain delimiters but no data values. Expected message: `The selected source did not contain any previewable data rows after normalization.` | No repair card. Select a source with real values. Canonical dataset count remains unchanged. |
| `csv/import.error.malformed-quote.csv` | Fatal CSV parse error | Parser should reject the malformed quoted field and show an import failure. Exact parser wording may come from Papa Parse, but the route must remain usable. | No repair card. Select a syntactically valid CSV. Canonical dataset count remains unchanged. |
| `csv/import.error.delimiter-ambiguous.csv` | Delimiter ambiguity | Blocking issue `issue_import_delimiter_confirmation`; title `Confirm the delimiter before import`; delimiter confidence is not high. | Choose `Semicolon (;)` to split the file into `Sample`, `Reading`, and `MeasuredAt`; then confirm. |
| `csv/import.error.header-duplicate.csv` | Duplicate first-row headers | Blocking issue `issue_import_header_confirmation`; title `Confirm how the first row should be interpreted`; diagnostics should include duplicate `Value`. | Choose either first-row option. `Treat the first row as headers` keeps duplicate-name risk visible; `Treat the first row as data` converts the first row into data with generic columns. Confirm should remain gated until the selected interpretation is applied. |
| `csv/import.error.header-low-confidence.csv` | Low-confidence header detection | Blocking issue `issue_import_header_confirmation`; first row is ambiguous because it mixes a label-like value with data-like values. | Choose `Treat the first row as headers` if `Sample` / `42.5` / `2026-04-18` are intended as labels, or `Treat the first row as data` if they are an observation. Confirm after the reparse. |
| `csv/import.error.type-mixed-numeric.csv` | Mixed numeric/text column | Blocking issue `issue_import_type_col_2`; title `Confirm the data type for Reading`; `Reading` mixes numeric values with `not recorded`. | Choose `Text` to preserve the literal value, or choose `Numeric` and then choose a missing-value policy for the malformed row. |
| `csv/import.error.type-mixed-date.csv` | Mixed date/text column | Blocking issue for `MeasuredAt` (`issue_import_type_col_2` when this is the second column); column mixes parseable dates with `pending`. | Choose `Text` to preserve `pending`, or choose `Date` and then choose a missing-value policy for the malformed date. |
| `csv/import.error.missing-and-malformed-values.csv` | Missing and malformed value policy | Initial preview should require type confirmation for mixed columns. After confirming `Reading` as `Numeric` and `MeasuredAt` as `Date`, blocking issue `issue_import_missing_value_policy` should report missing and malformed cells. | Choose `Keep rows and mark missing or malformed cells as empty` to retain row count, or `Exclude rows with missing or malformed values` to keep only valid rows. |
| `csv/import.error.drop-policy-empty-result.csv` | Invalid drop policy result | `Reading` first appears as a mixed numeric/text column. After deliberately confirming `Reading` as `Date` and choosing `Exclude rows with missing or malformed values`, blocking issue `issue_import_missing_value_policy_empty-result`; title `This repair would remove every row from the import`. | Switch `Reading` to `Text`, or switch missing-value handling to `Keep rows and mark missing or malformed cells as empty`; confirm only after the empty-result blocker clears. |
| `csv/import.error.additional-columns-late.csv` | Additional columns outside visible preview | Blocking issue `issue_import_additional_columns_confirmation`; title `Confirm the columns that appear outside the visible preview`. This fixture also has missing cells for the late column in earlier rows, so a missing-value policy may also be required. | Acknowledge the additional `LateReading` column, choose a missing-value policy, then confirm. Regression tests should verify that late columns do not silently enter the confirmed dataset. |
| `csv/import.error.composite-cascade.csv` | Multi-stage cascade | First blocks on delimiter ambiguity. After delimiter repair, duplicate headers, mixed type, and missing/malformed policies may appear. | Apply repairs in order: delimiter `Semicolon (;)`, first-row handling, column type for the reading column, then missing-value handling. Confirm only after all blockers are resolved. |
| `paste/import.error.pasted-missing-malformed.txt` | Pasted-table missing/malformed policy | Pasted tabular data should follow the same issue path as CSV: type confirmation for `Reading`, then missing/malformed policy once numeric is confirmed. | Paste the text, preview it, select a type for `Reading`, choose a missing-value policy, then confirm or reject. |

## Suggested automated regression shape

For each fixture, an end-to-end test can follow this pattern:

1. Navigate to `/workspace?workspaceFormatVersion=1.0.0`.
2. Capture the visible `Canonical datasets` count.
3. Load the fixture through the matching intake path.
4. Assert the expected error text or blocking issue title from the table.
5. Assert canonical dataset count is unchanged before repair.
6. If a repair path exists, apply the documented selections and assert blockers clear.
7. Confirm the import and assert canonical dataset count increments by one.
8. For parse-failure fixtures, assert the route remains interactive by loading a clean fixture afterward.
