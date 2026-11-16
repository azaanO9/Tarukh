# Mobile optimisation — November 16, 2026

This pass changes presentation, loading and rendering. Story transitions, mission rewards, collision shapes and driving rules are retained.

## Controls and fullscreen

`game/deviceMode.ts` resolves the primary pointer before considering touch count, hover, viewport/screen hints and mobile/iPad user agents. `ui/useDeviceMode.ts` subscribes to media, resize, visual viewport and orientation changes. This changes controls without replacing the canvas or resetting the story. `?device=mobile` and `?device=pc` are hidden QA overrides.

Click/Tap to start requests fullscreen directly in the user gesture. On mobile devices, the main menu automatically triggers fullscreen and locks orientation to landscape upon initial load and on the very first touch/pointer interaction, and the portrait rotation gate is active directly from the main menu itself. Enter and Space also activate the launch screen. Fullscreen rejection does not block play; leaving fullscreen pauses and offers a return button. Portrait touch screens pause the scene and cinematic and restore them after rotation. The installation hint is dismissible and browser-local.

## Layout and input

Safe-area tokens, dynamic viewport units, grid and flex layouts reserve the top bar, side instruments and bottom thumb controls. Mobile controls use 48-pixel targets and 8-pixel gaps. Menus scroll within their bounds. The phone, field map and graphics panel use one major panel at a time. Atlas input uses pointer capture, a drag threshold, bounded pan/pinch zoom, a debounced tap and long-press detail with optional haptics. Keyboard zoom/navigation remains available.

The main menu switches to a touch-friendly dock on tablet widths and a compact five-choice row on short landscape screens up to 900 pixels wide; scene controls retain 48-pixel touch targets. Settings and About stay within the safe viewport and scroll when their content exceeds it. The minimap reserves the thumb-control band, keeps the radar and waypoint action in a compact panel, and separates the optional FPS readout from the phone/status button. The field phone keeps its handset shape in portrait and widens in short landscape, with its app content scrolling independently. The Expedition Atlas fills the safe viewport on touch devices, stacks map and directory in portrait, and returns to a side-by-side workspace in short landscape; its perspective controls stay clear of the map title, and its 2×2 zoom cluster stays clear of the scale readout.

## Loading and offline use

The world, arrival, minimap, atlas, Story and Perseverance inspection are separate lazy chunks. The lightweight launcher loads directly, avoiding another request waterfall. Moving the inspection behind a lazy boundary also removes the elevation dataset from the first-screen download. The launch screen does not download GLBs or initialize WebGL. The arrival shows completed scene-preparation milestones; its percentage is not a fabricated download-byte estimate.

The static Pages/Vercel build includes a manifest, install icons and a versioned service worker. It installs the small launch shell, then caches game assets when requested. It does not pre-download every model. Quota failures never interrupt successful network requests. Content changes, including model-only changes, produce a new cache version. Updates wait for existing tabs to close rather than reload an active mission. While an update waits, the active worker retains matching HTML and model versions. Separate preview pages cannot overwrite the game's launch cache. The cache excludes external services and API endpoints. Full offline play requires the relevant assets to have loaded at least once and remain in browser storage. An unavailable lazy module shows a reconnect/retry page without erasing saved Story actions. Live NOAA observations require a connection; archived data remains local.

Vercel hashed assets receive a year-long immutable cache header; the worker is revalidated. Compression of production HTTP responses remains the hosting provider's responsibility. The comparison server uses gzip on both builds. Sites retains its existing worker integration; the new offline worker registers only in the static entry.

The handset logo is a 512-pixel WebP: 22,520 bytes instead of 444,068 bytes. Three original install icons add approximately 41 KB. No runtime dependency was added by this pass. The separate, concurrent Vercel analytics commit is outside its scope.

## Runtime budgets

| Mobile detail | Detail distance | Small rocks | Dust particles | Pixel-ratio ceiling |
| --- | ---: | ---: | ---: | ---: |
| Performance | 220 m | 1,200 | 16 | 1.0 |
| Medium | 300 m | 2,500 | 40 | 1.1 |
| High | 400 m | 4,000 | 72 | 1.25 |
| Manual Ultra | 520 m | 5,000 | 120 | 1.5 |

Mobile Auto samples the first three budgets, targeting 60 FPS with a 57 FPS trial threshold. Its shadows and expensive screen-space effects are disabled; existing contact shadows remain. Manual High/Ultra retain optional shading. Weak-device, software-renderer and Save-Data hints start with a 0.85 pixel cap; measurements govern subsequent detail selection. Sustained slow samples reduce resolution gradually, down to 0.55; recovery requires longer stable samples. This is a best-effort policy and does not guarantee a frame rate on every GPU.

Hidden tabs cancel animation frames and clear held input; resuming resets elapsed time. Phone/pause rendering is limited to 10 Hz and active mobile rendering to 60 Hz. Dynamic collision helper objects are reused. A parked rover hidden by the closed, opaque garage no longer draws; it remains prepared for opening the door. Existing instancing, mesh batching, distance/frustum culling, pooled dust/tracks and decoder workers are retained. Physics stays on its current thread to preserve deterministic controls; no OffscreenCanvas renderer rewrite was attempted. Save data is already small and action-based, so its format is preserved.

## Re-run layout checks

Install QA tools outside runtime dependencies:

```sh
npm install --prefix outputs/outpost-tools --no-package-lock playwright-core
pnpm build:pages
pnpm exec vite preview --config vite.pages.config.ts --host 127.0.0.1 --port 4206
node scripts/mobile-layout-check.mjs --url=http://127.0.0.1:4206/Tarukh/ --output=outputs/mobile-layout
```

`PLAYWRIGHT_MODULE` can point to another installed `playwright-core/index.mjs`; `CHROME_PATH` selects Chrome. The check saves screenshots and a JSON result, checks actual safe-area bounds and UI-zone intersections, target sizes/spacing, clipped text, portrait gating and panel containment. Six browser device profiles cover iPhone SE/14/15, Pixel 7, Galaxy S-series and iPad. Viewports include all ten requested sizes. Emulation does not reproduce a physical notch, phone thermals or OS touch interception.

## Browser limits and remaining device checks

- A page cannot force fullscreen without user activation or prevent users from leaving it. The return button is explicit and Escape remains available.
- Unsupported iPhone fullscreen uses the installable standalone presentation and an Add to Home Screen hint. Safari address-bar hiding remains browser controlled; dynamic viewport/safe areas handle the available space.
- Orientation lock and vibration are feature-detected and may be denied. Manual rotation always works.
- Web code cannot block the operating system's notification/control centre or home gestures. Gesture prevention is scoped to the game, preserving menu scrolling and custom atlas pinch zoom.
- Battery saver is not exposed reliably across browsers. Save-Data, hardware hints, reduced motion and measured frame cost are used instead.
- Physical iPhone/Android, phone calls, screen locking and real low-memory eviction still need device testing. No web implementation can guarantee recovery if the operating system kills the process before state is saved; completed Story actions retain the existing local save.

## Before and after measurements

Baseline: `9901ab4`. Final samples used the finished mobile changes over `b83256d`; the intervening analytics commit does not enable analytics in the Pages build. Chrome 153 ran on Windows. A separate canvas using the same browser configuration reported Intel UHD 630 through ANGLE/D3D11, WebGL 2. Both builds used the same local gzip server. Final audits ran sequentially without another test browser or build competing for resources. These are individual laboratory samples, not physical-phone guarantees.

Lighthouse used mobile simulation, 4× CPU slowdown, 150 ms RTT and 1.6 Mbps throughput, with a fresh browser profile. It measures the launcher before Start:

| Launcher metric | Before | After |
| --- | ---: | ---: |
| Lighthouse performance | 81 | 100 |
| First contentful paint | 0.79 s | 0.92 s |
| Largest contentful paint | 4.63 s | 0.92 s |
| Total blocking time | 176 ms | 0 ms |
| Layout shift (CLS) | 0 | 0 |
| Initial transferred bytes | 601,973 | 94,217 |
| All JS chunks, gzip | 665,115 bytes | 671,160 bytes |
| All CSS chunks, gzip | 32,496 bytes | 35,293 bytes |

Initial transfer fell 84%. Total generated JS/CSS grew about 8.8 KB gzip for the new behavior; code splitting changes when code downloads, not its total size. Models and images are excluded from the bundle rows. The logo compression saves approximately 422 KB before the three install icons are added. Large model downloads still occur after Start.

The separate gameplay check used 844 × 390 touch emulation, reduced motion and 4× CPU throttling. Network throttling was removed after Start so the preparation and rendering comparison would not be dominated by model transfer. It sampled the spawn for 20 seconds after the opening completed:

| Gameplay metric | Before | After |
| --- | ---: | ---: |
| Start click to completed preparation/opening | 57.12 s | 53.36 s |
| Mean sampled FPS | 8.25 | 10.17 |
| Last sampled draw calls | 389 | 336 |
| Last sampled triangles | 2,409,883 | 1,803,090 |
| Compiled shader programs | 158 | 101 |
| Selected tier / render scale | Performance / 0.55 | Performance / 0.55 |
| Whole-flow CLS | 0.0044 | 0.0107 |
| Recorded Start interaction duration | 624 ms | 296 ms |

The autonomous rover was allowed to move, so draw calls are illustrative rather than a perfectly controlled geometry benchmark. Before/after images are in [screenshots](screenshots/mobile/README.md). The Start event is not a field INP measurement; its 296 ms duration still exceeds the requested 200 ms target. **The 30/60 FPS goal is not met in this throttled stress test.** The launcher is fast, but full 3D preparation and imported high-poly hardware remain substantial costs. Destructive model simplification, replacing the renderer and moving simulation across threads were not attempted because they require a separate visual/physics regression pass.

An additional **600,029 ms unthrottled stability run** completed 40 phone-app visits, short walks/turns and a synthetic visibility pause/resume check. Auto selected mobile High. Minute-average rendering, including the phone's intentional 10 Hz intervals and the hidden pause, averaged **57.25 FPS** (median 58.04; minimum minute 51.16). This has no matching ten-minute baseline and must not be compared directly with the 4× CPU figures.

Before/after garbage collection measured JS heap at **24.07 → 25.90 MB**, while backing storage stayed near 206.33 MB. Snapshot category totals attributed 1.46 MB of growth to compiled code, including 1.05 MB of instruction streams. Textures stayed at 182; geometries increased from 681 to 684 and shader programs from 98 to 105, then levelled off. There were no browser errors or continuing texture growth in this run. This is not proof against every leak. Full heap snapshots remain in the local QA workspace rather than Git.

An earlier audit run overlapped the soak and recorded an 8.55-second blocking task. It was discarded as a contaminated comparison and replaced by the isolated results above. [Summary and methodology](qa/mobile/performance-summary.json), [before Lighthouse](qa/mobile/before-lighthouse-final.json), [after Lighthouse](qa/mobile/after-lighthouse-final.json), [runtime samples](qa/mobile/isolated-after-profile.json), [memory run](qa/mobile/memory-soak.json) and [heap category comparison](qa/mobile/memory-summary.json) retain the measured evidence.

## Validation and remaining checks

- `pnpm test`: **367 passed**, zero failed.
- `pnpm typecheck`: passed.
- `pnpm build`, `pnpm build:pages` and production `pnpm build:vercel`: passed. Existing large-chunk/framework warnings remain; builds are not warning-free.
- `pnpm lint`: still fails on the existing `setCursorFree(false)` effect in `ui/MarsWorld.tsx`, with three existing hook-dependency warnings. No new lint findings were introduced or suppressed.
- Layout script: **16 captured scenarios**, all ten required viewport sizes, six named device profiles and 11 additional checks. No tested zone overlaps, unsafe bounds, clipped controls, horizontal overflow or browser console errors. [Results](qa/mobile/layout-report.json).
- Actual CDP touch input: pinch zoom, below-threshold movement, drag, tap and long-press passed. [Results](qa/mobile/atlas-touch-report.json).
- Device/fullscreen checks: **12 passed**, including actual fullscreen entry/exit/return, same-canvas pointer changes and portrait pause/resume. [Results](qa/mobile/device-fullscreen.json).
- PWA checks: **4 passed**, including metadata/icons, worker activation and offline launch with the HTTP cache disabled. Failure/recovery checks: **6 passed**, including missing lazy modules in Exploration and Story, retained save data and explicit retry. [PWA](qa/mobile/pwa-check.json), [recovery](qa/mobile/connection-recovery.json).

The automated overlap check covers the named UI zones and captured panel states, not every possible mission workbench. Full offline exploration, a changed-version worker waiting across multiple real tabs, physical iPhone installation, actual phone calls/locks, thermal throttling, OS memory eviction, real safe areas and field INP remain unverified. Test the outpost/greenhouse entrances, garage rollout/return, longer rover expeditions and manual Ultra on representative phones before submission. Do not interpret desktop emulation or a Lighthouse launcher score as certification of mobile gameplay performance.
