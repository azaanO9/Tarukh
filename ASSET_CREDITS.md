# Asset credits

The project combines original geometry and artwork with the attributed models, materials and scientific data below. NASA does not endorse TARUKH. Asset-specific terms do not establish a license for the entire repository.

## Models used by Mars exploration

| Asset | Source and attribution | Use and modifications |
| --- | --- | --- |
| `public/models/astronaut.glb` | [Astronaut rigged and animated](https://sketchfab.com/3d-models/astronaut-rigged-and-animated-f45039084a674080b42f5e171fd4f04c), **assetfactory**. The GLB metadata records **Sketchfab Standard** and links to [Sketchfab licenses](https://sketchfab.com/licenses). Acquisition/license documentation is not included in this repository. | Active rigged astronaut; animated by `game/marsGait.ts` and `createRiggedAstronaut.ts`. An original procedural astronaut is the load-failure fallback. |
| `public/models/starship/starship.glb` | User-supplied **SpaceX Starship** by **MartianDays**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as recorded in the embedded source metadata. [Source and preparation attribution](public/models/starship/ATTRIBUTION.md). | Active Earth/orbit/Mars arrival vehicle. All eight parts and 20,630 triangles retained; uniformly normalized, Draco-compressed, with four 1024px WebP PBR maps. Original game exhaust and fictional catch adapters are fitted at runtime. |
| `public/models/nasa-curiosity-clean.glb` | [NASA Curiosity (Clean)](https://sketchfab.com/3d-models/nasa-curiosity-clean-0696a383f3e841d2b5c7636ee8a58aba), **Thomas Flynn**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), recorded in the GLB metadata. | The NASA plaque on the right rear suspension uses a plain painted material. Original geometry, embedded source attribution and other markings are retained; runtime assembly, suspension, scanning arm and educational effects are implemented in `createCuriosityRover.ts`. |
| `public/models/space-exploration-vehicle-ready.glb` | Derivative of NASA's [Multi-Mission Space Exploration Vehicle](https://science.nasa.gov/3d-resources/space-exploration-vehicle/). See [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). | `prepare-rover.mjs` bakes the transform and wheel/upright partitions, removes unused PNG fallback copies and writes Draco geometry with the source WebP textures. All 413,198 source triangles are retained. The original is kept as `space-exploration-vehicle.glb`. |
| `public/models/solar-panel/solar-panel.glb` | [Solar Panel](https://sketchfab.com/3d-models/solar-panel-83483a66f8974d7e8f2e7bbde518d606), **Harri Snellman (rivetech)**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), recorded in the GLB metadata. | Retains uncompressed 2048×2048 (2K) PBR textures (BaseColor, MetallicRoughness, Normal map). Instanced at the Elysium Outpost solar array (replacing legacy geometry) and near each cultivation dome (gh01–gh06). Attribution recorded in [solar panel attribution](public/models/solar-panel/ATTRIBUTION.md). |

The active crew rover uses the user-supplied Kepler body and furnished cabin in `public/models/kepler-rover/rover.glb`, fitted to the unchanged original wheel and suspension rig. Its [attribution](public/models/kepler-rover/ATTRIBUTION.md) records provenance and preparation; a license for the supplied cabin was not included. The original NASA derivative above remains an offline preparation/test source. Five original runtime screens show current game vehicle readings, including navigation, speed, power, charging and wheel diagnostics.

The cockpit, seven measured glazing contours, vehicle lighting, dust and simulation are game adaptations. They are not presented as authentic NASA instruments or validated vehicle behavior. `roverWindowContours.ts` is derived from the credited MMSEV asset; the original procedural interior in `roverCockpit.ts` remains the load-failure fallback.

## Terrain data and map

- **NASA Mars Global Surveyor / Mars Orbiter Laser Altimeter**, NASA GSFC MOLA team, distributed by NASA PDS Geosciences: dataset `MGS-M-MOLA-5-MEGDR-L3-V1.0`, product `MEGT90N000EB.IMG`, version 2.0, 16 pixels/degree. [Product label](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.lbl).
- `content/marsMolaData.ts` contains a bilinearly resampled 513 × 385 crop, rounded to 16-metre elevation increments, row-delta encoded and stored as base64. Source SHA-256: `d18d9b9ab8c5516d02e157dd2cde0f1d0d160c21940e953ba22391269a545e7b`.
- `scripts/prepare-mars-region.mjs` reproduces that crop and `public/art/mars-mola-overview.webp`, an original shaded-relief rendering of the same values. It is not orbital photography. No NASA map tiles are requested during play.
- The in-game Expedition Atlas relief also uses NASA PDS MOLA MEGDR version 2.0, product `MEGT90N000FB.IMG`, 32 pixels/degree. The matching 2,049 × 1,537 signed-elevation crop is shipped locally as `public/art/mars-atlas/mola-32ppd.bin` and rendered as a 3D height mesh. [Product label](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg032/megt90n000fb.lbl).
- `public/art/mars-atlas/map-base.png` is the map image supplied by the user for this atlas. It is the visible texture; it is not NASA imagery. The NASA MOLA grid supplies mesh height, not map color.
- Named-feature centres come from the [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/). Records retain their source links. Perseverance's historical touchdown source is listed in [SOURCES.md](docs/SOURCES.md).

The projected landscape is compressed and simplified for play. Close-up ground, grading, individual rocks and colors are artistic, not measured landing-site photogrammetry.

## Space weather data

- **NOAA Space Weather Prediction Center (SWPC)**: Real-time GOES satellite integral proton flux (`>=10 MeV`) telemetry via open public JSON feeds (`https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json`). NOAA SWPC data is public domain US Government data.
- **NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI)**: Historical Solar Energetic Particle (SEP) event archive parameters and metadata for significant solar superstorms (May 2024 AR3664 event, September 2017 Mars GLE event, October 2003 Halloween storm). Accessible via NASA Open Data API. NASA does not endorse TARUKH.

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
- Procedural terrain details, streamed rocks, sky, footprints, fallback astronaut and fallback rover were created for the project. The fallback suit is preserved in `createFallbackAstronaut.ts` and `suitMaterials.ts`.
- The bounded exploration area's perimeter mountains are original procedural geometry. They are artistic barriers added to the MOLA crop, not NASA elevation measurements; no new external assets are used.
- `public/team/tarukh-logo.png` and its WebP derivative: original team-supplied TARUKH identity marks. `public/team/tarukh-logo-menu.png` is the user-supplied blue illuminated logo used on the main menu. No logo files are loaded by the 3D exploration renderer.
- `public/art/main-menu/red-valley/`: the supplied Red Valley illustration, separated for Parallax Atlas into sky, moons, clouds, basin, ridge and explorers. The main menu uses those six WebP plates and a still of the illustration. The landscape is fictional.
- `ui/depth-scenes/living-worlds/` and `public/art/main-menu/living-worlds/`: the user-supplied layered alien landscape and its inpainted clean plate, copied from `tarukh-depth-scene`. The original illustration remains the owner's work; no additional license is asserted. It is fantasy artwork, not Mars imagery or scientific terrain.
- `public/art/main-menu/field-expedition/`: the user-supplied illustrated field scene and transparent depth cutouts, copied from `Tarukh_Depth_Scene_2`. Rights to the supplied artwork remain with its owner; no additional license is asserted. It is concept artwork, not official NASA imagery or endorsement.

## Outpost, greenhouses and garage

The game uses the reviewed original TARUKH rover garage, with the supplied **Sci-Fi Door High Poly** by **Scarecrow_original** and **Solar Panel** by **AERO3D**, both CC BY 4.0. [Garage attribution](public/models/garage/ATTRIBUTION.md) records their source links and preparation changes. The derivative retains the original canopy animation, with compressed geometry and WebP textures; its surrounding soil comes from the game. The existing NASA crew rover supplies the vehicle, so neither a duplicate rover nor the review landscape is imported.

The cultivation district uses the user-supplied **Arcadia greenhouse** model, placed six times using shared geometry and textures. Both provided filenames contain the same enclosed source. Its provenance, source hash and preparation changes are recorded in [greenhouse attribution](public/models/greenhouse/ATTRIBUTION.md). The original building deck, crops and equipment are retained; surrounding soil comes from the game's own graded terrain. The game applies a uniform 1.6 scale for astronaut clearance, with matching ramps, doors and collision footprints; the supplied and prepared model files are unchanged. Two 2K solar panels (attributed above) are placed on the perimeter pad behind each greenhouse dome. No additional third-party models were downloaded.

The game uses a derivative of the later v9 white modular campus in `public/models/outpost/`. Its [attribution](public/models/outpost/ATTRIBUTION.md) and [source manifest](public/models/outpost/sources.json) identify all furnishings and the supplied CC BY computer and lift door. Preparation removes the review landscape and basalt, simplifies surfaces conservatively, instances shared geometry, batches static parts and converts textures to WebP at a maximum 1024 pixels. All eleven gate animation clips are retained. The reviewed source exports are unchanged. The three prepared game GLBs ship with the repository and their attribution records.

The game derivative also removes obstructing observatory doorway trim and adds original fitted pressure collars around the ten internal airlock gates. Existing materials and supplied door geometry are retained; no additional external assets are used. These corrections are reproduced by `scripts/outpost-repairs.mjs` during asset preparation.

Ultra's interior highlights use the existing Three.js GGX lighting functions on scoped material clones. Contact shading and bloom use Three.js effects with bounded buffers and scene-depth reuse. This lighting update adds no external models or textures.

## Separate outpost review models

`assets/outpost-review/` retains previews, attribution, a source manifest and a Blender assembly script. The furnished cutaway, full-height GLB and source model binaries are kept locally and excluded from GitHub. These separate review assets are not loaded by Mars exploration. The shell follows the user-supplied **Mars Dune Alpha** floor plan and retains the original TARUKH architecture authored through Higgsfield 3D Jutsu. The revised interior uses 32 openly licensed models assembled in local Blender. The reference image itself is not distributed.

- Laptop: [MacBook by Nicholas-3D](https://sketchfab.com/3d-models/macbook-07f012fbd3bb4c37a1b9ed08533ee403), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The redistributed source has its maker logo removed and a lid pivot; TARUKH opens the lid, fits it to the desks and adds original display artwork.
- Sofa: [Glam Velvet Sofa by Eric Chadwick / Wayfair LLC](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scaled and placed in the recreation area.
- Lounge/dining chairs: [Sheen Chair by Eric Chadwick / Wayfair LLC](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair), CC0.
- Ergonomic chairs, bedding, stainless sink and toilets: Innerscene, CC0. Remaining furnishings and equipment: 3D Assets, CC0; that library reports these models as AI-generated.

Complete per-model links, authors, licenses, modifications and hashes are in the [outpost third-party notices](assets/outpost-review/THIRD_PARTY.md) and [source manifest](assets/outpost-review/sources.json). Those licenses continue to apply when the assembled GLBs are redistributed. The new geometry is not represented as entirely original TARUKH work.

The original habitat is part of [NASA CHAPEA](https://www.nasa.gov/humans-in-space/chapea/), with architecture attributed to [ICON/BIG](https://big.dk/projects/mars-chapea-4310). It is an Earth-based analog habitat. The furnishings, inferred elevations, roof and colour treatment are artistic adaptations, not an official NASA/ICON/BIG model or certified habitat design. See the [asset notes](assets/outpost-review/README.md) for scale, validation and integration limits.

## Separate Starbase study

`public/starbase.html` uses original procedural geometry, generated surface/label textures and a generated reflection environment. No SpaceX photographs, logos, CAD, third-party models or external texture assets are included. The 145-metre tower, 71-metre booster, 50-metre upper stage and 33/6-engine layout follow the user-supplied concept brief, with [SpaceX's Starship reference](https://www.spacex.com/vehicles/starship/) as context. This is an independent artistic study, not an exact survey of current Starbase hardware or an endorsed simulation.

The playable opening uses the supplied, credited Starship model above. The previous original white cylindrical crew vehicle remains solely as its load-failure fallback. It departs a procedurally generated Earth coast and arrives at the actual Mars map without stage separation. Earth launch-apron markings are generated with Canvas. The persistent Mars tower and added catch adapters reuse original project geometry. This is fictional expedition artwork, not a recreation of an actual Earth-to-Mars flight or an endorsed SpaceX simulation.

The game opening reuses this original rig with an authored upper-stage catch trajectory and lift-pin geometry, plus original procedural exhaust cores, shock-diamond/turbulence shading and a pooled ground-dust effect. It takes motion reference from [SpaceX's Flight 15 report](https://www.spacex.com/launches/starship-flight-15), accessed November 15, 2026. The report describes the upper-stage return and catch on November 14. No video frames, logos or third-party effects were copied. Geometry retains the earlier concept dimensions; this is not an exact Flight 15 vehicle reconstruction.

Three.js 0.180, OrbitControls, RoomEnvironment and geometry utilities are bundled into the standalone HTML. Its embedded MIT notice is retained by `scripts/build-starbase.mjs`. The game imports the shared procedural source rather than downloading another copy of this HTML or its bundled renderer.

## Software notices

The optional Elysium storyline adds original canvas-drawn station signs, ground rings and a small procedural field-sensor mast. Its route planner reuses the shipped NASA MOLA map described above. No additional downloaded models, textures, voices or third-party art are used. Story text describes a fictional expedition; its science references and simulation assumptions are listed separately in `docs/SOURCES.md` and `docs/ASSUMPTIONS.md`.

The Story circuit-repair and solar-brushing workbenches use original SVG/CSS hardware illustrations and canvas-generated panel cells, dust and brush marks. No third-party artwork, model, font, audio or downloaded texture is added for these activities.

The other Story workbenches add original SVG/CSS drawings of supplies, pipe joints, gauges, sample rocks, water molecules, plant trays and shelter layers. The rover-route tablet reuses the bundled NASA MOLA relief image with the same compressed route coordinates. No Among Us artwork, sounds, characters or interface assets are used; the interactions are independently implemented.

Three.js modeling, environment and post-processing utilities retain the dependency's MIT license. The vendored Draco decoder is distributed unchanged with its existing notices. Keep `vendor/shadcn-tailwind-4.13.0.LICENSE.md` and `scripts/vite/sites-vite-plugin.LICENSE` with their associated sources.

## Earth-to-Mars departure and persistent catch site

The coastal Earth surface, ocean colours, cloud banks, orbital atmosphere and star field are original procedural geometry in ui/starbase/earthDeparture.ts. The Mars catch site combines the credited supplied Starship with the project's existing procedural tower, on the game's graded Mars ground, with the actual campus visible behind it. The model and its textures ship with the app; no external model service is requested. The Mars catch infrastructure and compressed travel are fictional expedition art, not a reconstruction of an existing Mars launch site. See docs/ARRIVAL.md.

## Field phone

`public/branding/tarukh-phone-logo.png` is the TARUKH logo supplied by the project owner on November 16, 2026, used unchanged. The compact handset shell, flight-computer grid and app icons are original CSS/React styling inspired by in-game smartphones and spaceflight interfaces. Agency and company logos are not used. App symbols use the existing Lucide library. No GTA V artwork, logos, fonts or audio are included.
