# Scientific sources

These references support terrain provenance and educational concepts. They do not validate the game as an operational simulator. Asset attribution is maintained separately in [ASSET_CREDITS.md](../ASSET_CREDITS.md).

## Starship opening reference

- [SpaceX, Starship Flight 15](https://www.spacex.com/launches/starship-flight-15), November 13–14, 2026; accessed November 15, 2026. The postflight account identifies hot-staging, an extended orbital coast, Starship's return, a three-engine landing flip and its first upper-stage tower catch. The published timeline lists the reduction from three landing engines to two, then one, before cutoff. The game's opening compresses this sequence and uses its existing artistic rig; the report does not validate the model geometry, dust, contact mechanics or timings. The booster recovery is omitted from this montage.

## Mars terrain and landmarks

- Perseverance touchdown: Bell et al., *Science Advances* 8, eabo4856 (2022), [NASA NTRS copy, page 1](https://ntrs.nasa.gov/api/citations/20230016428/downloads/Bell%20et%20al%202022sciadv.pdf), reports 18.4446° N, 77.4509° E on 18 February 2021. [NASA's landing-site article](https://science.nasa.gov/resource/welcome-to-octavia-e-butler-landing/) identifies Octavia E. Butler Landing. These support the historical marker, not a live rover location, the artistic model, local rock placement or the crew rover's 50 km/h gameplay speed.

- User-selected region: NASA [Mars Trek](https://trek.nasa.gov/mars/), centre 134.973236° E / 14.089500° N; extent 54.025972–215.920500° E, −46.994483–75.173483° N.
- [NASA PDS MOLA 16-pixel/degree archive](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/) and [MEGDR product documentation](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/document/egdrsis.htm): height source, pixel convention, units, projection and interpolation limits. We use signed elevation samples, not hillshade brightness as height.
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
- Mars surface radiation: [NASA's December 2013 Curiosity results](https://www.nasa.gov/news-release/nasa-rover-results-include-first-age-measurement-on-mars-and-help-for-human-exploration/) report an average **0.67 mSv/day** for Gale Crater during August 2012–June 2013. A [NASA July 2017 radiation-environment briefing](https://www.nasa.gov/wp-content/uploads/2016/05/mars_radiation_environment_nac_july_2017_finaltagged.pdf) reports an MSL-RAD absorbed-dose rate of about **0.213 mGy/day** for its comparison. Milligrays describe absorbed energy; millisieverts account for radiation effects and are not interchangeable with milligrays. Neither historical interval is a constant Mars-wide dose or a calibration of the game's exposure meter.

## Elysium Outpost story science

Verified November 15, 2026. `content/elysiumMissions.json` keeps source links beside short science notes. These sources support concepts and historical observations, not the fictional commissioning procedure, game resource rates or shelter estimates.

- [NASA/JPL · InSight’s solar-panel dust clearing](https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost/), June 3, 2021: dust reduces solar output; wind-carried sand removed some dust and improved output. The game's handheld brushing activity and four-wire junction are fictional exercises, not NASA maintenance procedures.

- [NASA ECLSS overview](https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/): water recovery, air revitalization and oxygen generation are distinct functions. Water electrolysis yields oxygen and hydrogen; cabin carbon dioxide removal is separate. The sensor fault and operating choices are authored exercises.
- [NASA carbon dioxide technical brief](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/): regenerative scrubber beds alternate capture and regeneration. Real ISS equipment can continue cleaning air while another bed regenerates; reduced capacity during the game's maintenance exercise is a simplification.
- [NASA Growing Plants in Space](https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/) and [the Advanced Plant Habitat radish harvest](https://www.nasa.gov/missions/station/astronauts-harvest-radish-crop-on-international-space-station/): lettuce, dwarf wheat and radishes have spaceflight research precedents. Radishes in the cited experiment grew for 27 days. The game's seven-sol forecast is accelerated, not a real crop-growth timetable or proof of dietary sufficiency.
- [Curiosity Sol 3056–3057 update](https://science.nasa.gov/blog/sol-3056-3057-perched-on-top/), March 10, 2021: Nontron drilling and Mont Mercou observations. The educational route marker is a fictional nearby placement, not an exact traverse or live rover position. [NASA's Cooperstown observation](https://science.nasa.gov/resource/curiositys-view-of-cooperstown-outcrop-on-route-to-mount-sharp/) explains autonomous navigation between designated waypoints; people on Earth still plan the mission.
- [NASA/JPL September 2017 Mars event](https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/), published September 29, 2017: enhanced surface radiation and auroras associated with the September 11 event. The linked [DONKI notification](https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/Alert/13118/1) identifies `2017-09-10T16:45:00-SEP-001` as a GOES13 near-Earth particle observation above 10 MeV. It is not a Mars astronaut-dose record. The story stores an archive summary; it does not require a live NASA API request.
- [NASA radiation shielding overview](https://www.nasa.gov/science-research/heliophysics/real-martians-how-to-protect-astronauts-from-space-radiation-on-mars/): the amount and type of shielding matter. Story shelter comparisons are invented estimates for equal drill intervals; shielding reduces new exposure and does not erase accumulated dose. An airlock's pressure seal alone is not a radiation shield.
- [NASA Mars Relay Network](https://science.nasa.gov/mars/mars-relay-network/): Earth–Mars separation varies with orbital positions, with one-way light travel of roughly 3–22 minutes. Story transmissions acknowledge this delay but skip real waiting. The ending does not treat 225 million kilometres as a constant distance.

The legacy Free Exploration radiation display is not a scientific input to the story drill. The story makes no current operational-status claim about a rover, and its route distances and field sensor are not NASA traverse products.
