# Scientific sources

These references support terrain provenance and educational concepts. They do not validate the game as an operational simulator. Asset attribution is maintained separately in [ASSET_CREDITS.md](../ASSET_CREDITS.md).

## Starship opening reference

- [SpaceX, Starship Flight 15](https://www.spacex.com/launches/starship-flight-15), November 13–14, 2026; accessed November 15, 2026. The postflight account identifies hot-staging, an extended orbital coast, Starship's return, a three-engine landing flip and its first upper-stage tower catch. The published timeline lists the reduction from three landing engines to two, then one, before cutoff. The game's opening compresses this sequence and uses its existing artistic rig; the report does not validate the model geometry, dust, contact mechanics or timings. The booster recovery is omitted from this montage.

## Mars terrain and landmarks

- Perseverance touchdown: Bell et al., *Science Advances* 8, eabo4856 (2022), [NASA NTRS copy, page 1](https://ntrs.nasa.gov/api/citations/20230016428/downloads/Bell%20et%20al%202022sciadv.pdf), reports 18.4446° N, 77.4509° E on 18 February 2021. [NASA's landing-site article](https://science.nasa.gov/resource/welcome-to-octavia-e-butler-landing/) identifies Octavia E. Butler Landing. These support the historical marker, not a live rover location, the artistic model, local rock placement or the crew rover's 50 km/h gameplay speed.

- User-selected region: NASA [Mars Trek](https://trek.nasa.gov/mars/), centre 134.973236° E / 14.089500° N; extent 54.025972–215.920500° E, −46.994483–75.173483° N.
- [NASA PDS MOLA 16-pixel/degree archive](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/) and [MEGDR product documentation](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/document/egdrsis.htm): height source, pixel convention, units, projection and interpolation limits. We use signed elevation samples, not hillshade brightness as height.
- The Expedition Atlas 3D relief uses the [NASA PDS MOLA 32-pixel/degree product archive](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg032/) and the same MEGDR product documentation. A locally shipped crop drives the height mesh; the map color texture was supplied by the user.
- IAU/USGS feature centres: [Elysium Mons](https://planetarynames.wr.usgs.gov/Feature/1783), [Albor Tholus](https://planetarynames.wr.usgs.gov/Feature/166), [Hecates Tholus](https://planetarynames.wr.usgs.gov/Feature/2407), [Gale](https://planetarynames.wr.usgs.gov/Feature/2071), [Hebrus Valles](https://planetarynames.wr.usgs.gov/Feature/2404), [Elysium Planitia](https://planetarynames.wr.usgs.gov/Feature/1784). Planetocentric latitude, east-positive longitude; the MOLA-network records are used where multiple coordinate records are shown.

## Mars sources

- NASA Mars solar time: https://www.giss.nasa.gov/tools/mars24/help/notes.html (mean sol approximately 24 h 39 min 35 s).
- NASA Mars gravity: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars/ (approximately 3.7 m/s²).


Mars movement and airborne dust reference: [NASA Glenn Mars gravity](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars/) and [NASA Dusty Differences Between Mars and Earth](https://science.nasa.gov/earth/earth-observatory/dusty-differences-between-mars-and-earth-149926/). Existing Poly Haven CC0 scans remain the rock material source.


Jump motion follows [projectile mechanics](https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion): horizontal momentum persists without an external force and vertical altitude follows gravity. [Pavei and Minetti, 2016](https://pubmed.ncbi.nlm.nih.gov/26635350/) studied human hopping in simulated Martian and lunar gravity. This research informs the movement direction, while the game’s specific skeletal poses remain authored animation.

- NASA, Space Exploration Vehicle: https://science.nasa.gov/3d-resources/space-exploration-vehicle/ — identifies the crewed concept and describes approximately 10 km/h surface travel for the concept reference; does not validate the game's authored 50 km/h forward cap, reverse, braking or simulated lidar parameters. Accessed 2026-11-11.

## Space weather and solar energetic particles (SEP)

- NOAA Space Weather Prediction Center (SWPC): GOES-R series primary integral proton flux (`>=10 MeV`, units in PFU - Particles / [cm² · s · sr]), endpoint: https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json. Supports live real-time space weather monitoring.
- NOAA Space Weather Scales (Solar Radiation Storms S1–S5): https://www.swpc.noaa.gov/noaa-scales-explanation (S1 Minor >= 10 PFU, S2 Moderate >= 100 PFU, S3 Strong >= 1,000 PFU, S4 Severe >= 10,000 PFU, S5 Extreme >= 100,000 PFU).
- NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI): https://kauai.ccmc.gsfc.nasa.gov/DONKI/ and NASA Open Data API (`/DONKI/SEP`). Provides historical solar energetic particle superstorm event catalogues (May 2024 Mother's Day storm AR3664, September 2017 Mars GLE/X8.2 flare, and October 2003 Halloween extreme solar storms).
- Mars surface radiation environment: Curiosity Rover Radiation Assessment Detector (RAD) measurements (Zeitlin et al., *Science* 340, 2013; Hassler et al., *Science* 343, 2014) report typical galactic cosmic ray (GCR) quiet surface background of approximately 0.2–0.3 mSv/day (~0.64 mGy/day), spiking during major SEP events. This informs the baseline vs storm distinction; specific gameplay accumulation rates are time-compressed for interactive gameplay.
