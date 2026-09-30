# Release Notes Workflow

## Source of truth

Each release is recorded in `docs/RELEASE-X.Y.Z.md`. The site imports these
files into the **Release notes** page linked from the global footer. The page
checks that each filename matches its heading and sorts versions numerically
from newest to oldest, so `0.0.10` appears above `0.0.9` without a manually
maintained index.

## Adding a release

For each release:

1. Complete the normal version and release-metadata updates.
2. Add `docs/RELEASE-X.Y.Z.md` for the exact release version.
3. Use a release heading, a subheading for each change group, and bullets for
   the user-visible changes:

   ```md
   # Release vX.Y.Z

   ## Feature name
   - Explain what changed for the user.
   - Call out an important behavior or compatibility detail.

   ## Another change group
   - Summarize related fixes or improvements.
   ```

4. Prefer clear product language. Group related changes together and omit
   routine implementation details that do not affect users.
5. Check that the filename and heading versions match and that every group has
   at least one bullet. The release page rejects malformed or duplicate notes.
6. Run the release-notes parser test, TypeScript check, and production build.
   Open `/releases` from the footer at desktop and narrow mobile widths before
   merging.

No route registry or release-order list needs manual edits. The page discovers
each versioned markdown file and displays the latest release first. Use the
actual semantic version; do not sort release filenames as plain text.

## Historical version reconciliation

The archive starts with the `0.0.1/humble-beginnings` branch, although its
early scaffold manifest used `0.1.0` before the standalone version sequence was
established. The `0.0.6/upstream-refresh` branch retained `0.0.5` in its
manifest, so its upstream refresh is recorded retrospectively as `0.0.6` to
preserve the intended branch sequence. The UI-update branch was named
`0.11.0/ui-updates` after `0.0.9` and immediately before `1.0.0`; this archive
corrects that apparent versioning jump to `0.0.10`.
