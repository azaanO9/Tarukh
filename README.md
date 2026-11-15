# Tarukh

**Mars survival Game**

TARUKH is a browser-based Mars exploration game developed for the NASA Space Apps Challenge 2026, **Build a Junior Astronaut Mission Trainer**. Explore a compressed region of Mars on foot or in a crew rover, using NASA elevation data and a field map to find real landmarks.

[Play the game](https://azaano9.github.io/Tarukh/)

The game is free exploration. The repository contains the current Mars game and its build, asset-preparation and testing tools. Retired mission, quiz, survival, story and lunar modes have been removed.


## Features

- An explorable MOLA-based Mars region with continuous procedural terrain beyond its surveyed extent.
- A shuttle arrival, terrain-aligned landing, opening hatch and astronaut exit; the sequence is skippable and respects reduced motion.
- Walking, sprinting, jumping, mouse look and switchable first- and third-person cameras.
- One driveable six-wheel crew rover with a cockpit, suspension, headlights, terrain contacts, tracks and a simulated LiDAR display. It starts inside a solar-powered garage beside the base; a contextual action opens the canopy door and rolls it out. Return to the marked bay and exit to park it automatically.
- An autonomous Curiosity rover and a stationary Perseverance model at its historical Jezero landing site.
- A furnished, human-scale outpost near the landing zone, with a graded Mars foundation, accessible ramp and eleven interactive lift gates.
- Six enclosed cultivation greenhouses around the base, with retained crops and equipment, level Mars-ground pads, access ramps, E/touch airlocks and leaf markers on the local minimap.
- A minimap and full-region atlas with seven landmark pins and NASA/IAU source links.
- A smooth ten-minute day/night cycle during active exploration.
- PC and mobile controls, a landscape layout for phones, pause/resume and WebGL retry options.
- Auto, High, Ultra and Performance graphics, plus optional FPS diagnostics. Auto measures normal frames after loading and targets 40+ FPS; results depend on the device.

The region uses NASA MGS/MOLA elevations at a playable scale of approximately 1:4,940, with exaggerated relief. Close-up rocks, materials, the shuttle and vehicle behavior are artistic or simulated. TARUKH is not an operational training simulator or a NASA-endorsed product. See [scientific sources](docs/SOURCES.md) and [model assumptions](docs/ASSUMPTIONS.md).

## Technology

React 19, TypeScript 5.9 and Three.js 0.180 provide the interface, simulation and WebGL rendering. Vite 8 builds the static GitHub Pages version. A separate Vinext/Cloudflare Worker build preserves the existing Sites integration. Styling uses CSS and Tailwind CSS; tests use Node's built-in test runner.

The playable game needs no account or application API key. Models, textures, elevation data and Draco decoding files ship with the app. Curiosity's existing navigation save uses browser-local storage; player position and graphics measurements are not persistent. No gameplay telemetry service is used.

## Run locally

Requirements: **Node.js 22.18+** (Node 24 is used in CI) and **pnpm 11.25.0**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by the development server, normally `http://localhost:5173`. Choose PC or Mobile, then select **Explore Mars**. Keep the terminal running while playing.

To preview the static production build:

```sh
pnpm build:pages
pnpm exec vite preview --config vite.pages.config.ts --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/Tarukh/`.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk; accelerate, brake/reverse and steer while driving |
| Shift | Sprint on foot |
| Space | Jump on foot; handbrake while driving; skip the landing sequence |
| Drag with the mouse | Look around |
| Click the world / Capture mouse | Request continuous mouse look when supported |
| Q / R | Turn the view |
| V | Switch first- and third-person views |
| F | Enter or exit the nearby crew rover |
| E | Deploy/park the crew rover at the garage, open/close a nearby base gate, or inspect a nearby science rover |
| Caps Lock | Open or close the landmark atlas |
| Escape | Release mouse capture or close a dismissible dialog |
| Pause button | Pause, resume or return to controls setup |

Mobile mode enables the movement stick, swipe-to-look and contextual rover buttons. The Atlas button opens the full map. **Camera & graphics** contains sensitivity, touch controls, graphics quality and the FPS meter. Unsupported mouse capture falls back to drag-to-look.

At the garage, use **Open garage · Bring rover out**, then F to drive after the rollout finishes. To return it, stop in the painted return bay, align with its arrows, exit with F and choose **Open garage · Park rover inside**. The same buttons work with touch. Door and vehicle movement pause if their path is occupied. Prepared outpost, greenhouse and garage models are included in the repository; ordinary builds do not require the original authoring files.

## Separate Starbase preview

[Open the launch-and-catch study](https://azaano9.github.io/Tarukh/starbase.html). This independent preview is not loaded by the Mars game. It includes a procedural tower, independently articulated catch arms and hydraulic pistons, a movable rocket with separable stages, individual fin/flap controls and a 32-second booster catch sequence. Drag to orbit, scroll/pinch to zoom, and use **Start catch**, **Pause**, or the rig controls.

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

See [architecture and validation](docs/INTERFACE.md) and the [collaboration workflow](COLLABORATION.md) before contributing.

## Attribution and limitations

[ASSET_CREDITS.md](ASSET_CREDITS.md) identifies the NASA, CC BY, CC0 and original assets. Third-party license notices remain with their files. The repository does not currently contain a project-wide source-code `LICENSE`; asset-specific terms should not be treated as a license for the entire project.

Performance on physical phones, thermal throttling and long-distance floating-point precision remain device-testing concerns. Public scientific data supports the regional terrain and landmarks; it does not validate the game's driving speeds or fictional spacecraft.
