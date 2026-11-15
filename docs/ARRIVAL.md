# Earth-to-Mars opening

The opening shows a coastal Earth launch (0–3 seconds), an orbital shot with
stage separation (3–8 seconds), and a fictional Mars upper-stage catch
(8–32 seconds). Cuts compress the journey; this is not a real trajectory or
a claim that Mars already has launch infrastructure.

Earth's coast, cloud banks and orbital limb are original procedural geometry.
No external models, images, APIs or runtime downloads are added.

Mars descent uses the actual MarsWorld renderer, terrain, outpost and cultivation
district. The tower is at game coordinates (118, 90), about 195 metres from the
outpost centre. Its original rig is uniformly scaled to 0.65, with a locally
graded 28-metre pad and a 15-metre transition. The tower has collision; the
suspended ship does not create an invisible ground-level obstacle. The final
upper-stage lift pins meet the closed arms, and the ship and tower remain visible
during exploration. Raised hardware uses the terrain's height-aware haze.

The game mounts concurrently with the opening. Models, terrain, textures, GPU
buffers and shader variants prepare under the cover. Earth and space use a
temporary lightweight renderer. Once the actual world is ready, only its renderer
draws Mars descent; the temporary renderer stops drawing. No duplicate campus
models or second Mars landscape are loaded for the cinematic.

The secured rig is batched by material during preparation, reducing its fully
visible draw calls from 84 to 15 while retaining all 118,132 triangles. The static
view shares materials/textures and retains instanced heat-shield tiles. Both
variants are warmed behind the opening; handoff creates no geometry. Animated
pieces are excluded from exploration's per-frame detail-distance bookkeeping.

If preparation takes longer, the orbital shot holds before the Mars cut. Skip
waits safely for readiness. Pause freezes both the flight and landing dust;
reduced motion uses a stationary shot. The cinematic overlay prevents input and
hides exploration HUD controls. Preparation time is device-dependent, not a fixed
extra delay, and loading is not restarted at handoff.

The shared mutable playback object is a scene bridge, not saved game state.
`game/starshipArrival.ts` owns timing and phase rules. `createEarthDeparture.ts`
and `createStarshipArrival.ts` render departure; `createMarsCatchSite.ts` owns
the persistent site and its camera. The standalone Earth engineering preview
retains its previous choreography and source-hash verification.
