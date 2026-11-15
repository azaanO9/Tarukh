import { redValleyShots } from "./redValley";

export const mainMenuScenes = [
  ...redValleyShots.map((shot, index) => ({ ...shot, kind: "red-valley" as const, sourceShot: index })),
  { kind: "living-worlds" as const, name: "Living Worlds", caption: "Celestial frontier" },
  { kind: "field-expedition" as const, name: "Field Expedition", caption: "Crew at work" },
];
