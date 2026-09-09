# 1.0.1 — Mobile fixes and visual identity

TeamLab 1.0.1 fixes Pokémon selection from the Add Pokémon autocomplete on
touch devices, including iPhone Safari.

On touch browsers, moving focus away from the search field could close the
suggestion list before the delayed click event selected the tapped result.
Suggestions now select during the touch pointer press while mouse and keyboard
activation retain their existing behavior.

The app now uses a theme-matched TeamLab mark in its navigation, footer, and
browser tab. The interface also displays its release version, sourced directly
from the build metadata, and production raster assets are validated as WebP.

Security hardening adds an RFC 9116 `security.txt`, a private GitHub disclosure
channel, explicit caching rules, and production validation for the disclosure
metadata. Backup exports now use compact JSON, and files larger than 10 MiB are
rejected before being read or parsed.

The IndexedDB schema advances to version 3 to remove unused secondary indexes,
reducing storage and write amplification. The migration preserves existing
inventory and saved teams, and the portable backup schema remains unchanged.
