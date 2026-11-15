# Tarukh

**Mars survival Game**

TARUKH is a browser-based Mars exploration game developed for the NASA Space Apps Challenge 2026, **Build a Junior Astronaut Mission Trainer**. Explore a compressed region of Mars on foot or in a crew rover, using NASA elevation data and a field map to find real landmarks.

[Play the game](https://azaano9.github.io/Tarukh/)

Choose Free Exploration or the Elysium Outpost story. Both use the same Mars world, outpost, greenhouses and rover. In Story, Kaelen Reeves commissions the base through seven connected missions, with neutral terminals, human Mission Control transmissions, science notes and a personal journal. There is no AI companion.


## Features

- A bounded MOLA-based Mars region, with about 1.74 × 1.32 km of playable terrain, seven real landmark locations and an impassable mountain perimeter.
- Elysium missions connect solar repair, separate water/oxygen/CO₂ systems, greenhouse experiments, rover expeditions, an archived radiation drill and a retryable overnight readiness test. Missions 3–5 can be interleaved; conservative, balanced and productive operating plans can succeed. Resources advance through deliberate planning steps, with no failure countdown.
- All seven Story missions use hands-on tablet activities: unpack supplies, rotate pipes, fix gauges, share energy cells, separate oxygen, clean air filters, grow trial plants, trace rover routes, collect and sort rocks, build shielding and repair night-time faults. These 25 workbenches join the wire-repair and solar-brushing games. Instructions are short, NASA explanations are optional, and mouse, touch and keyboard work without pressure timers.
- A Starship opening: coastal Earth launch, an intact orbital coast, then a fictional Mars arrival with the actual outpost in view, engine braking, dust and a chopstick catch. The supplied Starship model stays together throughout the flight and remains at the tower during exploration. Mars loads concurrently; pause or skip the sequence, with a calm presentation for reduced motion.
- Walking, sprinting, jumping, mouse look and switchable first- and third-person cameras. Entering the outpost or a greenhouse smoothly selects first person; leaving restores your previous outdoor view.
- One driveable six-wheel crew rover with a furnished Kepler cockpit, a seated astronaut driver, five live instrument screens, suspension, headlights, terrain contacts, tracks and simulated LiDAR. The screens show vehicle speed, battery/charging, navigation, wheel diagnostics and recent telemetry. It starts inside a solar-powered garage beside the base; a contextual action opens the canopy door and rolls it out. Return to the marked bay and exit to park it automatically.
- An autonomous Curiosity rover and a stationary Perseverance model at its historical Jezero landing site.
- A furnished, human-scale outpost near the landing zone, with a graded Mars foundation, accessible ramp and eleven interactive lift gates. Gates close automatically after the doorway clears; paired airlocks seal one side before opening the other.
- Six enclosed cultivation greenhouses around the base, with retained crops and equipment, level Mars-ground pads, access ramps, E/touch airlocks that close automatically when clear, and leaf markers on the local minimap.
- A minimap and full-region atlas with seven landmark pins and NASA/IAU source links.
- A TARUKH field phone with a six-app home screen for radiation readings, vehicle/suit systems, historical space-weather replays, sound settings, the field map and the science guide.
- A smooth ten-minute day/night cycle during active exploration.
- Automatic keyboard/mouse or touch controls, a landscape rotation guide, fullscreen entry, pause/resume and WebGL retry options. There is no manual device chooser.
- Auto, High, Ultra and Performance graphics, plus optional FPS diagnostics. Mobile Auto uses lighter effects and measured quality selection targeting 60 FPS; desktop Auto targets 40+ FPS. Results depend on the device. Ultra retains indoor contact shading, bloom and localized metallic highlights.
- Installable web-app icons and a local asset cache for repeat visits in static builds. Previously downloaded assets can work offline; live space-weather observations still need a connection.

The region uses NASA MGS/MOLA elevations at a playable scale of approximately 1:4,940, with exaggerated relief. Close-up rocks, materials, the Starship arrival and vehicle behavior are artistic or simulated. TARUKH is not an operational training simulator or a NASA-endorsed product. See [scientific sources](docs/SOURCES.md) and [model assumptions](docs/ASSUMPTIONS.md).

## Technology

React 19, TypeScript 5.9 and Three.js 0.180 provide the interface, simulation and WebGL rendering. Vite 8 builds the static GitHub Pages version. A separate Vinext/Cloudflare Worker build preserves the existing Sites integration. Styling uses CSS and Tailwind CSS; tests use Node's built-in test runner.

The playable game needs no account or application API key. Models, textures, elevation data and Draco decoding files ship with the app. Elysium decisions, resources and journal save locally in this browser, with Resume and a separately confirmed restart. Loading a story save returns the explorer safely beside the base; exact world position is not saved. Curiosity navigation also uses browser-local storage. Story science uses bundled, dated sources. Both modes retain the radiation phone with live NOAA observations and NASA archive replays; these do not drive Story mission outcomes. No gameplay telemetry service is used.

## Run locally

Requirements: **Node.js 22.18+** (Node 24 is used in CI) and **pnpm 11.25.0**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by the development server, normally `http://localhost:5173`. Controls are detected automatically. Click or tap **Explore Mars** for free exploration, or choose **Elysium Story · New / Resume**. Keep the terminal running while playing.

To preview the static production build:

```sh
pnpm build:pages
pnpm build:vercel
pnpm exec vite preview --config vite.pages.config.ts --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/Tarukh/`.

## Controls

| Input | Action |
| --- | --- |
| WASD | Walk; accelerate, brake/reverse and steer while driving |
| Shift | Sprint on foot |
| Space | Jump on foot; handbrake while driving; skip the landing sequence |
| Drag with the mouse | Look around |
| Click the world / Resume mouse look | Request continuous mouse look when supported |
| Q / R | Turn the view |
| V | Switch first- and third-person views |
| F | Enter or exit the nearby crew rover |
| E | Deploy/park the crew rover, operate a nearby gate, inspect a science rover, or use a nearby Story station |
| Caps Lock | Open or close the landmark atlas |
| P / Up arrow | Open the radiation phone; P / Down arrow / Escape closes it |
| Escape | Close a dismissible dialog or open/resume the Flight console; browser fullscreen exit also pauses |
| Pause / Flight console | Open the radial menu for camera, graphics and return to the main menu |

Touch devices automatically show the movement stick, swipe-to-look and contextual rover buttons. The Atlas button opens the full map, with drag, pinch-to-zoom and tap/hold selection. **Flight console** opens a full-screen radial menu over a blurred game view, with sensitivity, camera view, graphics quality and the FPS meter. Hover moves the selection arc and previews a section; click or tap selects it. Keyboard players can use Tab, the dial's arrow keys and Enter. **Main menu** asks for confirmation before leaving the current session. Touch devices use lighter blur, and reduced-motion preferences disable the transitions. Unsupported mouse capture falls back to drag-to-look. Portrait touch screens pause play and show a rotation guide; exiting fullscreen pauses and offers a return button.

For the solar activities, visit the solar station in Story and press E. Drag wires between matching letters/shapes, or select each end with click, tap or Enter. Brush by dragging across the panel; keyboard players focus the panel, use arrows to move the brush and hold Space or Enter while moving. Escape returns to the station without completing an unfinished activity. Completion saves with the mission; an unfinished workbench restarts when reopened.

At other Story stations, choose **Play** to open the tool tablet. Drag a labelled piece to its slot, or select the piece and destination with tap or Tab/Enter. Turn pipe tiles, trace map points or adjust the illustrated dials with pointer or keyboard controls. **Apply** records completed work; Reset and Close do not change mission resources. Finished one-time jobs offer practice, while planning games can update your operating choices. Older completed missions remain completed. The Next step card gives one job, its destination and a direction arrow. After writing a mission journal entry, the completion screen introduces the next mission and its first stop. Use How do I get there? for door and route instructions. Tap the radiation phone, or use P / Up arrow, to check space-weather observations and simulated exposure.

At the garage, use **Open garage · Bring rover out**, then F to drive after the rollout finishes. Boarding always starts in the first-person cockpit; a brief popup explains that **V** (or the mobile camera button) switches views. To return it, stop in the painted return bay, align with its arrows, exit with F and choose **Open garage · Park rover inside**. The same buttons work with touch. Door and vehicle movement pause if their path is occupied. Prepared outpost, greenhouse and garage models are included in the repository; ordinary builds do not require the original authoring files.

## Separate Starbase preview

[Open the launch-and-catch study](https://azaano9.github.io/Tarukh/starbase.html). This separate interactive preview shares its procedural tower, articulated arms, hydraulic pistons and exhaust materials with the game's opening. The preview retains its two-stage engineering model and 32-second booster catch; the game opening uses a fictional single reusable crew vehicle. Drag to orbit, scroll/pinch to zoom, and use **Start catch**, **Pause**, or the rig controls.

`public/starbase.html` contains the renderer, controls and generated scene in one file. Open it directly in a WebGL 2 browser, or use **Script controls → Download this HTML** to save an offline copy. No models, fonts or scripts are downloaded during operation. Rebuild the file after editing its sources:

```sh
node scripts/build-starbase.mjs
```

The public `window.starbaseControls` API is documented in [INTERFACE.md](docs/INTERFACE.md#standalone-starbase-preview). Dimensions follow the supplied concept brief; motion is an authored kinematic demonstration, not a flight or structural-load simulation.

## Checks and publication

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm build:pages
```

The `build` command produces the Sites/Cloudflare deployment in `dist/`; `build:pages` produces `dist-pages/`. The GitHub Actions workflow runs tests, type checking and the static build before publishing `main` to GitHub Pages. The deployed `version.json` records its source commit. Existing React lifecycle lint findings are described in the [engineering notes](docs/INTERFACE.md#validation).

Vercel uses the same static game with root-relative asset URLs: `vercel.json` selects the Vite preset, runs `pnpm run build:vercel` and publishes `dist-vercel/`. Import the repository with its root directory unchanged. Do not select Next.js or `.next` for this deployment: the default `build` script targets Sites/Cloudflare and does not generate Next.js manifests. The Pages build retains its `/Tarukh/` base path.

Keep `.openai/hosting.json`, environment configuration and the separate deployment paths intact. Do not commit credentials, generated builds, local caches or `node_modules`.

## Repository guide

| Directory | Responsibility |
| --- | --- |
| `app/`, `static-app/` | Framework and static entry points |
| `game/` | Movement, collision, vehicle simulation, terrain sampling and state rules |
| `content/` | MOLA crop, landmarks and scientific references |
| `ui/`, `ui/world/` | Interface, rendering, models, cameras and effects |
| `public/` | Shipped models, textures, decoder files and branding |
| `tests/` | Automated simulation, geometry and interface-helper checks |
| `scripts/` | Build integration and reproducible asset preparation |
| `docs/` | Architecture, scientific sources and model assumptions |

See [architecture and validation](docs/INTERFACE.md), the [mobile performance report and layout checks](docs/MOBILE_OPTIMIZATION.md), and the [collaboration workflow](COLLABORATION.md) before contributing.

## Attribution and limitations

[ASSET_CREDITS.md](ASSET_CREDITS.md) identifies the NASA, CC BY, CC0 and original assets. Third-party license notices remain with their files. The repository does not currently contain a project-wide source-code `LICENSE`; asset-specific terms should not be treated as a license for the entire project.

Performance on physical phones and thermal throttling remain device-testing concerns. Public scientific data supports the regional terrain and landmarks; it does not validate the game's driving speeds, fictional spacecraft or authored boundary mountains.
