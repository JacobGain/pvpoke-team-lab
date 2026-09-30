# Release v1.0.1

## Mobile selection and visual identity
- Fixed Pokémon selection from the Add Pokémon autocomplete on touch devices, including iPhone Safari.
- Added a theme-matched TeamLab mark to navigation, the footer, and the browser tab.
- Displayed the release version from build metadata and validated production raster assets as WebP.

## Data safety and security
- Added RFC 9116 disclosure metadata, explicit caching rules, and production validation for security files.
- Switched backup exports to compact JSON and rejected files larger than 10 MiB before parsing.
- Reduced IndexedDB storage and write amplification while preserving existing inventory and saved teams.
- Opened browser storage before the application becomes interactive to avoid first-save startup races.
