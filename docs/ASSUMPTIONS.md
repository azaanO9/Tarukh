# Scientific and simulation assumptions

The game uses public scientific data for regional context and authored rules for play. The sources in [SOURCES.md](SOURCES.md) do not validate its speeds, animations, operating procedures.

## Regional terrain

The supplied Mars Trek extent uses an equirectangular projection centred at 134.973236° E, 14.089500° N. North/south uses 12 game metres per degree; east/west includes the cosine of the central latitude. Horizontal scale is approximately 1:4,940 near the centre, with increasing distortion farther away. Elevations are divided by 480 relative to the local landing datum, giving about 10× relief exaggeration relative to horizontal distance.

The 16-pixel/degree MOLA product includes measured and interpolated altimetry. The downsampled crop has roughly 0.316° × 0.318° cells, about 19 km north/south before gameplay compression. It cannot resolve individual rocks, narrow channels or an actual landing pad. Surface grains, local rocks and flattened spawn areas are artistic additions.

Landmarks mark gazetteer feature centres, not necessarily summits or boundaries. Outside the supplied crop, heights clamp to its edge while procedural terrain continues. The interface labels that continuation as a procedural frontier. Perseverance's coordinates mark its historical touchdown; the model and surrounding rocks are original approximations, not a live position feed or measured reconstruction.

## Movement, vehicles and time

Mars movement uses an approximate 3.71 m/s² gravity and an authored launch speed. The suit poses, gait, landing compression and camera response are animation choices, not validated EVA biomechanics. Airborne horizontal velocity persists until collision or landing; short-hop air drag is neglected.

The crew rover's 50 km/h forward and 10 km/h reverse limits, acceleration, braking, steering and mud response are gameplay settings. They are not NASA vehicle specifications. Suspension contacts follow the game's rendered terrain and traversable rocks. Curiosity's patrols and scan effects are simulated; Perseverance is stationary.

LiDAR is a 2D collision scan: 180 horizontal beams over 30 metres, at up to 8 scans per second, with 0.25-metre sampling steps. It uses the driving collision boundaries, excludes traversable stones and does not apply automatic brakes. Finite angular resolution and the 2D approximation limit detection. It is not a reproduction or certification of NASA sensing hardware.

The fictional shuttle's 24-second descent, hatch opening and astronaut exit are presentation. A complete visual day/night cycle takes ten active minutes; pause and landing stop that cycle. This is not a real Martian sol, a survival deadline or a resource simulation.

## Graphics measurements

Auto targets 40 FPS with a 43 FPS trial threshold and a 90th-percentile frame-time check. Measurements happen after entry and remain in memory. A short probe cannot certify performance under battery saver, thermal throttling, different browser refresh limits or later scene complexity. GPU names do not set the maximum graphics tier; the bounded terrain pool is a separate budget.

Performance's 800-game-metre far plane and reduced detailed-tile ring are rendering choices. They do not bound exploration or describe real Martian visibility. Optional shader preparation can still produce a driver-dependent hitch. Desktop viewport emulation does not measure real-phone performance.
