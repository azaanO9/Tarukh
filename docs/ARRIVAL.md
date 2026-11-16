# Earth-to-Mars opening

The opening shows a coastal Earth launch (0–6 seconds), an intact orbital coast
(6–12 seconds), a Mars atmospheric approach (12–19 seconds), and the preserved
fictional Mars catch (19–40 seconds). The user-supplied
Starship stays intact throughout: there is no booster, separation or landing
flip. The MartianDays CC BY 4.0 model is uniformly fitted to the existing
19.2-metre flight envelope; it is not presented at the real vehicle's scale.
Cuts compress the journey; this is not a real trajectory or
a claim that Mars already has launch infrastructure.

Earth uses a NASA Blue Marble surface, a dated NASA-derived cloud layer and a
procedural blue atmospheric rim. Mars uses the credited Solar System Scope
NASA-derived map, with its source's artistic colour adjustments and gap filling.
These are original runtime sphere meshes, not downloaded NASA GLBs.
The launch site combines a CC0 photographed sky and ground with original coastal
terrain, water, vegetation, apron markings and batched launch hardware.
The prepared Starship and its four PBR textures ship locally with the game.
The 1.17 MB derivative retains all eight parts and 20,630 triangles from the
19.01 MB supplied file, with Draco geometry and 1024px WebP textures.
No external model service is used. Provenance and preparation are recorded in
[the asset attribution](../public/models/starship/ATTRIBUTION.md).

Mars descent uses the actual MarsWorld renderer, terrain, outpost and cultivation
district. The tower is at game coordinates (118, 90), about 195 metres from the
outpost centre. Its original rig is uniformly scaled to 0.65, with a locally
graded 28-metre pad and a 15-metre transition. The tower has collision; the
suspended ship does not create an invisible ground-level obstacle. The final
crew vehicle lift pins meet the closed arms, and the ship and tower remain visible
during exploration. Raised hardware uses the terrain's height-aware haze.

The game mounts concurrently with the opening. Models, terrain, textures, GPU
buffers and shader variants prepare under the cover. Earth and space use a
temporary lightweight renderer. Once the actual world is ready, only its renderer
draws Mars descent; the temporary renderer stops drawing. No duplicate campus
models or second Mars landscape are loaded for the cinematic.

The secured rig is batched by material after the model finishes loading.
The static view shares materials and textures. Both
variants are warmed behind the opening; handoff creates no geometry. Animated
pieces are excluded from exploration's per-frame detail-distance bookkeeping.

If preparation takes longer, the Mars approach holds at 18.1 seconds before the landing cut. Skip
waits safely for readiness. Pause freezes both the flight and landing dust;
reduced motion uses a stationary shot. The cinematic overlay prevents input and
hides exploration HUD controls. Preparation time is device-dependent, not a fixed
extra delay, and loading is not restarted at handoff.

The shared mutable playback object is a scene bridge, not saved game state.
`game/departureSequence.ts` owns the extended opening clock and maps the landing
back to the unchanged `game/starshipArrival.ts` sampler. `earthDeparture.ts`,
`flightPlanets.ts` and `createStarshipArrival.ts` render departure;
`createMarsCatchSite.ts` owns the persistent site and its camera. The standalone Earth engineering preview
retains its previous choreography and source-hash verification.

`game/reusableRocket.ts` keeps the crew vehicle's dimensions and catch-pin datum
separate from the standalone Starbase dimensions. The game selects the reusable
geometry explicitly; the default preview keeps its existing booster and upper
stage. Each renderer retains its vehicle nodes and materials throughout its shots;
both use the same model definition. The six original exhaust effects are aligned
to measured nozzle rims, and original catch adapters bridge the narrower hull to
the unchanged rails. A failed model load retains the procedural crew vehicle.
Late model results are disposed if their renderer has already unmounted.
Parked geometry is baked during loading, with no reparenting or mesh construction
at capture. On the extended opening clock, the arms close from 31–34 seconds
while the pins remain above their rails; the final 1.2 metres settle by 37 seconds
and thrust then turns off. These correspond to the original landing clock's
23–26 and 29 seconds; the motion is unchanged.

## Assets and performance

The five new images are preloaded locally and shader variants are warmed before
playback. Desktop uses 4K planets, 2K clouds/sky and 1K ground (2,501,414 bytes).
Touch/Performance uses 1K planets/clouds/sky and 512px ground (392,124 bytes).
Only the selected resolution set is requested. Source URLs, licenses, hashes and
derivatives are recorded in public/art/flight/sources.json and ASSET_CREDITS.md.

The source images can be prepared with `node scripts/prepare-flight-textures.mjs`.
This uses Next's existing Sharp dependency, or `SHARP_MODULE` for a specific
installed version. Preparation downloads source images once and then reuses its
local cache; this tool is not part of the game or build.
No dependencies were added. The sky is a tonemapped photograph, not an HDR
lighting probe. Coastal buildings are original simplified geometry; no paid
launch-site model or photographic reconstruction is claimed.

Image requests have a six-second ceiling and retain procedural fallbacks on
failure. On teardown, requests are aborted and textures, bitmap memory, shared
geometry and materials are disposed, including late decode results.
No stars or atmospheric shells enter the main Mars renderer.

## Verification

Run pnpm test, pnpm typecheck, pnpm build and pnpm build:pages.
The new tests cover original landing preservation, timeline cuts, readiness holds,
pausing and texture disposal/failure. Existing flight/engine/catch tests remain intact.

Run scripts/flight-cinematic-check.mjs against a production preview for desktop
launch, Earth orbit, Mars entry and landscape mobile captures. Add --journey=1
for natural playback, pause/resume, the actual-world landing handoff, early skip
and reduced-motion entry with all new texture requests blocked. Set
PLAYWRIGHT_MODULE and CHROME_PATH for the local browser installation. Screenshots
and machine-readable reports go to outputs/arrival-review by default.

The production-preview checks passed for all four captures and the uninterrupted
journey, including pause, skip and reduced motion with the new images blocked.
All 373 automated tests, TypeScript and both production builds passed. The latest
repository baseline already has four ESLint errors and eight warnings in unrelated
gameplay/menu files; the opening adds no lint findings. Mobile coverage uses
browser emulation, not sustained measurements on a physical phone.

| Opening shot | Viewport | Draw calls | Triangles |
| --- | --- | ---: | ---: |
| Earth launch | 1440 × 900 | 43 | 63,610 |
| Earth orbital departure | 1440 × 900 | 16 | 60,886 |
| Mars atmospheric approach | 1440 × 900 | 14 | 45,574 |
| Mobile Earth departure | 844 × 390 | 16 | 33,526 |

These counts describe the temporary cinematic renderer at the captured frames,
not the concurrently preparing Mars scene or an FPS guarantee.
