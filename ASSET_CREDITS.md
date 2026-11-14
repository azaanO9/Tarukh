# Asset credits

The project combines original geometry and artwork with the attributed models, materials and scientific data below. NASA does not endorse TARUKH. Asset-specific terms do not establish a license for the entire repository.

## Models used by Mars exploration

| Asset | Source and attribution | Use and modifications |
| --- | --- | --- |
| `public/models/astronaut.glb` | [Astronaut rigged and animated](https://sketchfab.com/3d-models/astronaut-rigged-and-animated-f45039084a674080b42f5e171fd4f04c), **assetfactory**. The GLB metadata records **Sketchfab Standard** and links to [Sketchfab licenses](https://sketchfab.com/licenses). Acquisition/license documentation is not included in this repository. | Active rigged astronaut; animated by `game/marsGait.ts` and `createRiggedAstronaut.ts`. An original procedural astronaut is the load-failure fallback. |
| `public/models/nasa-curiosity-clean.glb` | [NASA Curiosity (Clean)](https://sketchfab.com/3d-models/nasa-curiosity-clean-0696a383f3e841d2b5c7636ee8a58aba), **Thomas Flynn**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), recorded in the GLB metadata. | Original file retained; runtime assembly, suspension, scanning arm and educational effects are implemented in `createCuriosityRover.ts`. |
| `public/models/space-exploration-vehicle-ready.glb` | Derivative of NASA's [Multi-Mission Space Exploration Vehicle](https://science.nasa.gov/3d-resources/space-exploration-vehicle/). See [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). | `prepare-rover.mjs` bakes the transform and wheel/upright partitions, removes unused PNG fallback copies and writes Draco geometry with the source WebP textures. All 413,198 source triangles are retained. The original is kept as `space-exploration-vehicle.glb`. |

The cockpit, seven measured glazing contours, vehicle lighting, dust and simulation are game adaptations. They are not presented as an authentic reconstruction of NASA instruments or validated vehicle behavior. `roverWindowContours.ts` is derived from the credited MMSEV asset; `roverCockpit.ts` adds original interior geometry. No supplied cockpit-reference pixels are distributed.

## Terrain data and map

- **NASA Mars Global Surveyor / Mars Orbiter Laser Altimeter**, NASA GSFC MOLA team, distributed by NASA PDS Geosciences: dataset `MGS-M-MOLA-5-MEGDR-L3-V1.0`, product `MEGT90N000EB.IMG`, version 2.0, 16 pixels/degree. [Product label](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.lbl).
- `content/marsMolaData.ts` contains a bilinearly resampled 513 × 385 crop, rounded to 16-metre elevation increments, row-delta encoded and stored as base64. Source SHA-256: `d18d9b9ab8c5516d02e157dd2cde0f1d0d160c21940e953ba22391269a545e7b`.
- `scripts/prepare-mars-region.mjs` reproduces that crop and `public/art/mars-mola-overview.webp`, an original shaded-relief rendering of the same values. It is not orbital photography. No NASA map tiles are requested during play.
- Named-feature centres come from the [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/). Records retain their source links. Perseverance's historical touchdown source is listed in [SOURCES.md](docs/SOURCES.md).

The projected landscape is compressed and simplified for play. Close-up ground, grading, individual rocks and colors are artistic, not measured landing-site photogrammetry.

## Ground materials

| Shipped prefix in `public/art/mars-surface/` | Source | Author |
| --- | --- | --- |
| `sandy-gravel-*` | [Sandy Gravel 02](https://polyhaven.com/a/sandy_gravel_02) | Dario Barresi / Poly Haven |
| `dry-rocky-soil-*` | [Dry Ground Rocks](https://polyhaven.com/a/dry_ground_rocks) | Rob Tuytel / Poly Haven |
| `fractured-rock-*` | [Dark Rock](https://polyhaven.com/a/dark_rock) | Amal Kumar / Poly Haven |

These materials are [CC0](https://polyhaven.com/license). The verified source URLs and MD5 hashes are retained in `public/art/mars-surface/sources.json`. Adaptations include 2K WebP color maps, 1K packed height/roughness maps, runtime dust grading and procedural blending. `scripts/prepare-mars-surfaces.mjs` reproduces the derivatives. These are Earth material scans, not NASA surface scans.

NASA's [Rocknest view](https://science.nasa.gov/resource/rocknest-from-sol-52-location/) informed material contrast; no Rocknest image pixels are used. NASA describes that image as white-balanced for Earth-like lighting, so it is not a calibrated Mars color target.

## Original work

- `createPerseveranceRover.ts`: original simplified rover geometry, thermal deck, wheel rig, mast, antenna and generated labels. It marks the historical landing position, not the rover's current location.
- `createShuttleLanding.ts`: original fictional spacecraft, landing gear, hatch, stairs, generated glow/dust textures and 24-second landing/exit animation. It is not a NASA vehicle or validated descent simulation.
- Procedural terrain details, streamed rocks, sky, footprints, fallback astronaut and fallback rover were created for the project. The fallback suit is preserved in `createFallbackAstronaut.ts` and `suitMaterials.ts`.
- `public/team/tarukh-logo.png` and its WebP derivative: team-supplied TARUKH branding retained as project identity assets; not loaded during exploration.

## Separate outpost review models

`assets/outpost-review/` retains previews, attribution, a source manifest and a Blender assembly script. The furnished cutaway, full-height GLB and source model binaries are kept locally and excluded from GitHub. These separate review assets are not loaded by Mars exploration. The shell follows the user-supplied **Mars Dune Alpha** floor plan and retains the original TARUKH architecture authored through Higgsfield 3D Jutsu. The revised interior uses 32 openly licensed models assembled in local Blender. The reference image itself is not distributed.

- Laptop: [MacBook by Nicholas-3D](https://sketchfab.com/3d-models/macbook-07f012fbd3bb4c37a1b9ed08533ee403), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The redistributed source has its maker logo removed and a lid pivot; TARUKH opens the lid, fits it to the desks and adds original display artwork.
- Sofa: [Glam Velvet Sofa by Eric Chadwick / Wayfair LLC](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scaled and placed in the recreation area.
- Lounge/dining chairs: [Sheen Chair by Eric Chadwick / Wayfair LLC](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair), CC0.
- Ergonomic chairs, bedding, stainless sink and toilets: Innerscene, CC0. Remaining furnishings and equipment: 3D Assets, CC0; that library reports these models as AI-generated.

Complete per-model links, authors, licenses, modifications and hashes are in the [outpost third-party notices](assets/outpost-review/THIRD_PARTY.md) and [source manifest](assets/outpost-review/sources.json). Those licenses continue to apply when the assembled GLBs are redistributed. The new geometry is not represented as entirely original TARUKH work.

The original habitat is part of [NASA CHAPEA](https://www.nasa.gov/humans-in-space/chapea/), with architecture attributed to [ICON/BIG](https://big.dk/projects/mars-chapea-4310). It is an Earth-based analog habitat. The furnishings, inferred elevations, roof and colour treatment are artistic adaptations, not an official NASA/ICON/BIG model or certified habitat design. See the [asset notes](assets/outpost-review/README.md) for scale, validation and integration limits.

## Software notices

Three.js modeling, environment and post-processing utilities retain the dependency's MIT license. The vendored Draco decoder is distributed unchanged with its existing notices. Keep `vendor/shadcn-tailwind-4.13.0.LICENSE.md` and `scripts/vite/sites-vite-plugin.LICENSE` with their associated sources.
