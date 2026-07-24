# TeamLab

TeamLab is the fork-owned inventory and team-planning application built on top
of PvPoke data and simulation logic.

## Requirements

- Node.js 22.12 or newer
- npm 11 or newer

## Development

```bash
npm install
npm run dev
```

Run commands from the `team-lab/` directory.

TeamLab reads the existing PvPoke data through `/pvpoke/src` by default. During
development, Vite proxies that path to `http://localhost`. Copy `.env.example`
to `.env.local` if either path differs in your environment.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

Product scope and architectural decisions are documented in
[`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md).

Actual implementation progress, file ownership, decisions, validation, and
known limitations are tracked in
[`docs/implementation/README.md`](docs/implementation/README.md).
