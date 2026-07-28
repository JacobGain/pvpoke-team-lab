# PvPoke Asset Maintenance

TeamLab contains the PvPoke-derived data and classic JavaScript modules it
uses at runtime. Development, browser tests, production builds, and deployed
applications therefore run without Apache, PHP, Docker, or a second PvPoke
host.

## Runtime bundle

`public/vendor/pvpoke/` contains:

- the full and minified Game Master files;
- Open Great League overall rankings and the Great League meta group;
- the classic jQuery, GameMaster, Pokémon, Battle, action, timeline, and
  TeamRanker modules required by TeamLab simulations;
- PvPoke’s MIT license;
- a deterministic manifest with the data version, byte sizes, source paths,
  and SHA-256 hashes.

The full Game Master payload is preserved. New Pokémon, forms, moves, cups,
and move changes are not projected into a TeamLab-specific format. The
ranking and group files are likewise copied byte-for-byte for TeamLab’s
currently supported Open Great League format.

## Refresh from upstream

Update the upstream checkout normally, then run from `team-lab/`:

```bash
npm run sync:pvpoke
npm run validate:data
npm test
npm run test:browser
npm run build
```

The default source is the sibling `../src` directory. Another PvPoke checkout
can be used without changing configuration files:

```bash
PVPOKE_SOURCE_DIR=/absolute/path/to/pvpoke/src npm run sync:pvpoke
```

The sync process reads and validates every required source file before writing
the TeamLab bundle. It overwrites the generated copies in place, writes a new
manifest, and never writes to the upstream checkout.

When the Game Master introduces new species or forms, follow the data sync
with `npm run sync:sprites` to refresh TeamLab’s local artwork manifest.

## Adding another format

Before exposing another cup or league in the UI:

1. add its ranking and group paths to `scripts/sync-pvpoke-assets.ts`;
2. add the corresponding typed model/configuration;
3. extend validation and catalog tests;
4. run the full refresh and validation sequence above.

Keeping the file allowlist explicit prevents the deployment bundle from
silently growing to include PvPoke datasets that TeamLab cannot use.

## Deployment contract

The Vite build copies `public/vendor/pvpoke/` into `dist/vendor/pvpoke/`.
All data and engine URLs are resolved beneath Vite’s configured base path, so
subpath deployments only need `VITE_BASE_PATH`. No PvPoke URL, reverse proxy,
or second service is part of the runtime configuration.

PvPoke attribution remains in TeamLab’s footer, and the redistributed source
license is included at `public/vendor/pvpoke/LICENSE`.
