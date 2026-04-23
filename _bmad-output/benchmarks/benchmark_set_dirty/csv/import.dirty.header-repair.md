## import.dirty.header-repair

- Source kind: CSV file
- Scale: 3 data rows x 2 columns after header confirmation
- Expected preview behavior: keep first-row handling blocked until the user confirms whether the duplicate first row is header metadata or data, then rebuild the preview with the selected interpretation.
- Target story coverage: header confirmation, inline repair controls, and confirm gating before import commit.
