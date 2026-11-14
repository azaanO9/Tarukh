# Repository guidance

Read `README.md`, `docs/INTERFACE.md` and `ASSET_CREDITS.md` before editing.

## Scope and boundaries

- `app/page.tsx` loads `ui/MarsFreeRoam.tsx`. Legacy mode query strings reach the same exploration setup.
- Preserve current gameplay, assets, controls, UI, physics, animations and visuals unless the user explicitly requests a behavior change.
- Only Mars free exploration ships. Mission, quiz, survival, story, lunar, Sage, cave/portal and weather-terminal systems were retired. Do not restore them without an explicit user request.
- Keep simulation and state rules in `game/`, authored content and references in `content/`, and rendering/interface code in `ui/`.
- Distinguish scientific sources from gameplay assumptions. Keep references in `docs/SOURCES.md`, numerical simplifications in `docs/ASSUMPTIONS.md` and attribution in `ASSET_CREDITS.md`. Do not imply NASA endorsement.

## Working practices

- Inspect Git status and preserve uncommitted work and teammate changes. Use focused commits; do not force-push or rewrite shared history.
- Keep changes small. Confirm references before removing files, public exports or assets. Preserve vendored sources and license notices.
- Preserve `vite.config.ts`, the Sites integration, `.openai/hosting.json` identity, the Pages build and environment configuration. Do not introduce a backend, telemetry or dependencies without a requirement.
- Preserve keyboard access, visible focus, touch controls, reduced-motion support and WebGL fallbacks.
- Do not suppress lint findings merely to obtain a clean result. Lifecycle changes need explicit scope and gameplay verification.

## Validation

Run `pnpm test`, `pnpm typecheck`, `pnpm build` and `pnpm build:pages`. Run `pnpm lint` and report existing findings separately from regressions. Test the actual browser flow and narrow layouts for interface/rendering changes. Do not claim checks that were not performed.

When changing a contract, update `docs/INTERFACE.md`. Report changed files, validation, the exact published revision when applicable, and remaining limitations. This repository starts from a migrated project snapshot; earlier development history was not imported. Keep current documentation concise.
