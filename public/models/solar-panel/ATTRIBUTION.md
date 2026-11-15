# Solar Panel Asset Attribution

- **Asset**: Solar Panel (`solar-panel.glb`)
- **Author**: Harri Snellman ([rivetech on Sketchfab](https://sketchfab.com/rivetech))
- **Source**: [https://sketchfab.com/3d-models/solar-panel-83483a66f8974d7e8f2e7bbde518d606](https://sketchfab.com/3d-models/solar-panel-83483a66f8974d7e8f2e7bbde518d606)
- **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](http://creativecommons.org/licenses/by/4.0/))

## Modifications and Integration in TARUKH

- **Preservation of Quality**: All 2048×2048 (2K) PBR textures (BaseColor, MetallicRoughness, Normal map) are retained without downsampling or lossy recompression.
- **Runtime Assembly**: The standalone solar panel unit is instantiated via Three.js `InstancedMesh` at the Elysium Outpost solar array (replacing legacy geometry at x = -18.0, -14.4, -10.8, -7.2 m, z = 12.88, 15.92 m) and at each of the 6 cultivation dome foundations (gh01–gh06).
- **Collision and Scale**: Scaled from source centimeters (scale 0.02) to accurate meter scale (3.305m width, 1.303m height, 1.329m depth) and centered to align with the colony foundation pads and collision hulls.
