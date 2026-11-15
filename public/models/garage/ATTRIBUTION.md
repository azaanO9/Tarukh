# TARUKH rover garage

This game asset is derived from the separately reviewed TARUKH garage. The prepared binary is included with the game; the original authoring and review models remain separate. NASA does not endorse this fictional design.

## Supplied models

- **Sci-Fi Door High Poly**, by **Scarecrow_original**. [Source model](https://sketchfab.com/3d-models/sci-fi-door-high-poly-2e8c613214144d12bce416ce437614d6), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as recorded in the supplied GLB metadata. The reviewed assembly scales and reorients the supplied door, changes exterior materials to white and animates its existing leaves as an outward-slide/overhead canopy. The game retains that animation. Source-file SHA-256: `1ac403ac0f9ecd67c697d24fe01611a1cb9401d38a26ed1f991af8b0f090f4dc`.
- **Solar Panel**, by **AERO3D**. [Source model](https://sketchfab.com/3d-models/solar-panel-8f094196d83e43fb9865df4c7501a930), [creator](https://sketchfab.com/aero3d.ua), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as recorded in the supplied GLB metadata. The reviewed assembly reorients and scales the panel to approximately 1.32 × 2.643 m, placing six copies on original angled racks. No panel electrical rating was supplied. Source-file SHA-256: `378371f629bfbab3af994602a20c48fbc2f301a332a71b8dbb92a3df1f72eaf6`.

## Original assembly and game derivative

Garage architecture, bulkheads, floor, terminal housings and graphics, grilles, markings, ceiling pipes, battery/controller and cabling were authored for TARUKH in Blender from the owner's video and written art direction. The original corridor mesh was not supplied; this is an interpretation, not that third-party corridor model.

`scripts/prepare-garage.mjs` reads the unchanged reviewed standalone shelter, joins static parts by material, conservatively simplifies original fittings, compresses geometry with Draco and converts embedded textures to WebP at up to 1024 pixels. Door and panel meshes are excluded from geometric simplification, but undergo vertex-precision compression. The derivative contains 930,246 decoded triangles versus 956,866 in the source and retains the original `Garage_Door_Open` channel data. Small differences include removed degenerate triangles and compressed texture detail.

- Reviewed standalone source SHA-256: `2745736fb57e402b6fe018c2e132c51c7016742c40a5a4cdcc0f98f740a07776`.
- Game derivative SHA-256: `4878da3fbbb21c7d357f8d73a29fe38f3270941022bfb7fa26399267ab53f12d` (6,631,348 bytes).

No rover or review terrain is embedded. The game uses its existing credited NASA Multi-Mission Space Exploration Vehicle and its own graded Mars surface. Original reference videos and supplied source models remain unchanged. Three.js, glTF Transform, Meshoptimizer and Draco retain their respective software licenses in the dependency/tool distributions.
