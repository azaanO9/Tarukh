# Earth-to-Mars opening

The opening shows a coastal Earth launch (0–6 seconds), an intact orbital coast
(6–11 seconds), and a fictional Mars catch (11–32 seconds). The user-supplied
Starship stays intact throughout: there is no booster, separation or landing
flip. The MartianDays CC BY 4.0 model is uniformly fitted to the existing
19.2-metre flight envelope; it is not presented at the real vehicle's scale.
Cuts compress the journey; this is not a real trajectory or
a claim that Mars already has launch infrastructure.

Earth's coast, cloud banks and orbital limb are original procedural geometry.
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

If preparation takes longer, the orbital shot holds at 10.1 seconds before the Mars cut. Skip
waits safely for readiness. Pause freezes both the flight and landing dust;
reduced motion uses a stationary shot. The cinematic overlay prevents input and
hides exploration HUD controls. Preparation time is device-dependent, not a fixed
extra delay, and loading is not restarted at handoff.

The shared mutable playback object is a scene bridge, not saved game state.
`game/starshipArrival.ts` owns timing and phase rules. `createEarthDeparture.ts`
and `createStarshipArrival.ts` render departure; `createMarsCatchSite.ts` owns
the persistent site and its camera. The standalone Earth engineering preview
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
at capture. The arms close from 23–26 seconds while the pins remain above their
rails; the final 1.2 metres settle by 29 seconds and thrust then turns off.

Verification covers 349 automated tests, TypeScript, both production builds and
browser checks of model loading, arrival, skip and reduced-motion Mobile entry.
Screenshots and command logs remain local review artifacts, not shipped assets.
Repository lint still reports one existing effect-state error and three hook
dependency warnings in `ui/MarsWorld.tsx`. Those findings are unrelated to the
model-loading readiness and diagnostic additions in this revision.
