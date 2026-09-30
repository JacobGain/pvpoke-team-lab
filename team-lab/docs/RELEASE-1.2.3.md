# Release v1.2.3

## CSV inventory import
- Import exact current builds from a downloadable TeamLab CSV template, with row-by-row validation and a preview before saving.
- Review rows with species, CP, IV, or move errors before importing valid builds.
- Exact build matches are flagged as possible duplicates and skipped by default; users can choose to include them.
- CSV files are read locally in the browser. Missing values are not filled with assumed builds, and existing records are never overwritten.
