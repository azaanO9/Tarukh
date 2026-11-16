# Mobile interface and loading â€” November 17, 2026

The initial interface/loading pass below preserved graphics budgets. The subsequent **Circular HUD and clarity follow-up** at the end of this report updates mobile anti-aliasing, resolution recovery and nearby-detail visibility. Both passes preserve story rules, rewards, terrain, vehicle physics, spacecraft animation and source assets. No runtime dependency was added.

## What changed

- **Launcher:** a safe-area grid in portrait and landscape, large start/story/settings buttons, readable text and bounded settings/about sheets. The detected primary pointer selects touch or keyboard UI. There is no manual device chooser. Fullscreen is requested on Start or the explicit fullscreen button, not on every interaction.
- **Playfield:** separate header, navigation and thumb zones. The minimap has 48-pixel Map, range and collapse buttons and remains visible in the touch rover cockpit. Walking actions have icons and short labels. Rover pedals support simultaneous steering/throttle and show their held state. Blur, hidden tabs, cancellation and lost capture release input.
- **Pause:** desktop retains its radial menu. Phones and tablets use large section buttons and a scrolling settings area. Moving the console outside the cinematic's inert world allows it to work after fullscreen exits during the opening.
- **Phone:** a native modal with safe-area bounds, a six-app home grid and a scrolling content region. Home, Back and Close remain reachable on 568 Ã— 320 screens. Readings, archive, sound settings and scientific sources are retained.
- **Atlas:** Map/Places tabs on phones; map plus directory on large landscape tablets. Full-size zoom/centre/contour controls, scrolling destination details and touch instructions. Pointer capture handles pinch-to-pan transitions, ignores hover and rejects cancelled taps. The wheel listener is explicitly non-passive. Controls and waypoint semantics otherwise stay the same.
- **Story:** a compact Next step/Missions card on touch screens; complete guidance, resources, station activities and journal remain in their existing panels. All 27 activity interfaces were checked at three sizes. No mission rules or rewards changed.
- **CSS ownership:** `ui/mobileInterface.css` owns these touch layouts, loaded after the legacy sheets. Dynamic viewport units, safe-area insets, flex/grid, minimum 48-pixel buttons and eight-pixel control gaps replace the earlier tiny phone overrides. Desktop-only rover placement rules no longer override touch placement.

## Loading without lowering image quality

The original map raster and launcher logo have lossless WebP derivatives at their original dimensions. `scripts/prepare-mobile-images.mjs` verifies identical visible RGB and alpha values after decoding; fully transparent RGB may be canonicalized. Original PNGs and attribution are retained.

| Asset | Previous bytes | New bytes | Saved |
| --- | ---: | ---: | ---: |
| Launcher logo | 378,882 | 220,032 | 158,850 |
| Atlas raster | 6,016,006 | 4,301,532 | 1,714,474 |
| Total | 6,394,888 | 4,521,564 | 1,873,324 |

Plan view no longer downloads the **6,298,626-byte** elevation crop or initializes the relief renderer. That data and the original full-detail mesh load when 3D relief is selected. Opening Plan therefore requests **4.30 MB rather than 12.31 MB** of map assets, a 65% reduction before HTTP compression. If WebP fails, the original PNG is tried once. A failed relief request leaves Plan usable and displays an explanation. Closing the atlas aborts a pending height request.

The main-menu poster finishes before the six decorative parallax plates begin downloading. All original layers still load and animate; the complete poster provides the background meanwhile. Existing world/arrival/story lazy chunks, PWA caching and adaptive graphics remain in use.

### Controlled launcher measurements

Baseline: `1a0659664a3aad3d95080f1334886a02398b79bf`. Chrome on Windows, 844 Ã— 390 touch emulation, reduced motion, fresh HTTP cache, service workers blocked, 4Ã— CPU slowdown, 1.6 Mbit/s download and 150 ms latency. Before is one sample; after is the median of three sequential samples. The same Vite production server and throttle settings were used. These measure the launcher, not complete 3D-world loading or phone GPU performance.

| Metric | Before | After |
| --- | ---: | ---: |
| Start button visible | 2.270 s | 2.194 s |
| First contentful paint | 2.128 s | 2.148 s |
| Largest contentful paint | 7.576 s | 7.460 s |
| Complete-poster request duration | 6.193 s | 2.986 s |
| Layout shift (CLS) | 0.00618 | 0 |
| Recorded resource transfer | 1,387,812 bytes | 1,233,395 bytes |
| Initial JS transfer | 79,608 bytes | 79,574 bytes |
| Initial CSS transfer | 33,995 bytes | 38,462 bytes |

The background request finishes much sooner and the transfer is smaller, but overall FCP/LCP improvement is small. The richer responsive layout adds about 4.5 KB to the compressed initial stylesheet. No new Lighthouse score, physical-phone FPS or field INP result is claimed. Full model loading remains a substantial cost. The previous November 16 rendering/Lighthouse audit is retained separately in [historical measurements](qa/mobile/performance-summary.json); its figures are not results from this pass.

[Current compact evidence](qa/mobile-ui-2026-11-17/summary.json) accompanies the raw loading samples and browser summaries. Selected screenshots: [launcher](qa/mobile-ui-2026-11-17/menu-phone.png), [playfield](qa/mobile-ui-2026-11-17/playfield-phone.png), [handset](qa/mobile-ui-2026-11-17/handset-short-phone.png), [tablet atlas](qa/mobile-ui-2026-11-17/atlas-tablet.png), [pause](qa/mobile-ui-2026-11-17/pause-short-phone.png) and [rover](qa/mobile-ui-2026-11-17/rover-phone.png). Complete local screenshots and detailed reports are in `outputs/mobile-*`; those generated outputs are excluded from Git.

## Validation

- `pnpm test`: 375 passed, zero failures.
- `pnpm typecheck`, `pnpm build` and `pnpm build:pages`: passed. Existing large-chunk and framework warnings remain.
- `pnpm lint`: four pre-existing React effect errors and eight existing warnings remain. No findings are suppressed. The unchanged HEAD versions of the three affected UI files were also linted separately to confirm all four errors predate this pass.
- Chromium, Firefox 142 and WebKit 26: 47 captured UI states per engine, zero reported page/WebGL errors or tested-zone overlaps. Checks cover launcher, settings/about, play HUD, portrait rotation, pause, all phone apps, atlas, 3D relief, Story opening and next-step guidance.
- Eleven viewport sizes: 360 Ã— 640, 375 Ã— 667, 390 Ã— 844, 412 Ã— 915, 430 Ã— 932, 768 Ã— 1024, 1024 Ã— 768, 844 Ã— 390, 926 Ã— 428, 667 Ã— 375 and 568 Ã— 320. Chromium also checks automatic detection with iPhone SE/14/15, Pixel 7, Galaxy S-series and iPad profiles and a keyboard/mouse desktop.
- All 27 activity components: 81 layout captures across three sizes. This is component layout coverage, not a manual playthrough of every mission.
- Actual Chrome touch injection checks walking plus jump, rover rollout/boarding, steering plus throttle, cancellation, rover layouts and an asymmetric notch/home-indicator safe area. Atlas tests cover pinch/pan/cancel and unavailable map assets. Unit tests cover gesture ownership and pinch-to-pan continuity.

### Re-run

Use Playwright as a local QA tool; it is not a runtime dependency. Set `PLAYWRIGHT_MODULE` to its `index.mjs` if installed outside the project. `CHROME_PATH` selects an installed Chrome, and `PLAYWRIGHT_BROWSERS_PATH` selects a local browser cache.

```sh
pnpm build:pages
pnpm exec vite preview --config vite.pages.config.ts --host 127.0.0.1 --port 4211
node scripts/mobile-ui-check.mjs --browser=chromium
node scripts/mobile-ui-check.mjs --browser=firefox
node scripts/mobile-ui-check.mjs --browser=webkit
node scripts/mobile-controls-check.mjs
node scripts/mobile-loading-check.mjs
```

Run browser flows sequentially when comparing performance. The UI checker checks viewport containment, named-zone intersections, target bounds and blocked targets. Geographic pins may overlap at low zoom; every destination also has a separate full-size Places button. Scrolling content is allowed inside bounded panels. The checks do not prove that every possible notification combination is overlap-free.

For the 27 isolated activity layouts, run the static Vite dev entry on port 4210, then `node scripts/mobile-activities-check.mjs`. The script exclusively creates a temporary fixture and removes its own files when finished. It refuses to overwrite an existing fixture. `--url` and `--output` override server/output locations on each runner. The older `mobile-layout-check.mjs` entry now forwards to the current checker.

## Browser limits and remaining device checks

Windows WebKit checks the Safari engine; it is not a physical iPhone Safari test. Real devices still need checks for installation, browser bars/notches, interruptions, thermal performance and extended play. Verify the smallest supported phone in landscape, both thumb controls together, opening/closing the phone and atlas, rotation while a dialog is open, and outpost/garage entry.

Browsers can deny fullscreen, orientation lock and vibration. iPhone uses the existing Add to Home Screen/standalone path where fullscreen is unavailable; web code cannot hide OS controls or prevent home/notification gestures. Fullscreen exit pauses and does not force re-entry. Portrait gameplay pauses behind a rotation guide, which now sits above the opening cinematic. Main-menu and already-open native dialogs remain usable in portrait.

This task does not guarantee a particular frame rate, change gameplay saves, simplify models or alter graphics presets. These checks use a local production preview; publication is verified separately through the repository's deployment workflow.

## Changed files

| Files | Responsibility |
| --- | --- |
| `ui/mobileInterface.css`, `ui/freeRoam.css`, `ui/world.css` | Touch layouts, safe areas, readable controls and corrected rover placement |
| `ui/TarukhMainMenu.tsx`, `ui/MarsFreeRoam.tsx`, `ui/MarsWorld.tsx` | Automatic controls, launcher/fullscreen flow, cockpit minimap and accessible pause during arrival |
| `ui/ExplorationMinimap.tsx`, `ui/ElysiumStory.tsx` | Map toolbar and compact mission shortcuts |
| `ui/world/MarsTouchDeck.tsx`, `ui/world/RoverTouchDeck.tsx` | Labelled controls, multi-touch ownership and held-state feedback |
| `ui/MarsAtlas.tsx`, `game/mapPointerGesture.ts`, `tests/mapPointerGesture.test.mjs` | Phone/tablet map panels, reliable gestures, deferred relief and failure recovery |
| `ui/RedValleyBackdrop.tsx` | Prioritize the complete menu poster before decorative layers |
| `public/team/tarukh-blue-arc-logo.webp`, `public/art/mars-atlas/map-base.webp`, `scripts/prepare-mobile-images.mjs` | Verified lossless image derivatives |
| New `scripts/mobile-*check.mjs` runners and updated `scripts/mobile-layout-check.mjs` | Reproducible browser/layout/input/loading checks |
| `README.md`, `docs/INTERFACE.md`, `ASSET_CREDITS.md`, this report and `docs/qa/mobile-ui-2026-11-17/` | Current controls, contracts, attribution and measured evidence |

## Circular HUD and clarity follow-up

Mobile gameplay now hides the TARUKH badge and uses a circular top-left radar with a thin outline. Tap the radar itself to open the atlas; the Map/range/collapse toolbar is removed. Circular glass controls use camera-switch, directional, jump, vehicle, hand, exit, phone, pause and boost icons. Short labels and existing accessible names remain. Radiation readings sit beside the phone button. Speed and battery sit at the bottom between the steering and pedal zones. Temporary shield notices and garage prompts occupy separate rows, including at 568 x 320.

Small glass surfaces use an 8px CSS backdrop blur. The standard declaration follows the WebKit-prefixed declaration so CSS optimization does not leave Chrome without blur. No full-screen gameplay blur or new WebGL post-processing pass was added.

Mobile previously disabled native anti-aliasing and could shrink the scene to 0.55 CSS pixels per axis. Normal mobile initialization now requests native MSAA, including when Auto chooses Performance. Auto accepts a stable 40-50 FPS image instead of chasing 60 FPS by reducing pixels. Its ordinary rescue floor is 0.85; constrained-device caps start at 1.0 instead of 0.85. Sustained spare frame time can recover both detail and resolution after a slow loading sample. Manual tiers remain. The explicit low-graphics retry keeps a non-MSAA context for browsers that cannot create the normal context.

Outpost, garage and greenhouse detail culling now retains a small exit band, preventing repeated visibility changes around an exact distance cutoff. Frustum culling stays active. Garage light intensity fades with distance. These changes address two identifiable sources of edge shimmer/detail flicker; physical-device testing is still needed for the reported phone-specific symptoms.

### Verification

- 379 automated tests passed, including new scale-floor/recovery and visibility-boundary cases. Type checking, Sites build and Pages build passed.
- Chrome, Firefox and WebKit completed the 47-state responsive suite without reported layout failures or JavaScript errors. The assertions now check circular action buttons, the circular radar, its top-left placement, absence of its toolbar and hidden gameplay badge.
- Real touch-event checks passed for walking/jump, simultaneous steering/throttle, cancellation, garage rollout/boarding, atlas pinch/pan and failed asset recovery. Rover checks assert the bottom battery placement, glass blur and separation from controls/notices at 568 x 320, 844 x 390 and 1024 x 768.
- A simulated rejection of multisampled WebGL displayed the fallback panel; Performance retry loaded the playable scene with a non-MSAA context.
- ESLint still reports the same four existing React effect errors and eight warnings described above. No lint suppression was added.

One local Chrome sanity sample used an 844 x 390 viewport, DPR 3, mobile Auto, the garage checkpoint and ten final one-second readings. This is desktop GPU emulation, without CPU/network throttling, **not a physical-phone benchmark**:

| Observed value | Before | After |
| --- | ---: | ---: |
| Median sampled FPS | 60.0 | 56.1 |
| Native anti-aliasing | Off | On |
| Render scale at capture | 1.25 | 1.18 |
| Draw calls | 183 | 183 |
| Triangles | 1,423,328 | 1,423,328 |

Auto remained free to recover to 1.25 after capture. Anti-aliasing has a GPU cost; these samples do not establish equal performance on every phone. Browser layout runs execute separately and their diagnostic screenshots are not performance benchmarks. Verify thermal performance, long sessions and nearby-surface flicker on the actual iPhone/Android devices.

[Walking preview](qa/mobile-hud-2026-11-17/walking.jpg) and [driving preview](qa/mobile-hud-2026-11-17/driving.jpg) use the actual game with the FPS meter switched Off through the Flight console. [Verification summary](qa/mobile-hud-2026-11-17/summary.json) records the runs; full local screenshots and frame samples are in `outputs/mobile-priority-*`. Re-run the existing mobile UI/control scripts above. These checks use a local production build; deployed revisions are tracked separately.

### Files changed in this follow-up

| Files | Change |
| --- | --- |
| `ui/mobileInterface.css`, `ui/ExplorationMinimap.tsx`, `ui/MarsFreeRoam.tsx` | Circular radar, hidden gameplay badge, glass surfaces, circular header actions and map focus return |
| `ui/world/MarsTouchDeck.tsx`, `ui/world/RoverTouchDeck.tsx`, `ui/MarsWorld.tsx` | Action icons, compact phone/shield readouts, native mobile AA and graphics-policy integration |
| `game/mobileGraphics.ts`, `game/autoGraphics.ts`, `game/backgroundGraphics.ts` | Mobile pixel floor, 40 FPS adaptation target and recovery after a busy loading sample |
| `ui/world/distanceVisibility.ts`, `createMarsOutpost.ts`, `createRoverGarage.ts`, `createGreenhouseFarm.ts` | Bounded visibility hysteresis and distance-based garage light fade |
| `tests/mobileGraphics.test.mjs`, `tests/distanceVisibility.test.mjs`, mobile UI/control scripts | Regression coverage for quality recovery, visibility stability and revised layout |
| `README.md`, `docs/INTERFACE.md`, this report and accompanying evidence | Updated touch controls, contracts and verification |
