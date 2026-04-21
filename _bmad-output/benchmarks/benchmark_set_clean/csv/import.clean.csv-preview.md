## import.clean.csv-preview

- Source kind: CSV file
- Scale: 3 data rows x 3 columns
- Expected preview behavior: detect comma delimiter, detect a header row, infer `Reading` as numeric, and infer `MeasuredAt` as date.
- Target story coverage: local preview-only import and benchmark timing hooks without mutating committed workspace state.
