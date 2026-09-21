# TeamLab

[TeamLab](https://pvpoke-team-lab.pages.dev/) is a local-first Pokémon GO PvP
inventory and team-planning app for Great, Ultra, and Master League. Track exact
owned and planned builds, analyze IVs and teams, explore recommendations backed
by PvPoke simulations, and back up your data as JSON. Inventory and saved teams
stay in your browser.

TeamLab is the application developed in this repository. It uses data and the
battle engine from [PvPoke](https://github.com/pvpoke/pvpoke), whose source is
also retained here for upstream compatibility. See the [TeamLab guide](team-lab/README.md)
for the full development, deployment, and validation instructions.

## Run TeamLab

Requires Node.js 22.22 or newer on the 22.x line, or a supported newer line,
and npm 11 or newer.

```bash
cd team-lab
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). TeamLab uses
its checked-in PvPoke asset bundle and does not need the PHP site running.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`team-lab/`](team-lab/) | TeamLab app, tests, scripts, and documentation |
| [`team-lab/public/vendor/pvpoke/`](team-lab/public/vendor/pvpoke/) | Pinned PvPoke data and engine files used by TeamLab |
| [`src/`](src/) | Upstream PvPoke PHP site and source tree |
| [`docker/`](docker/) and [`Makefile`](Makefile) | Optional local setup for the upstream PHP site |

Keeping TeamLab in its own directory lets the PvPoke source tree retain its
upstream paths, which makes upstream merges easier to review. TeamLab's runtime
bundle has a separately pinned upstream revision; merging changes into `src/`
alone does not update the data or engine files that TeamLab serves. To update
that bundle, follow the [PvPoke asset maintenance guide](team-lab/docs/PVPOKE-DATA.md).

## Upstream PvPoke site

The PHP site can still be run from `src/` using the existing Docker setup:

```bash
make up
```

For its installation and development instructions, see the
[PvPoke wiki](https://github.com/pvpoke/pvpoke/wiki/Installation). PvPoke is
maintained by the [upstream project](https://github.com/pvpoke/pvpoke); its
source is licensed under the terms in [`LICENSE`](LICENSE).
