## import.dirty.missing-value-repair

- Source kind: CSV file
- Scale: 3 source rows x 2 columns
- Expected preview behavior: detect missing numeric values, block confirmation until the user chooses a missing-value policy, and re-run the preview with either empty-cell retention or invalid-row removal.
- Target story coverage: missing-value policy selection, worker-backed repair application, and reject-or-confirm behavior before canonical commit.
