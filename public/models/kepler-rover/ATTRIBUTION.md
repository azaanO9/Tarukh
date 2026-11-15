# Kepler rover cabin

The user supplied `Kepler_Rover_Cockpit.glb` for this integration. Its metadata identifies the generator as **SEV cockpit assembly**. The furnished cabin's author and redistribution license were not included; no CC0 or other open license is asserted here. Keep the original provenance and permission records with the project.

The exterior uses NASA's [Multi-Mission Space Exploration Vehicle](https://science.nasa.gov/3d-resources/space-exploration-vehicle/), also credited in the repository's asset credits. See [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). NASA does not endorse TARUKH.

`scripts/prepare-kepler-rover.mjs` fits the supplied body and full cabin to the existing 4.95-metre game vehicle. It reuses the game's original prepared tire, upright, steering and suspension geometry and pivots without changing them. Static fittings are batched, body/cabin geometry is quantized, buffers are compressed with Meshopt, textures are converted to WebP at up to 1024 pixels, and embedded dynamic lights are omitted. The supplied source file is unchanged.

The five screens use original runtime displays fed by TARUKH's vehicle state: navigation and simulated LiDAR, speed and heading, power and charging, wheel/suspension diagnostics, and a bounded telemetry history. These are **game readings**, not live NASA vehicle telemetry or validated spacecraft instruments. The map uses the project's credited NASA MOLA shaded-relief image.

Source and derivative SHA-256 hashes, byte counts and preparation details are recorded in `source.json`. This attribution does not establish a license for the complete repository.
