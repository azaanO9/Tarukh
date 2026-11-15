export const graphicsTiers = {
  performance: {resolutionCap:1, viewDistance:320, fogDensity:.008, shadows:false, shadowSize:1024, bloom:false, ssao:false, particles:80, smallRocks:3000, terrainTexture:768, hardwareTexture:512},
  auto: {resolutionCap:1.25, viewDistance:420, fogDensity:.0062, shadows:true, shadowSize:1024, bloom:false, ssao:true, particles:180, smallRocks:6500, terrainTexture:768, hardwareTexture:512},
  high: {resolutionCap:1.5, viewDistance:520, fogDensity:.005, shadows:true, shadowSize:1536, bloom:true, ssao:true, particles:220, smallRocks:6500, terrainTexture:768, hardwareTexture:512},
  ultra: {resolutionCap:2, viewDistance:650, fogDensity:.004, shadows:true, shadowSize:1536, bloom:true, ssao:true, particles:260, smallRocks:6500, terrainTexture:768, hardwareTexture:512},
} as const;
export type GraphicsTier = keyof typeof graphicsTiers;
export function graphicsTier(name:string) { return graphicsTiers[name as GraphicsTier] ?? graphicsTiers.auto; }
