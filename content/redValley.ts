// All cutouts register against the same 1675 × 939 user-supplied illustration.
export const redValleyArt = { width: 1675, height: 939, directory: "art/main-menu/red-valley" };

export const redValleyLayers = [
  { name: "sky",       left: 0,   top: 0,   depth: .01,  enterX: 0,   enterY: 0 },
  { name: "moons",     left: 293, top: 85,  depth: .12,  enterX: -17, enterY: -17 },
  { name: "clouds",    left: 0,   top: 35,  depth: .24,  enterX: 20,  enterY: -8 },
  { name: "basin",     left: 0,   top: 210, depth: .43,  enterX: -24, enterY: 11 },
  { name: "ridge",     left: 0,   top: 588, depth: .91,  enterX: 35,  enterY: 37 },
  { name: "explorers", left: 361, top: 707, depth: .925, enterX: 36,  enterY: 39 },
] as const;

export const redValleyShots = [
  { name: "Red Valley",    caption: "Establishing shot",  x: .50,  y: .45,  zoom: 1.025 },
  { name: "Orbital Rise",  caption: "Celestial study",    x: .79,  y: .28,  zoom: 1.65 },
  { name: "The Crossing",  caption: "Expedition detail", x: .245, y: .745, zoom: 2.07 },
] as const;
