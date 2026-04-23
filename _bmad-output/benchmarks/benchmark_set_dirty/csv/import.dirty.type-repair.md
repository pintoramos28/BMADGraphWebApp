## import.dirty.type-repair

- Source kind: CSV file
- Scale: 3 data rows x 2 columns
- Expected preview behavior: mark `Reading` as a mixed-type column, require an explicit type confirmation, and remove the block once the user chooses the intended column type.
- Target story coverage: ambiguous type confirmation, structured issue-backed repair cards, and confirm gating before canonical mutation.
