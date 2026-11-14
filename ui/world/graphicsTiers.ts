export const graphicsTiers = {
  performance: {resolutionCap:1, viewDistance:800, fogDensity:.0042, shadows:false, shadowSize:1024, bloom:false, ssao:false, particles:120, smallRocks:3000, terrainTexture:768, hardwareTexture:512},
  auto: {resolutionCap:1.25, viewDistance:1100, fogDensity:.0028, shadows:true, shadowSize:1536, bloom:false, ssao:true, particles:260, smallRocks:6500, terrainTexture:768, hardwareTexture:512},
  high: {resolutionCap:1.5, viewDistance:1100, fogDensity:.0028, shadows:true, shadowSize:2048, bloom:true, ssao:true, particles:260, smallRocks:6500, terrainTexture:768, hardwareTexture:512},
  ultra: {resolutionCap:2, viewDistance:1100, fogDensity:.0028, shadows:true, shadowSize:2048, bloom:true, ssao:true, particles:260, smallRocks:6500, terrainTexture:768, hardwareTexture:512},
} as const;
export type GraphicsTier = keyof typeof graphicsTiers;
export function graphicsTier(name:string) { return graphicsTiers[name as GraphicsTier] ?? graphicsTiers.auto; }
