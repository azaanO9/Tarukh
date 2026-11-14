# Architecture and maintenance

## Entry points and ownership

`app/page.tsx` lazily loads `MarsFreeRoam`. `static-app/main.tsx` uses the same entry for GitHub Pages. All query strings enter the same current exploration game.

| Area | Owner and contract |
| --- | --- |
| Setup, pause, atlas, inspection and retry dialogs | `ui/MarsFreeRoam.tsx`; owns presentation state and focus return, enables Mobile controls and mounts the world |
| Scene lifecycle and input | `ui/MarsWorld.tsx`; creates/disposes WebGL resources, drives animation, forwards controls to simulation and reports `View` updates |
| Walking, jumping and collisions | `game/navigation.ts`, `collision.ts`, `rockContact.ts`; pure helpers shared by rendering and tests |
| Crew rover | `game/roverVehicle.ts` owns kinematics, suspension contacts, incline resistance, Boost Mode drivetrain (capped at 50 km/h with 4.2 m/s^2 high torque, 3x drain), internal power cell, localized component damage (6 wheels, cabin roof), collision impact dynamics, dead-wheel mechanics (torque loss, drag, yaw pull) and EVA field repairs; `createBigRover.ts`, `roverWheelAssembly.ts` and `roverCockpit.ts` render the prepared vehicle, wheel joint sag/camber failure states and interior |
| Science rovers | `game/curiosityRover.ts` and `createCuriosityRover.ts` handle autonomous navigation/scanning; `createPerseveranceRover.ts` renders the historical landing marker |
| Terrain and map coordinates | `game/marsRegion.ts`, `terrainStreaming.ts`, `content/marsMolaData.ts` and `marsLandmarks.ts`; rendering and collision use the same height samples |
| Surface and distance rendering | `ui/world/marsTerrain.ts`, `streamedMars.ts`, `marsRegionalLandscape.ts`; shared materials, bounded tile pool and regional far surface |
| Atlas and field map | `ui/MarsAtlas.tsx`, `ExplorationMinimap.tsx`, `game/marsAtlas.ts`, `minimap.ts`; map selection stays in memory |
| Daylight and landing | `game/daylightCycle.ts`, `shuttleLanding.ts`; presentation timing consumed by the renderer |
| Quality selection | `game/autoGraphics.ts`, `backgroundGraphics.ts`, `ui/world/graphicsTiers.ts`; measured session-only selection with manual overrides |

`MarsWorld` reports inspection IDs, view/rover state, readiness, WebGL failure, terrain mode, atlas requests and graphics-calibration status through callbacks. `createMarsWorld.ts` creates the terrain and science-rover targets. There is no hidden mission, lunar or outpost mode in this renderer.

## Rendering and performance

The essential scene loads behind `ShuttleArrival`. Its `onReady` callback releases the cover immediately; the existing terrain landing follows. Auto starts light, prepares optional shaders after entry and samples ordinary animation frames. Each trial skips six settling frames and measures up to one second or 180 samples. A 43 FPS trial threshold provides headroom for the 40 FPS runtime target. Manual selection, pause dialogs, hidden/occluded tabs, preparation and unsettled resolution are excluded. There is no separate continuous benchmark render loop.

Auto can select Ultra on integrated graphics. Failed upgrades restore the best passing preset; slow Performance trials can lower render scale to 0.85, 0.70 or 0.55. The ongoing governor uses hysteresis and changes scale by at most 0.04 every 400 ms. Results are neither stored nor transmitted.

Performance uses an 800-metre far plane instead of 1100, no post-processing and fewer particles. It hides one outer terrain detail ring while retaining the generation pool and collision contacts. `createStreamedMars.coverage()` tells the regional surface which rectangle to omit. Recycled tiles, track pages and effect pools keep memory bounded during travel.

The FPS meter is an optional user feature, not a stray debug statement. `?debug=1` exposes detailed diagnostics; `sitePreview=perseverance` and `landingPreview=16.95` are controlled visual checkpoints that require `debug=1`. Ordinary links omit these parameters. Diagnostic DOM attributes include load time, calibration trials, active quality, render scale, terrain counts and view distance.

## Asset preparation and hosting

`lib/assetUrl.ts` prefixes shipped asset paths for both the Site origin and the `/Tarukh/` Pages subpath. Preserve it when changing loaders. Keep the Draco WASM and wrapper: the rover and astronaut loaders, asset-preparation checks and tests use them.

- `node scripts/prepare-mars-region.mjs` reproduces the local MOLA crop and WebP overview from the NASA PDS product. Downloads go to ignored `outputs/mola/`; none occur during gameplay.
- `node scripts/prepare-mars-surfaces.mjs <source-directory>` rebuilds credited Poly Haven derivatives from verified source maps and their manifest.
- `scripts/prepare-rover.mjs` documents its pinned offline glTF tools. It retains all source triangles while partitioning the wheels and removing unused texture copies.
- `node scripts/measure-rover-windows.mjs <tools-directory>` measures the seven glazing contours after checking the source asset hash. Re-measure if the source model changes.

The prepared GLBs and WebPs are checked in; ordinary install/build commands do not regenerate them. Required source models and their license notices are retained. Unused presentation images, old screenshots and unused template components were removed. See `ASSET_CREDITS.md` for attribution.

`vite.pages.config.ts` builds `dist-pages/`; the GitHub workflow publishes it and records `source_commit` in `version.json`. `vite.config.ts`, `worker/`, `db/`, `lib/connectors*` and `scripts/connector-preview/` support the separate Sites build. Their dependencies may be unused by the static game while still required by that integration. Do not remove them based solely on the active UI import graph.

## Persistence and shared systems

`game/curiositySave.ts` keeps the existing Curiosity storage key and validation. Previously stored rover state remains compatible. Removed mission saves are not read or erased. Returning to controls setup starts a new player/crew-rover session.

The renderer retains Mars locomotion, terrain contacts, rover simulation, all three rover models, landing, both cameras, touch controls, map/LiDAR, reduced-motion handling, quality selection and WebGL recovery. The original astronaut fallback and its materials live in `createFallbackAstronaut.ts` and `suitMaterials.ts`.

Terrain firmness zones still affect tint and wheel traction, so their coordinates remain in `marsTerrain.ts` without station definitions or mission data. `openWorldRegression.test.mjs` compares visible geometry, 469 rock colliders, height/traction samples and a seeded Curiosity trajectory with the release before retirement.

## Validation

Run the commands in `README.md`. Unit tests cover simulation, terrain seams, collisions, rover contacts/rigging, camera geometry, streaming, graphics selection, maps and landing. Tests specific to deleted modes were removed; shared vehicle tests now use shuttle and terrain obstacles.

ESLint excludes generated build directories and the vendored Draco decoder. Existing React lifecycle and hook-dependency findings remain in the active entry and renderer. Changing initialization, refs or effect dependencies can alter behavior, so those findings need a separately scoped change rather than rule suppression or a mechanical rewrite. A failing lint check must be reported honestly.

Browser smoke checks should cover PC and Mobile entry, landing/skip, movement and jump, camera switching, rover entry/driving/cockpit/exit, atlas open/close, pause/resume, quality changes and WebGL retry. Check asset requests and the console. Desktop viewport emulation is not a physical-phone performance test.
