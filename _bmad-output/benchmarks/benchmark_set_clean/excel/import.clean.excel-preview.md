## import.clean.excel-preview

- Source kind: Excel workbook
- Scale: 3 data rows x 3 columns on the first worksheet
- Expected preview behavior: treat workbook cells as delimiter-free, detect a header row, infer `Reading` as numeric, and infer `MeasuredAt` as date.
- Target story coverage: worker-based workbook parsing from `ArrayBuffer` and preview-only normalization for local Excel imports.
