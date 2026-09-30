# Release v0.0.2

## Standalone TeamLab app
- Separated TeamLab's application, data adapters, and runtime assets from the upstream PvPoke site so the project can run as its own app.
- Bundled the allowlisted PvPoke data and simulation assets needed by TeamLab.
- Removed external battle and team-builder links that could not work inside the standalone app.

## Portable production builds
- Prepared a static production artifact with versioned release metadata and validation before deployment.
- Added browser checks for the production artifact and its deployed origin.
