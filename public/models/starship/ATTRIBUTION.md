# SpaceX Starship

- **Model:** [SpaceX Starship](https://sketchfab.com/3d-models/spacex-starship-a8a0b69f776841a1a465cd9fb3762fd2)
- **Author:** [MartianDays](https://sketchfab.com/MartianDays)
- **License:** [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- **Provenance:** The user supplied `spacex_starship.glb`. Its embedded metadata identifies the author, source URL and license above; that metadata is retained in this derivative.

`starship.glb` retains all eight model parts, all 20,630 triangles and the original shared PBR material. Preparation centres the model in X/Z, places its feet at Y=0 and uniformly normalizes its height to 1 for fitting to the game's existing animation. Geometry uses Draco compression. The four embedded 4096-pixel PNG textures become 1024-pixel WebP textures; normal and metallic-roughness maps use lossless compression after resizing. No source parts, engine nozzles or windows were removed.

The supplied original remains unchanged. `source.json` records its SHA-256, the prepared file hash, dimensions and measured nozzle anchors. The game supplies the authored flight, exhaust and catch motion. Those fictional Earth-to-Mars sequences are not an operational SpaceX or NASA flight simulation, and no endorsement is implied.

To reproduce the derivative from the repository root:

```sh
node scripts/prepare-starship.mjs "path/to/spacex_starship.glb" "path/to/asset-tools" "public/models/starship"
```

The last two arguments are optional. Defaults are the existing ignored `outputs/garage-v1/tools` directory and `public/models/starship`. Offline preparation uses glTF Transform 4.2.1, draco3dgltf 1.5.7 and Sharp 0.35.5 from that tool directory, plus the project's Three.js dependency. Ordinary builds and gameplay do not run the preparation script or install these tools.
