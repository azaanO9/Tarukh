# TARUKH industrial-interior research campus — attribution

## Prepared game derivative

`campus.glb` is derived from the reviewed v9 full campus. The following historical revision notes describe its sources and earlier adaptations; claims about unchanged topology or lossless compression apply to those review versions. The game derivative removes 165 presentation-ground and basalt objects, conservatively simplifies geometry (maximum relative error 0.0002), instances shared static parts, batches remaining parts by material, quantizes vertex positions and compresses textures to WebP at quality 90, maximum 1024 pixels. It retains all eleven animated gate clips and uses metre units. These game optimizations are lossy, not a claim of an identical vertex-level copy. The source review GLB and supplied originals are unchanged. The fictional outpost sits on the game's own graded Mars surface, with runtime collisions and door interactions supplied separately. The prepared binary is included with the game.

For the game renderer, refractive glass uses transparent reflective glazing to avoid rendering the entire Mars scene twice. Original glass properties remain in the review source and prepared GLB. Interior furnishings are grouped separately so distant closed rooms can be culled; small static fittings share material batches. These rendering adaptations are not a claim of identical lighting across viewers.

## Supplied computer model

**Sci-fi Computer** by **[Render Blue](https://sketchfab.com/pablojcd)** — [original model](https://sketchfab.com/3d-models/sci-fi-computer-43f296dbc51b40e2b80cb90698c2837b), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The user supplied `sci-fi_computer (1).glb` directly. Its embedded metadata supplies the author, title, source and license. TARUKH retains the original model geometry and places 15 uniformly scaled instances in the outpost (the original 14 plus one new command station). The `Pantalla` display keeps the authored screen graphics, with a new cyan colour grade. New derived body-colour images give the hardware a darker finish; source normal, AO and metallic/roughness detail are retained. The supplied source file and its packed maps are unchanged. Keep this credit and license with any redistributed GLBs; no author endorsement is implied. The source SHA-256 is in `sources.json`.

## Active licensed furnishings

The following source models are retained from v6 and instantiated in this v7 export. They retain their provider attribution and CC0 terms. Placement, scale, color adjustments and display poses from previous reviews are TARUKH adaptations. The retained hologram-table body now carries two Render Blue computers; the floating hologram was removed.

| Source ID | Creator / source | License |
| --- | --- | --- |
| data-pad | [Grab3D](https://grab3d.com/models/sci-fi/data-pad/) | CC0-1.0 |
| holo-map-table | [Grab3D](https://grab3d.com/models/sci-fi/holo-map-table/) | CC0-1.0 |
| hydroponics-rack | [Grab3D](https://grab3d.com/models/sci-fi/hydroponics-rack/) | CC0-1.0 |
| medical-pod | [Grab3D](https://grab3d.com/models/sci-fi/medical-pod/) | CC0-1.0 |
| oxygen-tank | [Grab3D](https://grab3d.com/models/sci-fi/oxygen-tank/) | CC0-1.0 |
| sci-fi-barrel | [Grab3D](https://grab3d.com/models/sci-fi/sci-fi-barrel/) | CC0-1.0 |
| sci-fi-bunk-bed | [Grab3D](https://grab3d.com/models/sci-fi/sci-fi-bunk-bed/) | CC0-1.0 |
| sci-fi-chair | [Grab3D](https://grab3d.com/models/sci-fi/sci-fi-chair/) | CC0-1.0 |
| sci-fi-locker | [Grab3D](https://grab3d.com/models/sci-fi/sci-fi-locker/) | CC0-1.0 |
| sci-fi-table | [Grab3D](https://grab3d.com/models/sci-fi/sci-fi-table/) | CC0-1.0 |
| sci-fi-vending-machine | [Grab3D](https://grab3d.com/models/sci-fi/sci-fi-vending-machine/) | CC0-1.0 |
| water-recycler | [Grab3D](https://grab3d.com/models/sci-fi/water-recycler/) | CC0-1.0 |
| rower | [3D Assets](https://3dassets.dev/assets/gym-and-fitness-studio-rowing-machine-3d9e95df) | CC0-1.0 |
| exercise-bike | [3D Assets](https://3dassets.dev/assets/gym-and-fitness-studio-exercise-bike-upright-7f281ff6) | CC0-1.0 |
| vanity | [3D Assets](https://3dassets.dev/assets/fitted-kitchen-and-bathroom-builder-vanity-600-a8f98629) | CC0-1.0 |
| shower-tray | [3D Assets](https://3dassets.dev/assets/fitted-kitchen-and-bathroom-builder-shower-tray-square-f1ac59e0) | CC0-1.0 |
| shower | [3D Assets](https://3dassets.dev/assets/fitted-kitchen-and-bathroom-builder-shower-riser-rail-4f9ff7aa) | CC0-1.0 |
| robot-arm | [3D Assets](https://3dassets.dev/assets/robots-and-drones-kit-robot-arm-bench-3e979cec) | CC0-1.0 |
| printer | [3D Assets](https://3dassets.dev/assets/factory-conveyor-network-factory-conveyor-network-mach-68efc503) | CC0-1.0 |
| medical-trolley | [3D Assets](https://3dassets.dev/assets/clinic-and-veterinary-practice-ecg-trolley-d5f6cfe3) | CC0-1.0 |
| toilet | [Innerscene](https://www.innerscene.com/tools/library/3d-parts/compact-wc-close-coupled-toilet-84214efd) | CC0-1.0 |
| sci-fi-crate | [Grab3D](https://grab3d.com/models/sci-fi/sci-fi-crate/) | CC0-1.0 |

Grab3D describes its model generation as procedural Blender geometry with AI assistance for scripting. The 3D Assets sources in the existing manifest are marked AI-generated by that provider. No different production method is claimed here. Full source URLs, hashes and earlier adaptation records are retained in `sources.json`.

The ground color map is the previously credited derivative of **[Dry Ground Rocks](https://polyhaven.com/a/dry_ground_rocks)** by **Rob Tuytel / Poly Haven**, [CC0](https://polyhaven.com/license). It is a recolored Earth material scan, not a NASA Mars surface scan.

## Original geometry and visual references

The new industrial wall modules, dark structural framing, service pipes, grilles, deck panels, ceiling fittings and console supports are procedural geometry created for this TARUKH review.

Interior visual direction: **[Sci Fi Modular Asset Pack (Sci Fi Corridor)](https://sketchfab.com/3d-models/sci-fi-modular-asset-pack-sci-fi-corridor-fc5f7e9000d14facbe0ba73f4361734f)** by **Jerome3D / Jerome Angeles** ([ArtStation](https://www.artstation.com/jeromeangeles), [Fab](https://www.fab.com/sellers/Jerome3D)). The reference pack was not downloaded or copied; no geometry, textures or animations from it are redistributed. It is an inspired restyling adapted to the retained room plan, not an identical reproduction.

The retired v5/v6 dome exterior was visually inspired by **[Mars Base by MOJackal](https://sketchfab.com/3d-models/mars-base-2bc6660c63b24158bdded20ff5d2235e)**. No MOJackal geometry, textures or animations are included.

The earlier single-building floor-plan reference was **Mars Dune Alpha**, an Earth-based CHAPEA analog habitat: [NASA CHAPEA](https://www.nasa.gov/humans-in-space/chapea/) and [ICON/BIG](https://big.dk/projects/mars-chapea-4310). Reference screenshots are not redistributed in this delivery. This is an artistic game-asset review, not a certified pressure habitat, official NASA model or endorsed NASA/SpaceX design.

## Retired sources and source history

Seesha's CC BY 4.0 hallway parts, and the former Grab3D `sci-fi-terminal` and `cyberdeck`, are not instantiated in v7. Their records remain in `sources.json` as clearly marked historical inputs. The v7 campus uses new white exterior geometry and retains procedural v6 interior wall panels. Earlier v5 files and their attribution documents are preserved unchanged.

These licenses apply to their respective assets, not automatically to the whole TARUKH repository. Keep this file and `sources.json` with the exported models. All review files remain local; this revision does not upload models to GitHub or alter the playable game.

## V7: supplied entrance and white modular campus

**Sci-fi Door (high poly)** by **[Scarecrow_original](https://sketchfab.com/Scarecrow_original)** — [source model](https://sketchfab.com/3d-models/sci-fi-door-high-poly-2e8c613214144d12bce416ce437614d6), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The user supplied the GLB; embedded metadata identifies its creator and license. Its 53,518 triangles are retained. Adaptations: coordinate normalization, uniform scale, white shell material, moving-panel grouping and a new lift animation. The source file is unchanged. Retain this attribution when redistributing the review models.

The user-supplied video informed the five-module arrangement: a cylindrical habitat, long white cabins, covered branching passages, greenhouse and observatory-style dome. The exterior mesh is newly authored; no reference-video frames or third-party scanned environment geometry are redistributed. This is an inspired artistic reconstruction, not an exact scan of the station in the video.

Existing room furnishings were relocated among five buildings. Six additional greenhouse racks are shared-geometry copies of the credited hydroponics model. The old single-dome shell is not present. New architecture, passage canopies, floor panels, photovoltaic array, thermal hardware, ramps and structural supports are procedural TARUKH geometry. The viewer uses the existing Three.js dependency under MIT; no remotely hosted runtime code or assets are required.

## Interior refit v8

The exterior hull, original solar equipment, room layout, all existing furnishings and the supplied lift-door animation are retained. Original scene transforms and mesh topology were checked before export. Interior material overrides are assigned independently; shared white exterior materials are not globally recoloured.

Added procedural TARUKH geometry includes stepped octagonal inner passages, protected disc lights, three-rib crimson service cassettes, copper conduits and clamps, recessed halo lights, two guarded fans, command controls, articulated supports, a tool chest and harness, workshop tools, a stop-button pedestal, safety markings, botanical plumbing, inner dome lining and EVA-style charging cables. Two additional diagnostic pads reuse the credited Grab3D data-pad geometry. No new external model downloads were used for this refit.

New derived packed base-colour maps are used for the dark interior, brown bunk upholstery, lockers, computer hardware and medical casing. Plant-green texels and the grow-light palette are retained. Original normal and AO detail stays in use. The two small brushed-metal and grain normal maps are original procedural textures. Neither the supplied files nor the preceding review exports are overwritten.

The user's technical brief cites a sci-fi interior by jason (@jasonlee88870) as visual direction. That model was not downloaded or redistributed. The refit is an original interpretation around the existing campus plan, not an exact reproduction of a third-party asset.

The standalone preview uses Three.js (MIT) and its bundled Meshopt decoder (MIT). Asset compression is a verified lossless round-trip for the exported vertex attributes, textures, node transforms and animation data. Bloom and ambient occlusion are viewer effects and are not baked into the GLB specification; lighting will differ in other renderers.

The historical review models are artistic designs, not pressure-habitat engineering designs, and are not endorsed by NASA or any referenced artist. The prepared derivative described above is included in the game. Keep this attribution and sources.json with any redistribution; original authoring and review binaries remain separate.

## Connection gates v9

Ten additional pressure-door instances reuse **Sci-fi Door (high poly)** by **Scarecrow_original**, credited above under CC BY 4.0. They share the original door mesh and texture data. Each is narrowed to the existing walkway and has an independent copy of the entrance's original vertical lift animation. The original entrance remains unchanged. No new third-party models or textures were downloaded.

The surrounding pressure seals, shallow thresholds, raised-panel housings, control plates and identifier labels are new procedural TARUKH geometry. The exterior housings retain the white finish. Original room contents and architecture are retained; cutaway exports omit the new overhead housings so that the moving leaves remain visible.

The historical local Three.js review supplies proximity interaction, independent open/close state, collision checks and a doorway-occupancy safeguard. These scripts are separate from the GLB animation clips. Its gates are artistic interactive doors, without simulated air pressure or automatic airlock sequencing.

The current game derivative removes the observatory glazing trim crossing the doorway and adds ten original TARUKH pressure collars around internal gate frames. The collars reuse the existing white exterior and charcoal interior materials; the clear passage, supplied door geometry, eleven animation clips and source review exports are retained. `scripts/outpost-repairs.mjs` reproduces these changes before the normal preparation pipeline. Runtime game code now automatically closes clear outpost doorways and interlocks paired leaves; this does not model air pressure or change the historical review preview.
