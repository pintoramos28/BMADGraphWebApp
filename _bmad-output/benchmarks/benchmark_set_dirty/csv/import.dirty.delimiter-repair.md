## import.dirty.delimiter-repair

- Source kind: CSV file
- Scale: 3 data rows x 3 columns
- Expected preview behavior: detect a semicolon delimiter, block confirmation until the delimiter choice is explicitly confirmed, and preserve the repaired preview when the user accepts the detected delimiter.
- Target story coverage: delimiter ambiguity, worker-backed reparse, and confirm gating before canonical workspace mutation.
