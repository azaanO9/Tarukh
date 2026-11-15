# Bounded Mars performance update

Local validation: November 15, 2026. Baseline: `0f8e965ee4936c52a0b11ce796ba7380df387d50`. Measurements below describe the bounded-terrain update; the current rendering contract is recorded in `INTERFACE.md`.

## Scope

Exploration now stays inside the existing NASA MOLA crop, with approximately 1.74 × 1.32 game kilometres inside an authored mountain perimeter. All seven landmark positions, the base, six enlarged greenhouses, garage and existing vehicles remain. The perimeter is an artistic gameplay barrier, not measured Mars relief. Four solid walls prevent walking, jumping and driving across it; the atlas marks the playable limit.

The former infinite map already used a fixed-size tile pool. Limiting its extent alone would not make each frame cheaper. The improvements below reduce rendering and simulation work while retaining local terrain detail around the base.

## Changes by file

| Files | Change |
| --- | --- |
| `game/explorationBounds.ts`, `game/marsExpeditionTerrain.ts` | Finite survey bounds, mountain relief and impassable perimeter colliders. Interior landmark heights remain unchanged. |
| `game/terrainStreaming.ts`, `ui/world/streamedMars.ts` | Two-metre detail grid, cached height halo, incremental normals/bounds and nearest-first work queue. Exact one-metre perimeter stitches join the unchanged base. Collision interpolation follows the rendered triangles. Only fully prepared rings replace the far terrain, preventing holes and overlapping surfaces during generation. |
| `ui/world/terrainPatches.ts`, `marsTerrain.ts`, `marsRegionalLandscape.ts` | Frustum-cullable ground patches instead of entire terrain meshes. Original far-terrain resolution retained after a coarser candidate produced unacceptable ridge seams. Sky remains visible with the shorter far plane. |
| `ui/world/graphicsTiers.ts` | Far distances of 320/420/520/650 metres for Performance/Auto/High/Ultra; corresponding haze, lower particle budgets and 1024/1536-pixel sun shadow budgets. Auto uses the distance of the preset it selects. |
| `game/collision.ts`, `game/curiosityRover.ts` | Local obstacle broad phases for steering/contact work; full obstacle list retained for global target selection. Correct handling of long perimeter boxes prevents false avoidance inside the colony. Redundant scan probes deferred until needed. |
| `ui/MarsWorld.tsx`, `ui/MarsFreeRoam.tsx` | Reused obstacle buffers, memoized world component with stable callbacks, 8 Hz HUD updates, idle-time periodic rover saves and immediate final saves. Added a boundary QA checkpoint. |
| `game/daylightCycle.ts`, `ui/MarsWorld.tsx` | Smooth dusk activation of the helmet lamp and no shadow redraw when unlit. Full midnight brightness and the ten-minute daylight cycle remain. |
| `ui/world/createRoverGarage.ts` | Garage lights remain outside its distance-culled model, avoiding changes to global light counts while travelling. Positions, intensity rules and teardown are preserved. |
| `ui/MarsAtlas.tsx`, README, assumptions, interface and asset credits | Finite-region wording, visible atlas boundary, updated rendering contracts and attribution for original perimeter geometry. |
| Tests | Added boundary, large-wall broad-phase, queued-tile coverage, edge stitch, terrain partition and dusk-light regressions; updated tier/rendering expectations. Existing movement and vehicle regression checks remain. |

No dependencies or model/texture assets changed.

## Measurements

Chrome headless, 1280 × 720, reduced-motion preference, normal spawn, 180 animation-frame intervals per capture after calibration and settling. All measurements used the local production Pages build. These are indicative desktop measurements, not physical-phone results or a guarantee of minimum FPS. The autonomous rover continues to move, and host/browser scheduling varies between captures.

| Setting | Before mean frame | After mean frame | Approx. FPS before → after | P95 before → after |
| --- | ---: | ---: | ---: | ---: |
| Performance | 36.28 ms | 34.06 ms | 27.6 → 29.4 | 66.7 → 66.7 ms |
| Auto | 22.77 ms | 21.29 ms | 43.9 → 47.0 | 33.5 → 33.4 ms |
| High | 64.97 ms | 51.18 ms | 15.4 → 19.5 | 133.3 → 100.0 ms |
| Ultra, instrumented repeat | 57.10 ms | 48.59 ms | 17.5 → 20.6 | 100.0 → 100.0 ms |

Both Auto captures chose Performance at render scale 0.55; manual settings used scale 1.00 on this display. The test preference disables bloom. Ultra was measured after its shadow budget adjustment. A preceding Ultra capture had a large isolated pause and a 109.3 ms mean. The instrumented repeat did not reproduce it: maximum frame interval 116.6 ms, one 111 ms long task and no recorded slow shader/texture API calls during the sample. The cause of that isolated pause is unresolved; this update does not claim to eliminate every stutter.

Independent workload checks:

- At the fixed spawn test camera, terrain submission falls from 451,104 triangles to 200,976 in Performance/Auto and 217,360 in High/Ultra (approximately 55%/52% less). Terrain calls increase from 2 to 30/38 to make off-screen sections cullable; this is a deliberate geometry/draw-call tradeoff.
- Ordinary 70-metre detail tiles fall from 9,800 to 2,450 triangles. A tile touching the fine base adds only 35 stitch triangles.
- Curiosity navigation on the same 928-collider route measured median 6.74 → 0.317 ms and P95 11.04 → 0.712 ms in a helper benchmark. Its 600-frame trajectory matched the baseline exactly. This measures the helper, not overall game FPS.
- A separate 3,000-step Curiosity stress run with 932 colliders, scans and rerouting had no step above 25 ms; worst step was 12.27 ms.

Raw local captures, screenshots and browser helpers are in ignored `outputs/optimization/`. They are not shipped assets.

## Verification and remaining checks

- 212 automated tests passed; TypeScript and both production builds passed.
- Browser checks passed for PC/touch greenhouse entry and exit, closed-door blocking, garage rollout/return, wheel motion, desktop driving/camera/exit, pause/resume, outpost entrance and tunnel gates, mountain sprint/jump blocking and retreat, atlas controls/seven pins, early loading skip and WebGL failure/Performance retry.
- No application errors or failed local assets were reported by those browser checks.
- Lint still reports two pre-existing state-in-effect errors and three hook warnings. They were not suppressed or rewritten as part of terrain optimization. The earlier unused mutable timer declaration was corrected.

Test sustained travel, first visits to distant landmarks, tier switching, first nighttime lighting and garage approaches on physical phones and integrated GPUs. High/Ultra can still encounter first-use material or post-processing preparation after a Performance startup. An additional High garage check exceeded a 30-second automation wait immediately after selecting High while another browser check was running; the scene remained present without application errors. An isolated rerun with a longer wait passed the complete High garage deployment, driving and return cycle. This first-use preparation is not claimed fixed. Distant terrain remains a coarser LOD, as before; the far resolution was retained to limit seam differences. No available automated check establishes constant frame pacing on every device.

## Indoor camera and outpost approach follow-up

Entry into the outpost or any greenhouse selects first-person view with a 550 ms position/orientation blend. Leaving restores the previous outdoor view after a brief doorway grace period. Manual V/touch switching remains available. Reduced motion skips the sweep, including when that preference changes mid-transition. Rover cameras retain their original behavior. The implementation and five regressions are in `game/interiorCamera.ts`, `tests/interiorCamera.test.mjs` and `ui/MarsWorld.tsx`.

Approach profiling ruled out the initial cold-buffer hypothesis for the tested main entrance: startup performed 2,335 buffer uploads, but approach/entry had no new buffer uploads or slow shader calls, and 52 shader programs remained stable. No extra loading warmup was retained. Instead, large furniture batches were submitting all their instances as soon as any part entered the camera frustum. Per-instance visibility in `ui/world/createMarsOutpost.ts` and `instanceVisibility.ts` now removes only off-screen instances. Two additional tests verify transforms, colors, conservative bounds, reentry and unchanged-buffer reuse.

Fixed-camera outpost geometry measurements, using the actual model without changing geometry:

| Viewpoint | Before triangles | After triangles | Reduction |
| --- | ---: | ---: | ---: |
| Entrance, third person | 1,165,237 | 1,062,217 | 8.8% |
| Command room, first person | 989,268 | 774,692 | 21.7% |
| Crew quarters, first person | 1,008,318 | 738,332 | 26.8% |

On the same headless Chrome Performance route, first-entry mean frame time changed from 65.9 to 61.1 ms and the largest sampled interval from 216.6 to 150.1 ms. Approach means were 37.9 and 39.2 ms, showing no material approach FPS improvement in that capture. The new automatic first-person camera also contributes to the entry result, so the frame-time change cannot be attributed solely to culling. Stutters are reduced in the tested entry, not claimed eliminated on all devices.

Current automated validation: 219 tests, TypeScript and both production builds pass. Browser camera walkthroughs passed for PC outpost/greenhouse and mobile greenhouse, including blocked entrances, gradual transitions, restoration of both outdoor preferences and reduced motion. The final outpost walkthrough also passed with culling enabled. Garage rollout, driving, cockpit switching, exit and parking passed after the camera changes. Lint retains the same two existing errors and three hook warnings. Test artifacts are local in `outputs/interior-camera/`; before/after approach traces and instance counts are in `outputs/indoor-camera/`. This follow-up remains uncommitted and unpublished with the preceding optimization work.

## Outpost light leakage follow-up

The two unshadowed room-fill lights illuminated exterior walls and ground through the outpost shell. `ui/world/interiorLighting.ts` now supplies their existing PBR light contribution only to cloned interior materials and the animated gate leaves. `createMarsOutpost.ts` resolves gate receivers from their animation tracks rather than naming patterns. Shared source materials remain unmodified, so an interior and exterior using the same white ceramic or titanium material no longer share room lighting. Emissive fixtures, light colors/ranges/intensities and tier behavior are retained. Shell panels retain the outdoor illumination.

This adds no textures, model changes, passes or shadow maps. Uniform storage is reused per frame, shaders are prepared by the existing loading warmup, and cloned materials are disposed independently of shared source textures. `ui/MarsWorld.tsx` adds the debug-only `sitePreview=outpost-lights` comparison viewpoint. Four tests cover material isolation, transforms, shader compatibility with zero native point lights, and disposal.

All 223 automated tests, TypeScript, and both production builds pass. Lint reports the same two existing errors and three warnings. Final Performance and High exterior checks and desktop/touch entry/exit walkthroughs passed without application or asset failures; the exterior white hotspot is absent and the interior fixtures, furnishings and moving door remain lit. GPU shader checks reported no errors. Touch validation used Chrome mobile emulation, not a physical phone. Browser captures and logs are in ignored `outputs/outpost-lighting/` and `outputs/interior-camera/`. This change remains local and unpublished.

## Airlock geometry and automatic closing follow-up

- `scripts/outpost-repairs.mjs`, `scripts/prepare-outpost.mjs` and the prepared `public/models/outpost/campus.glb`: removed 288 observatory glazing-trim triangles crossing the doorway and added ten fitted pressure collars around the internal gates. White exterior and dark interior materials remain separate. The clear aperture is at least 1.79 × 2.22 metres, with the existing raised-panel pocket preserved. The original v9 source hash and all eleven animation clips are unchanged. Existing side colliders cover the infill; the collision layout was not regenerated.
- `game/outpost.ts`: all eleven outpost doors close after two fully open, clear seconds. Five pairs interlock; an opposite-door request waits for the first leaf to seal. Occupancy holds/reverses closure, queued requests can be cancelled, and pausing freezes door timers. Actual leaf thickness plus player clearance keeps the short botany chamber usable. Greenhouse operation remains unchanged.
- `ui/MarsWorld.tsx`: a cycling/cancel prompt and debug-only chamber viewpoints/state diagnostics support the interaction and validation. README, interface documentation, asset attribution and the prepared asset hash are updated.
- `tests/outpost.test.mjs`, `tests/outpost-repairs.test.mjs`: added automatic-close, both-direction interlock, narrow-chamber, obstruction, cancellation/pause and geometric aperture/seal/normal regressions.

The prepared model grows from 15,862,184 to 15,887,452 bytes (+25,268 bytes). Full asset geometry changes from 2,286,001 to 2,287,013 triangles (+1,012), with 325 versus 319 primitives; these are total model counts, not simultaneous per-frame draw calls. No new textures, downloads or dependencies were introduced.

All 231 automated tests, TypeScript and both production builds pass. Lint retains the same two pre-existing errors and three warnings. Fixed room-side before/after browser captures confirm the crossing rails are removed and frame joints no longer expose terrain; retained outside-window trim stays beyond the doorway. Final observatory, botany, emulated-mobile and full desktop entrance/crew-room/return walkthroughs passed, including obstruction safety, cycling, automatic closure and unchanged indoor camera behavior. No application/shader errors or failed asset requests were reported. One desktop automation wait missed the short fully-open window during a busy run; the final rerun walked against the physical door collider instead of depending on a sparse diagnostic sample and passed. Unit tests verify the interlock each simulation step; browser diagnostics update once per second. Physical-phone performance was not measured. Tests and visual artifacts are local in `outputs/airlock-fix/`. This work remains uncommitted and unpublished.
