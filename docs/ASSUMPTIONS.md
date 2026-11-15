# Scientific and simulation assumptions

The game uses public scientific data for regional context and authored rules for play. The sources in [SOURCES.md](SOURCES.md) do not validate its speeds, animations, operating procedures.

## Regional terrain

The supplied Mars Trek extent uses an equirectangular projection centred at 134.973236° E, 14.089500° N. North/south uses 12 game metres per degree; east/west includes the cosine of the central latitude. Horizontal scale is approximately 1:4,940 near the centre, with increasing distortion farther away. Elevations are divided by 480 relative to the local landing datum, giving about 10× relief exaggeration relative to horizontal distance.

The 16-pixel/degree MOLA product includes measured and interpolated altimetry. The downsampled crop has roughly 0.316° × 0.318° cells, about 19 km north/south before gameplay compression. It cannot resolve individual rocks, narrow channels or an actual landing pad. Surface grains, local rocks and flattened spawn areas are artistic additions.

Landmarks mark gazetteer feature centres, not necessarily summits or boundaries. Exploration is restricted to the supplied MOLA region: approximately 1.74 × 1.32 game kilometres inside an authored mountain perimeter. These perimeter ridges and their impassable collision walls are gameplay boundaries, not measured Martian features. Detail tiles are only generated where they intersect the survey crop. All seven landmark positions are retained. Perseverance's coordinates mark its historical touchdown; the model and surrounding rocks are original approximations, not a live position feed or measured reconstruction.

## Movement, vehicles and time

The solar-powered garage is a fictional shelter sized around the existing crew rover. Its six panels are assigned 200 W each, with a 6 kWh battery initially holding 4.2 kWh, 170 W of lighting/control demand and a 650 W door motor. The parked rover can recharge through the 850 W dock and 96%-efficient base inverter; its authored 0.35-percentage-point/second charge rate compresses charging time. These are game assumptions, not supplied panel specifications or NASA ratings. Automatic rollout and parking use a slow, safeguarded straight approach; this is not a validated autonomous docking or pressure-control simulation. Parking does not repair or reset the crew rover. The garage battery and docking state last for the current play session only.

Six fictional food-cultivation modules surround the base. Their mature plants, propagation racks and water equipment come from the supplied enclosed greenhouse asset. Six is a layout/design choice, not a claim that the displayed crops feed a specified crew. This adds explorable facilities without restoring mission, resource or harvesting mechanics. Door pressure, crop yields and closed-loop life-support performance are not simulated.

The fictional outpost is placed at human scale on an artistically graded patch of the game's terrain. Its plan, furniture, lights and lifting gates come from the separately reviewed game model, not measured Martian infrastructure. Floors and wall collisions use sampled geometry; indoor headroom uses conservative room-height proxies. Gates operate independently with an occupancy safeguard, without pressure simulation or automatic airlock sequencing. Adding this model does not change the existing radiation-shielding rules for the shuttle and bunker.

Mars movement uses an approximate 3.71 m/s² gravity and an authored launch speed. The suit poses, gait, landing compression and camera response are animation choices, not validated EVA biomechanics. Airborne horizontal velocity persists until collision or landing; short-hop air drag is neglected.

The crew rover's 50 km/h forward and 10 km/h reverse limits, acceleration, braking, steering and mud response are gameplay settings. They are not NASA vehicle specifications. Suspension contacts follow the game's rendered terrain and traversable rocks. Curiosity's patrols and scan effects are simulated; Perseverance is stationary.

LiDAR is a 2D collision scan: 180 horizontal beams over 30 metres, at up to 8 scans per second, with 0.25-metre sampling steps. It uses the driving collision boundaries, excludes traversable stones and does not apply automatic brakes. Finite angular resolution and the 2D approximation limit detection. It is not a reproduction or certification of NASA sensing hardware.

The opening is a 32-second, SpaceX-inspired Earth recovery montage before Mars exploration. A covered cut omits orbital coast; hot-staging, Starship's landing flip, sequential engine shutdown and a tower catch are time-compressed presentation. Dimensions, lift-pin locations, contact altitude, exhaust and dust are authored approximations, not flight telemetry or fluid dynamics. The existing shuttle remains parked as the Mars shelter. A complete visual day/night cycle takes ten active minutes; pause and the opening stop that cycle. This is not a real Martian sol, a survival deadline or a resource simulation.

## Space weather and radiation exposure

Real-world Mars surface radiation doses accumulate over months to years (typically ~0.21 mSv/day quiet GCR background, climbing during rare SEP events). For real-time interactive gameplay and demonstrations, radiation accumulation is time-compressed:
- Baseline EVA exposure rate: `+0.05 mSv/s` (representing unshielded ambient cosmic radiation).
- Active SEP storm exposure rate (`sepFluxPFU >= 10`): `0.6 + Math.log10(sepFluxPFU) * 1.4 mSv/s` (scaling logarithmically with proton flux up to extreme storm levels).
- Habitat and bunker shielding: inside the landing shuttle (`(0, 12)`) or the regolith water bunker (`(-24, 24)`), incoming SEP protons are completely blocked (`0 mSv/s`) and the astronaut undergoes medical decontamination/recovery at `-1.5 mSv/s` down to 0 mSv.
- Acute Radiation Sickness (ARS) symptoms: vision blur (`backdrop-filter: blur()`), red peripheral vignette, CMOS sensor static snow, audio Geiger clicks, 30% movement speed penalty (`radiationExposure >= 70 mSv`), and progressive health degradation above 75 mSv. These represent acute deterministic radiation sickness thresholds in a compressed interactive format rather than a certified medical simulation.

## Separate Starbase preview

The standalone preview follows the dimensions and vehicle configuration in the supplied concept brief, rather than asserting that it reproduces current SpaceX hardware. The 32-second catch is an authored, frame-rate-independent path: descent, hover, arm closure and settling onto the lift pins. Pin-to-rail contact and hydraulic linkage endpoints are geometric constraints. Gravity, aerodynamic forces, fuel, structural loads, collisions outside that scripted contact, and real launch procedures are not modeled. Engine control scales visual exhaust and lighting; it does not calculate acceleration. Upper-stage separation is a presentation animation. This study is separate from Mars gameplay and its scientific terrain data.

## Graphics measurements

Auto targets 40 FPS with a 43 FPS trial threshold and a 90th-percentile frame-time check. Measurements happen after entry and remain in memory. A short probe cannot certify performance under battery saver, thermal throttling, different browser refresh limits or later scene complexity. GPU names do not set the maximum graphics tier; the bounded terrain pool is a separate budget.

Performance's 800-game-metre far plane and reduced detailed-tile ring are rendering choices. They do not bound exploration or describe real Martian visibility. Optional shader preparation can still produce a driver-dependent hitch. Desktop viewport emulation does not measure real-phone performance.
