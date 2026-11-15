# Architecture and maintenance

## Entry points and ownership

`app/page.tsx` lazily loads `MarsFreeRoam`. `static-app/main.tsx` uses the same entry for GitHub Pages. All query strings enter the same current exploration game.

| Area | Owner and contract |
| --- | --- |
| Setup, pause, atlas, inspection and retry dialogs | `ui/MarsFreeRoam.tsx`; owns presentation state and focus return, enables Mobile controls and mounts the world |
| Scene lifecycle and input | `ui/MarsWorld.tsx`; creates/disposes WebGL resources, drives animation, forwards controls to simulation and reports `View` updates |
| Walking, jumping and collisions | `game/navigation.ts`, `collision.ts`, `rockContact.ts`; pure helpers shared by rendering and tests |
| Crew rover | `game/roverVehicle.ts` owns kinematics, suspension contacts, incline resistance, Boost Mode drivetrain (capped at 50 km/h with 4.2 m/s^2 high torque, 3x drain), installed roof solar array with active daytime battery charging, internal power cell, localized component damage (6 wheels, cabin roof/solar array), collision impact dynamics, dead-wheel mechanics (torque loss, drag, yaw pull) and EVA field repairs; `ui/MarsWorld.tsx` renders live HUD solar charging diagnostics and telemetry; `createBigRover.ts`, `roverWheelAssembly.ts` and `roverCockpit.ts` render the prepared vehicle, wheel joint sag/camber failure states and interior |
| Science rovers | `game/curiosityRover.ts` and `createCuriosityRover.ts` handle autonomous navigation/scanning; `createPerseveranceRover.ts` renders the historical landing marker |
| Terrain and map coordinates | `game/marsRegion.ts`, `terrainStreaming.ts`, `content/marsMolaData.ts` and `marsLandmarks.ts`; rendering and collision use the same height samples |
| Surface and distance rendering | `ui/world/marsTerrain.ts`, `streamedMars.ts`, `marsRegionalLandscape.ts`; shared materials, bounded tile pool and regional far surface |
| Atlas and field map | `ui/MarsAtlas.tsx`, `ExplorationMinimap.tsx`, `game/marsAtlas.ts`, `minimap.ts`, `topoContours.ts`; map selection stays in memory |
| Daylight and opening | `game/daylightCycle.ts` owns Mars daylight; `game/starshipArrival.ts`, `ui/StarshipArrival.tsx` and `ui/starbase/createStarshipArrival.ts` own the opening cinematic and readiness handoff. `createShuttleLanding.ts` still supplies the parked Mars shelter |
| Space weather and radiation | `game/spaceWeatherService.ts`, `geigerAudio.ts`; live NOAA SWPC GOES proton flux polling (every 60s) with CORS-enabled JSON feed, historical NASA DONKI SEP storm simulation (May 2024, Sept 2017, Oct 2003) with realistic dynamic flux ramping curves, Web Audio synthetic Geiger counter click synthesis, and real-time biological exposure/shielding mechanics |
| Quality selection | `game/autoGraphics.ts`, `backgroundGraphics.ts`, `ui/world/graphicsTiers.ts`; measured session-only selection with manual overrides |
| Outpost | `game/outpostSite.ts` grades the game terrain; `game/outpost.ts` owns floors, collisions and eleven independent gates; `ui/world/createMarsOutpost.ts` loads the prepared campus, animates gates and culls furnishings by distance |
| Cultivation district | `game/greenhouseSites.ts` defines six level pads; `game/greenhouses.ts` defines decks, ramps and collision state; `ui/world/createGreenhouseFarm.ts` instances the shared model and animates its twelve sliding airlocks |
| Rover garage | `game/garageSite.ts` grades the pad and samples the deck/ramp; `game/roverGarage.ts` owns deployment, docking, door clearance and solar/battery state; `ui/world/createRoverGarage.ts` renders the prepared shelter and its original canopy animation |

`MarsWorld` reports inspection IDs, view/rover state, readiness, WebGL failure, terrain mode, atlas requests and graphics-calibration status through callbacks. `createMarsWorld.ts` creates the terrain and science-rover targets. There is no hidden mission, lunar or outpost mode in this renderer.

## Rendering and performance

The essential scene loads behind `StarshipArrival`. The 32-second opening reuses the procedural Starbase rig, with a separate upper-stage trajectory: hot-staging, a covered edit over orbital coast, return, landing flip, three/two/one-engine braking, arm closure and pin contact. It is an authored flight-inspired cinematic. Skip queues entry until the world reports ready; completion also waits for readiness. Pause and hidden tabs stop the sequence. Reduced motion presents a stationary secured ship, without dust or a moving camera.

The opening uses a temporary WebGL renderer with a maximum 1.25 pixel ratio and 1024 shadows; coarse-pointer/Performance devices use ratio 1, no shadows and 32 dust slots instead of 80. Both stage exhausts have independent instanced outer/core layers. Dust occupies a fixed pool and dissipates after cutoff. There are no external assets or render services. The Mars renderer prepares assets and shaders concurrently, but `coveredByArrival` suppresses its animation/render work and input until handoff. The opening disposes its GPU resources and releases its context when it ends. Failure of this optional renderer falls through to the prepared game; game failure retains the existing retry screen. The old shuttle remains settled as the existing shelter, with no second landing animation. Spawn position, final yaw and ground-relative camera height match the prior handoff.

Auto starts light, prepares optional shaders after entry and samples ordinary animation frames. Each trial skips six settling frames and measures up to one second or 180 samples. A 43 FPS trial threshold provides headroom for the 40 FPS runtime target. Manual selection, pause dialogs, hidden/occluded tabs, preparation and unsettled resolution are excluded. There is no separate continuous benchmark render loop.

Auto can select Ultra on integrated graphics. Failed upgrades restore the best passing preset; slow Performance trials can lower render scale to 0.85, 0.70 or 0.55. The ongoing governor uses hysteresis and changes scale by at most 0.04 every 400 ms. Results are neither stored nor transmitted.

Performance uses an 800-metre far plane instead of 1100, no post-processing and fewer particles. It hides one outer terrain detail ring while retaining the generation pool and collision contacts. `createStreamedMars.coverage()` tells the regional surface which rectangle to omit. Recycled tiles, track pages and effect pools keep memory bounded during travel.

The FPS meter is an optional user feature, not a stray debug statement. `?debug=1` exposes detailed diagnostics; `sitePreview=perseverance`, `sitePreview=outpost` and `landingPreview=16.95` are controlled visual checkpoints that require `debug=1`. Ordinary links omit these parameters. Diagnostic DOM attributes include load time, calibration trials, active quality, render scale, terrain counts and view distance.

## Asset preparation and hosting

`lib/assetUrl.ts` prefixes shipped asset paths for both the Site origin and the `/Tarukh/` Pages subpath. Preserve it when changing loaders. Keep the Draco WASM and wrapper: the rover and astronaut loaders, asset-preparation checks and tests use them.

- `node scripts/prepare-mars-region.mjs` reproduces the local MOLA crop and WebP overview from the NASA PDS product. Downloads go to ignored `outputs/mola/`; none occur during gameplay.
- `node scripts/prepare-mars-surfaces.mjs <source-directory>` rebuilds credited Poly Haven derivatives from verified source maps and their manifest.
- `scripts/prepare-rover.mjs` documents its pinned offline glTF tools. It retains all source triangles while partitioning the wheels and removing unused texture copies.
- `node scripts/measure-rover-windows.mjs <tools-directory>` measures the seven glazing contours after checking the source asset hash. Re-measure if the source model changes.

Game GLBs and WebPs, including the prepared outpost, greenhouse and garage, are checked in; ordinary install/build commands do not regenerate them or need the local authoring workspace. Review and authoring binaries remain excluded. License notices and source manifests accompany the prepared assets. Unused presentation images, old screenshots and unused template components were removed. See `ASSET_CREDITS.md` for attribution.

`vite.pages.config.ts` builds `dist-pages/`; the GitHub workflow publishes it and records `source_commit` in `version.json`. `vite.config.ts`, `worker/`, `db/`, `lib/connectors*` and `scripts/connector-preview/` support the separate Sites build. Their dependencies may be unused by the static game while still required by that integration. Do not remove them based solely on the active UI import graph.

## Persistence and shared systems

### Rover garage contract

The garage stands at `(26, -26)`, facing south, on the same ground datum as the campus. Its flat game-terrain pad includes the six solar panels, ramp and return bay, with a nine-metre blend into surrounding terrain. No review landscape or duplicate rover is imported. The existing crew rover starts inside at `(26, -27.3)`. Curiosity and Perseverance retain their existing roles.

`game/roverGarage.ts` updates that same `RoverVehicle` through opening, rollout, closing and return states. Driving/entry is disabled only while parked or docking. Return requires the rover to be stopped, aligned in the painted bay and unoccupied; either heading is accepted. Its actual suspension and wheel rotation follow the deck/ramp. Battery, damage and upgrades are preserved. E and the contextual touch button invoke the same action. Pausing freezes the mechanism; blocked vehicle paths pause movement, and door occupancy prevents closure. The source canopy motion is played from `Garage_Door_Open`, rather than replaced with a different door animation.

The garage incorporates an integrated base battery inverter system, automated maintenance bay repair, and rover charging dock powered by the base solar panel array (`garage-solar-racks`, 1200W peak) and a 6000Wh base battery storage bank. The inverter operates with 96% efficiency and exposes `inverterWatts`, `inverterStatus` (`'CHARGING'`, `'INVERTING'`, or `'STANDBY'`), `chargingSource` (`'base-solar'` or `'base-inverter'`), `repairActive`, and `chargerActive`. When the rover is parked inside (`state.phase === 'parked'`), damaged rover components (all wheels, cabin roof, solar array) automatically repair in the maintenance bay up to 100%, and the charging dock engages at 850W (0.35%/s battery replenishment, dynamic range update). In daylight, base solar panels recharge base storage and supply the rover directly (`chargingSource: 'base-solar'`); at night, the inverter draws from the battery bank (`chargingSource: 'base-inverter'`). Diagnostics publish `garageInverterWatts`, `garageInverterStatus`, `garageBatteryWh`, `garageRepairActive`, `garageChargingSource`, and `garageDockPopup` to the DOM dataset. A dismissable docking popup banner notifies the user of active base solar charging and automated repair, and the cockpit HUD reflects base solar and repair status.

`scripts/prepare-garage.mjs` derives `public/models/garage/garage.glb` from the reviewed standalone shelter without modifying it. Offline tools are glTF Transform 4.2.1, meshoptimizer 0.22, Sharp 0.35.5 and draco3dgltf 1.5.7, installed in the ignored asset-tool workspace. Static parts are grouped by material, textures become WebP capped at 1024 pixels, and geometry uses Draco compression. The browser uses the existing bundled Draco decoder. The high-detail interior is hidden behind a closed opaque door and culled at 17 metres in Performance or 24 otherwise. Two nearby non-shadowing lights share the simulated garage supply; Performance retains emissive fixtures without those extra lights. Light variants are selected before shader preparation. Geometry, materials, textures, mixer and decoder workers are disposed on teardown.

`?debug=1&sitePreview=garage` opens a reproducible approach checkpoint. Diagnostics expose the garage phase, door fraction, blockage and existing crew-rover position; they create no extra vehicle. The prepared garage binary is included with the integration.

### Outpost asset and collision contract

The cultivation district surrounds the campus with two greenhouses west, two east and two north. `marsOutpostHeight` includes both sets of graded pads at the shared campus ground level; overlapping blend shoulders preserve each flat foundation. Game rocks are cleared from the greenhouse footprints and ramps. The source contains a ceramic deck but no separate planetary landscape. Deck surfaces sit approximately 0.33 metres above the pad datum; short metal ramps bridge to game ground.

The prepared `public/models/greenhouse/cultivation.glb` is loaded once and instanced across all six sites. Interiors are culled at 12 metres in Performance and 18 otherwise; shared shell batches remain visible farther away. Per-building frustum culling excludes off-screen instances. Materials and textures are shared, with at most 1024-pixel textures. The supplied lights are represented by their emissive fixtures to avoid adding 42 scene lights. Sliding leaves use the source's opening offsets and the existing gate interaction/safety rules. `sitePreview=greenhouse` with `debug=1` provides a reproducible approach checkpoint.

`node scripts/prepare-greenhouse.mjs <source-file> <gltf-tools-directory> <sharp-package-directory>` reproduces the greenhouse derivative and its collision layout. Offline tools are glTF Transform 4.2.1, meshoptimizer 0.22 and Sharp 0.35.5. Its defaults use the existing ignored local preparation workspace; this is not a build-time or browser dependency. Original source files are read only.

The outpost uses metre units at `(0, -65)` near the landing zone. `marsOutpostHeight` blends a level foundation into the existing terrain across a 12-metre transition. It is used by the visible ground, streaming and collision sampling. The GLB's presentation ground and scattered basalt are removed; local game rocks are cleared from the footprint.

The checked-in `public/models/outpost/campus.glb` is prepared from the reviewed v9 model. `scripts/prepare-outpost.py` samples the reviewed Blender model into `layout.json`; `scripts/prepare-outpost.mjs` creates the compressed game derivative using its documented offline tools. Neither ordinary build commands nor the browser download source models or run Blender.

`layout.json` contains a 0.25-metre floor-height grid, static collision rectangles sampled from the model, and matching gate clip names. Door collider slots remain stable for streamed terrain and become `disabled` only when fully open; LiDAR ignores disabled colliders. Closing reverses if the astronaut occupies the doorway. E and the visible gate button share the same action. Walkable decks and the ramp override ground height; nearby walls constrain the third-person camera. Conservative room-height proxies limit indoor jumps.

Shell sectors remain visible farther than furnishing sectors (8 metres in Performance, 14 otherwise). Furnishings do not cast outdoor sun shadows. Shared meshes are instanced, small static fittings are joined by material, and textures are capped at 1024 pixels. Reflective transparent glazing avoids the review model's scene-wide refraction pass. The loader uses bundled Meshopt decoding, prepares animations during scene loading and disposes meshes, instances, textures, mixer and lights on unmount. Auto starts at its probe's actual Performance candidate so calibration remains eligible with the added scene.

`game/curiositySave.ts` keeps the existing Curiosity storage key and validation. Previously stored rover state remains compatible. Removed mission saves are not read or erased. Returning to controls setup starts a new player/crew-rover session.

The renderer retains Mars locomotion, terrain contacts, rover simulation, all three rover models, landing, both cameras, touch controls, map/LiDAR, reduced-motion handling, quality selection and WebGL recovery. The original astronaut fallback and its materials live in `createFallbackAstronaut.ts` and `suitMaterials.ts`.

Terrain firmness zones still affect tint and wheel traction, so their coordinates remain in `marsTerrain.ts` without station definitions or mission data. `openWorldRegression.test.mjs` compares visible geometry, 469 rock colliders, height/traction samples and a seeded Curiosity trajectory with the release before retirement.

## Standalone Starbase preview

The separate `public/starbase.html` preview is not embedded or fetched by the Mars entry. Its source rig and exhaust materials are shared with the new opening through a lazy cinematic module. `scripts/build-starbase.mjs` bundles `ui/starbase/main.ts`, `createStarbase.ts`, the HTML template, Three.js and OrbitControls into that one file, including the Three.js MIT notice. Procedural geometry, runtime textures and the reflection environment need no network access. No dependencies were added. Rebuild after shared source edits; a test verifies the source fingerprint embedded in the HTML.

`?debug=1&arrivalPreview=24.5` holds a cinematic shot for inspection; useful checkpoints are 4 (separation), 16 (flip), 24.5 (catch approach/dust) and 29 (secured). Normal links do not freeze the opening. Tests cover separation continuity, the covered time cut, pin clearance and alignment, sequential engine shutdown, fixed dust capacity, pause and readiness gating.

`game/starbaseRig.ts` owns bounded controls and a deterministic 32-second catch sequence. `rocketEntity` remains a child of the scene, independent of the launch mount and tower. The two catch arms retain separate hinges, and four hydraulic rods aim at the current arm attachment positions. Catch completion places the bottoms of the lift pins on the rails at 96 metres. Moving a secured carriage updates the rocket in world coordinates, without reparenting it. Stage separation preserves the upper stage's world transform before a smooth 14-metre separation; rejoin restores its local attachment.

`window.starbaseControls` exposes the following interface. Numeric setters reject non-finite values and clamp to the documented limits. Manual pose/surface edits stop the automated sequence. Reset and a new catch clear velocity commands; pause freezes the sequence and stage motion.

| Control | Contract |
| --- | --- |
| `carriageHeight` | 25–120 metres; the guide rails extend to 125 metres |
| `leftArmAngle`, `rightArmAngle`, `chopsticksAngle` | 0–35 degrees outward; the combined setter moves both arms |
| `qdArmOpen` | `true` stows/clears the quick-disconnect arm; `false` deploys it |
| `rocketPosX`, `rocketPosY`, `rocketPosZ` | World-space metres; X/Z ±80, Y 0–250 |
| `rocketPitch`, `rocketYaw`, `rocketRoll` | Degrees; pitch/roll ±90, yaw ±180 |
| `engineThrust` | 0–1 plume/light command; no computed thrust dynamics |
| `gridFinDeflection`, `flapsBellyFlopAngle` | Set all fins (±30°) or flaps (−20–70°) |
| `setGridFin(index, degrees)`, `setFlap(index, degrees)` | Independent surface controls, indices 0–3; flaps 0–1 forward, 2–3 aft |
| `view` | `stack`, `booster`, or `ship`; selects an inspection preset |
| `startCatchSequence()`, `pause()`, `resume()`, `reset()` | Sequence and playback controls |
| `setVelocity(x, y, z)`, `stopVelocity()` | Bounded manual world-space translation in metres/second |
| `velocity`, `angularVelocity` | Measured current translation and angular rates; angular rates use radians/second |
| `separateStages()`, `joinStages()` | Detach/rejoin the upper stage while inspecting the full stack |
| `rocketEntity`, `superHeavyBooster`, `starshipUpperStage` | Three.js groups for inspection or custom scripting |

Auto begins with a 1.25 pixel-ratio cap and 1024 shadows, reducing the cap in small steps to 0.8 if measured rendering falls below 36 FPS. High uses 1.5/2048, Ultra 2/4096, and Performance 1/no shadows. This independent preview does not use or change the game's graphics calibration. Static components are batched; the hex tiles and exhaust use instancing. Shader preparation runs behind the loading cover. GPU resources and listeners are disposed on teardown or initialization failure. The file supports reduced motion, touch orbit controls, a narrow-screen controls drawer and a Performance retry when WebGL fails.

## Validation

Run the commands in `README.md`. Unit tests cover simulation, terrain seams, collisions, rover contacts/rigging, camera geometry, streaming, graphics selection, maps and landing. Tests specific to deleted modes were removed; shared vehicle tests now use shuttle and terrain obstacles.

ESLint excludes generated build directories and the vendored Draco decoder. Existing React lifecycle and hook-dependency findings remain in the active entry and renderer. Changing initialization, refs or effect dependencies can alter behavior, so those findings need a separately scoped change rather than rule suppression or a mechanical rewrite. A failing lint check must be reported honestly.

Browser smoke checks should cover PC and Mobile entry, landing/skip, movement and jump, camera switching, rover entry/driving/cockpit/exit, atlas open/close, pause/resume, quality changes and WebGL retry. Check asset requests and the console. Desktop viewport emulation is not a physical-phone performance test.
