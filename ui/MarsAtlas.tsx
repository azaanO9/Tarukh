"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { MARS_LANDMARKS, MARS_TREK_URL } from "../content/marsLandmarks";
import {
  REGION_WORLD_BOUNDS as B,
  worldToMars,
  sampleMarsElevation,
  marsRegionalHeight,
} from "../game/marsRegion";
import { marsOutpostHeight } from "../game/marsExpeditionTerrain";
import { PLAYABLE_BOUNDS } from "../game/explorationBounds";
import { OUTPOST_SITE } from "../game/outpostSite";
import { GARAGE_SITE } from "../game/garageSite";
import { GREENHOUSE_SITES } from "../game/greenhouseSites";
import { assetUrl } from "../lib/assetUrl";
import type { View } from "./MarsWorld";

const ATLAS_HEIGHT_WIDTH = 2049;
const ATLAS_HEIGHT_HEIGHT = 1537;
const ATLAS_MESH_COLUMNS = 1025;
const ATLAS_MESH_ROWS = 769;
const RELIEF_TILT = 0.69;
const RELIEF_HEIGHT_DIVISOR = 480;
const smoothAtlasBlend = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

function sampleAtlasHeight(data: Int16Array, u: number, v: number): number {
  const fx = Math.max(0, Math.min(ATLAS_HEIGHT_WIDTH - 1, u * (ATLAS_HEIGHT_WIDTH - 1)));
  const fy = Math.max(0, Math.min(ATLAS_HEIGHT_HEIGHT - 1, v * (ATLAS_HEIGHT_HEIGHT - 1)));
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const x1 = Math.min(ATLAS_HEIGHT_WIDTH - 1, x + 1);
  const y1 = Math.min(ATLAS_HEIGHT_HEIGHT - 1, y + 1);
  const tx = fx - x;
  const ty = fy - y;
  const a = data[y * ATLAS_HEIGHT_WIDTH + x] * (1 - tx) + data[y * ATLAS_HEIGHT_WIDTH + x1] * tx;
  const b = data[y1 * ATLAS_HEIGHT_WIDTH + x] * (1 - tx) + data[y1 * ATLAS_HEIGHT_WIDTH + x1] * tx;
  return a * (1 - ty) + b * ty;
}

export interface AtlasSite {
  id: string;
  name: string;
  kind: "volcano" | "crater" | "valley" | "plain" | "landing site" | "base" | "infrastructure" | "waypoint";
  typeLabel: string;
  x: number;
  z: number;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  description: string;
  source?: string;
  sourceLabel?: string;
}

export const EXPEDITION_BASES: AtlasSite[] = [
  {
    id: "shuttle",
    name: "Landing Shuttle Base",
    kind: "base",
    typeLabel: "Base",
    x: 0,
    z: 12,
    description: "Primary landing craft and pressurized environmental shelter. Full 100% radiation shielding.",
  },
  {
    id: "outpost",
    name: "Habitat Campus Outpost",
    kind: "base",
    typeLabel: "Base",
    x: OUTPOST_SITE.x,
    z: OUTPOST_SITE.z,
    description: "Main surface habitat modules, airlocks, and life support control systems.",
  },
  {
    id: "garage",
    name: "Rover Garage & Charger",
    kind: "infrastructure",
    typeLabel: "Infrastructure",
    x: GARAGE_SITE.x,
    z: GARAGE_SITE.z,
    description: "MMSEV maintenance bay, 1,200W solar inverter array, and automated battery dock.",
  },
  {
    id: "greenhouses",
    name: "Hydroponic Greenhouse Farm",
    kind: "infrastructure",
    typeLabel: "Infrastructure",
    x: GREENHOUSE_SITES[0].x,
    z: GREENHOUSE_SITES[0].z,
    description: "Six circular pressurized crop domes producing oxygen and expedition food rations.",
  },
];

const ATLAS_SITE_LOGOS: Record<string, string[]> = {
  shuttle: ["M12 3c3 2.2 4.2 5.1 4.2 10.3L12 16l-4.2-2.7C7.8 8.1 9 5.2 12 3Z", "m8 11-3 4 5-1", "m16 11 3 4-5-1", "m10 18 2 3 2-3"],
  outpost: ["M3 20h18", "M5 20V9l7-5 7 5v11", "M9 20v-7h6v7", "M8 10h.01M16 10h.01"],
  garage: ["M3 16h18l-2-6H7l-4 6Z", "M6 16v2M18 16v2", "M7 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z", "M9 10V7h6v3"],
  greenhouses: ["M3 20h18", "M5 19v-5a7 7 0 0 1 14 0v5", "M12 7V4", "M8 14h.01M16 14h.01"],
  elysium: ["m3 20 8-14 3 6 2-3 5 11H3Z", "M10 11h2M13 15h2"],
  albor: ["m4 20 7-11 2 3 2-5 5 13H4Z", "M11 13h2"],
  hecates: ["m3 20 9-15 9 15H3Z", "M10 10h4", "M11 7h2"],
  gale: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z", "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"],
  hebrus: ["M3 7c3 0 3 3 6 3s3-3 6-3 3 3 6 3", "M3 12c3 0 3 3 6 3s3-3 6-3 3 3 6 3", "M3 17c3 0 3 3 6 3s3-3 6-3 3 3 6 3"],
  plains: ["M3 7h18", "M3 12h18", "M3 17h18", "M7 4v16M17 4v16"],
  perseverance: ["M4 17h16", "M7 17v-5l5-3 5 3v5", "M12 9V5l3-2", "M6 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM18 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z", "M14 5h3"],
};

function AtlasSiteLogo({ site }: { site: AtlasSite }) {
  const paths = ATLAS_SITE_LOGOS[site.id] ?? ["M4 18 12 5l8 13H4Z", "M9 15h6"];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, index) => <path key={`${site.id}-${index}`} d={d} />)}
    </svg>
  );
}

interface Waypoint {
  x: number;
  z: number;
  label: string;
}

interface Point2D {
  x: number;
  z: number;
}

type RouteState = "preview" | "armed" | "driving" | "paused" | "arrived";

export default function MarsAtlas({
  x,
  z,
  selected,
  onSelect,
  onClose,
  view,
  storyTarget,
  storyRoute,
}: {
  x: number;
  z: number;
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  view?: View;
  storyTarget?: { label: string; x: number; z: number };
  storyRoute?: readonly { x: number; z: number }[];
}) {
  // Navigation & perspective states
  const [zoom, setZoom] = useState(1.1);
  const [pan, setPan] = useState({ x: 0, z: 0 });
  const [perspective, setPerspective] = useState<"plan" | "relief">("plan");
  const [showContours, setShowContours] = useState(true);
  const [activeTab, setActiveTab] = useState<"sites" | "log">("sites");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "volcano" | "crater" | "base">("all");
  const [selectedSiteId, setSelectedSiteId] = useState<string>(selected || "elysium");
  const [waypoint, setWaypoint] = useState<Waypoint | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });
  const [terrainReady, setTerrainReady] = useState(false);
  const [reliefRendererReady, setReliefRendererReady] = useState(false);
  const [heightData, setHeightData] = useState<Int16Array | null>(null);
  const [heightDatum, setHeightDatum] = useState<number | null>(null);

  // Traverse simulation and route state
  const [routeState, setRouteState] = useState<RouteState>("preview");
  const [traverseProgress, setTraverseProgress] = useState(0);
  const [simulatedRover, setSimulatedRover] = useState<Point2D | null>(null);
  const [pulseRing, setPulseRing] = useState(1);
  const [animTime, setAnimTime] = useState(0);

  const [traverseLogs, setTraverseLogs] = useState<string[]>([
    "Rover online at landing site.",
    "MOLA elevation survey loaded · Elysium Quadrangle.",
    "Telemetry link active with orbital constellation.",
    "Surface survey started.",
  ]);

  const mapViewportRef = useRef<HTMLDivElement>(null);
  const baseMapCanvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const reliefCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseMapImageRef = useRef<HTMLImageElement | null>(null);
  const reliefSceneRef = useRef<THREE.Scene | null>(null);
  const reliefCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const reliefRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const reliefMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const messageTimeoutRef = useRef<number | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panZ: 0 });
  const dragDistanceRef = useRef(0);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistanceRef = useRef<number | null>(null);

  // Region dimensions
  const regionWidth = B.east - B.west;
  const regionHeight = B.south - B.north;
  const centerX = (B.west + B.east) / 2;
  const centerZ = (B.north + B.south) / 2;
  const terrainDatum = useMemo(() => {
    const center = worldToMars(centerX, centerZ);
    return sampleMarsElevation(center.longitude, center.latitude);
  }, [centerX, centerZ]);
  const terrainHeightAt = useCallback((wx: number, wz: number) => {
    const heights = heightData;
    if (!heights) {
      const mars = worldToMars(wx, wz);
      return (sampleMarsElevation(mars.longitude, mars.latitude) - terrainDatum) / RELIEF_HEIGHT_DIVISOR;
    }
    const u = (wx - B.west) / regionWidth;
    const v = (wz - B.north) / regionHeight;
    const datum = heightDatum ?? terrainDatum;
    const mola = (sampleAtlasHeight(heights, u, v) - datum) / RELIEF_HEIGHT_DIVISOR;
    const localWeight = 1 - smoothAtlasBlend(185, 320, Math.hypot(wx, wz + 65));
    if (localWeight <= 0) return mola;
    return mola + (marsOutpostHeight(wx, wz) - marsRegionalHeight(wx, wz)) * localWeight;
  }, [regionWidth, regionHeight, terrainDatum, heightData, heightDatum]);

  // Synchronize viewport size on resize/rotation
  useEffect(() => {
    const vp = mapViewportRef.current;
    if (!vp) return;
    const updateSize = () => {
      const rect = vp.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  // Build the atlas relief once. The interactive pins and route remain HTML/game state overlays.
  useEffect(() => {
    const canvas = reliefCanvasRef.current;
    const image = baseMapImageRef.current;
    const heights = heightData;
    if (!terrainReady || !canvas || !image || !heights) return;

    let renderer: THREE.WebGLRenderer;
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let texture: THREE.Texture | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x563b2d, 1);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x563b2d);

      const positions = new Float32Array(ATLAS_MESH_COLUMNS * ATLAS_MESH_ROWS * 3);
      const uvs = new Float32Array(ATLAS_MESH_COLUMNS * ATLAS_MESH_ROWS * 2);
      const elevation = new Float32Array(ATLAS_MESH_COLUMNS * ATLAS_MESH_ROWS);
      for (let row = 0; row < ATLAS_MESH_ROWS; row++) {
        const v = row / (ATLAS_MESH_ROWS - 1);
        const z = B.north + regionHeight * v;
        for (let column = 0; column < ATLAS_MESH_COLUMNS; column++) {
          const u = column / (ATLAS_MESH_COLUMNS - 1);
          const x = B.west + regionWidth * u;
          const index = row * ATLAS_MESH_COLUMNS + column;
          const heightAt = terrainHeightAt(x, z);
          positions[index * 3] = x;
          positions[index * 3 + 1] = heightAt * 5;
          positions[index * 3 + 2] = z;
          elevation[index] = heightAt;
          uvs[index * 2] = u;
          uvs[index * 2 + 1] = 1 - v;
        }
      }

      const indices = new Uint32Array((ATLAS_MESH_COLUMNS - 1) * (ATLAS_MESH_ROWS - 1) * 6);
      let indexOffset = 0;
      for (let row = 0; row < ATLAS_MESH_ROWS - 1; row++) {
        for (let column = 0; column < ATLAS_MESH_COLUMNS - 1; column++) {
          const northwest = row * ATLAS_MESH_COLUMNS + column;
          const southwest = northwest + ATLAS_MESH_COLUMNS;
          const northeast = northwest + 1;
          const southeast = southwest + 1;
          indices[indexOffset++] = northwest;
          indices[indexOffset++] = southwest;
          indices[indexOffset++] = northeast;
          indices[indexOffset++] = northeast;
          indices[indexOffset++] = southwest;
          indices[indexOffset++] = southeast;
        }
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geometry.setAttribute("elev", new THREE.BufferAttribute(elevation, 1));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();

      texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      material = new THREE.ShaderMaterial({
        uniforms: {
          imageMap: { value: texture },
          contour: { value: 1 },
          contourInterval: { value: 1000 },
          relief: { value: 1 },
        },
        vertexShader: `
          attribute float elev;
          varying float el;
          varying vec2 coords;
          varying vec3 faceNormal;
          void main() {
            el = elev;
            coords = uv;
            faceNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D imageMap;
          uniform float contour;
          uniform float contourInterval;
          uniform float relief;
          varying float el;
          varying vec2 coords;
          varying vec3 faceNormal;
          void main() {
            vec3 color = texture2D(imageMap, coords).rgb;
            float light = 0.70 + 0.50 * max(dot(normalize(faceNormal), normalize(vec3(-0.42, 0.82, 0.36))), 0.0);
            color *= mix(1.0, light, relief);
            float level = el / (contourInterval / 480.0);
            float line = abs(fract(level + 0.5) - 0.5);
            color = mix(color, vec3(0.72, 0.82, 0.64), contour * (1.0 - smoothstep(0.012, 0.045, line)) * 0.48);
            gl_FragColor = vec4(color, 1.0);
            #include <colorspace_fragment>
          }
        `,
        side: THREE.DoubleSide,
      });
      const terrain = new THREE.Mesh(geometry, material);
      terrain.frustumCulled = false;
      scene.add(terrain);

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20000);
      camera.up.set(0, 0, -1);
      reliefSceneRef.current = scene;
      reliefCameraRef.current = camera;
      reliefRendererRef.current = renderer;
      reliefMaterialRef.current = material;
      requestAnimationFrame(() => {
        setReliefRendererReady(true);
      });
    } catch (error) {
      console.error("Mars atlas 3D relief could not be initialized:", error);
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      return;
    }

    return () => {
      setReliefRendererReady(false);
      reliefRendererRef.current = null;
      reliefCameraRef.current = null;
      reliefSceneRef.current = null;
      reliefMaterialRef.current = null;
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      renderer.dispose();
    };
  }, [terrainReady, regionHeight, regionWidth, terrainHeightAt, heightData]);

  // Keep the real mesh camera in the same world-space view as the game overlays.
  useEffect(() => {
    const renderer = reliefRendererRef.current;
    const camera = reliefCameraRef.current;
    const scene = reliefSceneRef.current;
    const viewport = mapViewportRef.current;
    if (!renderer || !camera || !scene || !viewport) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;

    renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewSpan = Math.max(regionHeight, regionWidth / aspect) / zoom;
    const halfW = viewSpan * aspect / 2;
    const viewCX = centerX + pan.x;
    const viewCZ = centerZ + pan.z;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = viewSpan / 2;
    camera.bottom = -viewSpan / 2;
    camera.near = 0.1;
    camera.far = 10000;
    const cameraDistance = viewSpan * 1.6;
    camera.position.set(
      viewCX,
      cameraDistance * Math.cos(RELIEF_TILT),
      viewCZ + cameraDistance * Math.sin(RELIEF_TILT)
    );
    camera.lookAt(viewCX, 0, viewCZ);
    camera.updateProjectionMatrix();
    const material = reliefMaterialRef.current;
    if (material) {
      material.uniforms.contour.value = showContours ? 1 : 0;
      material.uniforms.contourInterval.value = zoom > 2 ? 500 : 1000;
      material.uniforms.relief.value = perspective === "relief" ? 1 : 0;
    }
    renderer.render(scene, camera);
  }, [terrainReady, reliefRendererReady, viewportSize, zoom, pan, centerX, centerZ, regionWidth, regionHeight, showContours, perspective]);

  // Load the supplied north-up raster and the matching NASA MOLA height crop locally.
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load the Mars atlas base map."));
      image.src = assetUrl("art/mars-atlas/map-base.png");
    });
    const heightsLoaded = fetch(assetUrl("art/mars-atlas/mola-32ppd.bin"))
      .then((response) => {
        if (!response.ok) throw new Error(`MOLA terrain request failed (${response.status}).`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const heights = new Int16Array(buffer);
        if (heights.length !== ATLAS_HEIGHT_WIDTH * ATLAS_HEIGHT_HEIGHT) {
          throw new Error("The Mars atlas elevation crop has an unexpected size.");
        }
        return heights;
      });

    Promise.all([imageLoaded, heightsLoaded])
      .then(([loadedImage, heights]) => {
        if (cancelled) return;
        baseMapImageRef.current = loadedImage;
        const datum = sampleAtlasHeight(heights, 0.5, 0.5);
        setHeightData(heights);
        setHeightDatum(datum);
        setTerrainReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Mars atlas terrain assets could not be loaded:", error);
        // The raster remains usable if WebGL or the optional elevation asset is unavailable.
        imageLoaded.then((loadedImage) => {
          if (!cancelled) {
            baseMapImageRef.current = loadedImage;
            setTerrainReady(true);
          }
        }).catch(() => undefined);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Active rover / astronaut position
  const rawRoverX = view?.roverX ?? x;
  const rawRoverZ = view?.roverZ ?? z;
  const isDriving = Boolean(view?.roverDriving);
  const roverYaw = view?.yaw ?? 0;

  // In simulated traverse mode, rover position follows route progress
  const roverX = simulatedRover ? simulatedRover.x : rawRoverX;
  const roverZ = simulatedRover ? simulatedRover.z : rawRoverZ;

  // Combine real landmarks with expedition bases
  const allSites: AtlasSite[] = useMemo(() => {
    const landmarks: AtlasSite[] = MARS_LANDMARKS.map((lm) => ({
      id: lm.id,
      name: lm.name,
      kind: lm.kind as AtlasSite["kind"],
      typeLabel:
        lm.kind === "volcano"
          ? "Volcano"
          : lm.kind === "crater"
            ? "Crater"
            : lm.kind === "valley"
              ? "Valley"
              : lm.kind === "landing site"
                ? "Landing site"
                : "Plain",
      x: lm.x,
      z: lm.z,
      latitude: lm.latitude,
      longitude: lm.longitude,
      description: lm.description,
      source: lm.source,
      sourceLabel: lm.sourceLabel,
    }));

    return [...EXPEDITION_BASES, ...landmarks];
  }, []);

  // Filtered sites according to category chips
  const filteredSites = useMemo(() => {
    if (categoryFilter === "all") return allSites;
    if (categoryFilter === "base") return allSites.filter((s) => s.kind === "base" || s.kind === "infrastructure");
    if (categoryFilter === "volcano") return allSites.filter((s) => s.kind === "volcano");
    if (categoryFilter === "crater") return allSites.filter((s) => s.kind === "crater");
    return allSites;
  }, [allSites, categoryFilter]);

  // Active site selection
  const activeSite = useMemo(() => {
    return allSites.find((s) => s.id === selectedSiteId) || allSites[0];
  }, [allSites, selectedSiteId]);

  // Route target coordinates: either custom waypoint or active site
  const routeTargetX = waypoint ? waypoint.x : activeSite.x;
  const routeTargetZ = waypoint ? waypoint.z : activeSite.z;

  // Compute terrain-adaptive route path, total distance, and elevation gain
  const routeData = useMemo(() => {
    const startX = rawRoverX;
    const startZ = rawRoverZ;
    const targetX = routeTargetX;
    const targetZ = routeTargetZ;
    const dist = Math.hypot(targetX - startX, targetZ - startZ);

    if (dist < 1) {
      return {
        points: [{ x: startX, z: startZ }, { x: targetX, z: targetZ }],
        distance: dist,
        elevationGain: 0,
      };
    }

    const steps = Math.min(28, Math.max(10, Math.round(dist / 120)));
    const points: Point2D[] = [];
    let prevElev = sampleMarsElevation(worldToMars(startX, startZ).longitude, worldToMars(startX, startZ).latitude);
    let totalGain = 0;
    let totalDist = 0;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let px = startX + (targetX - startX) * t;
      let pz = startZ + (targetZ - startZ) * t;

      // Gentle terrain-following lateral nudge along normal
      if (i > 0 && i < steps) {
        const normalX = -(targetZ - startZ) / dist;
        const normalZ = (targetX - startX) / dist;
        const sinWave = Math.sin(t * Math.PI);
        const elevLeft = sampleMarsElevation(
          worldToMars(px + normalX * 60, pz + normalZ * 60).longitude,
          worldToMars(px + normalX * 60, pz + normalZ * 60).latitude
        );
        const elevRight = sampleMarsElevation(
          worldToMars(px - normalX * 60, pz - normalZ * 60).longitude,
          worldToMars(px - normalX * 60, pz - normalZ * 60).latitude
        );
        const nudge = (elevLeft - elevRight) / 220;
        px += normalX * Math.max(-50, Math.min(50, nudge * sinWave * 35));
        pz += normalZ * Math.max(-50, Math.min(50, nudge * sinWave * 35));
      }

      const elev = sampleMarsElevation(worldToMars(px, pz).longitude, worldToMars(px, pz).latitude);
      if (i > 0) {
        const prev = points[i - 1];
        totalDist += Math.hypot(px - prev.x, pz - prev.z);
        if (elev > prevElev) totalGain += elev - prevElev;
      }
      prevElev = elev;
      points.push({ x: px, z: pz });
    }

    return { points, distance: totalDist, elevationGain: Math.round(totalGain) };
  }, [rawRoverX, rawRoverZ, routeTargetX, routeTargetZ]);

  const routeDistanceStr = routeData.distance >= 1000
    ? `${(routeData.distance / 1000).toFixed(1)} km`
    : `${Math.round(routeData.distance)} m`;
  const routeElevationGain = routeData.elevationGain;

  // Add entry to traverse log journal
  const addLog = useCallback((entry: string) => {
    setTraverseLogs((prev) => [entry, ...prev.slice(0, 59)]);
  }, []);

  // Display ephemeral notification toast
  const showToast = useCallback((text: string) => {
    setMessage(text);
    if (messageTimeoutRef.current) window.clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = window.setTimeout(() => setMessage(null), 2100);
  }, []);

  // World to screen projection
  const projectWorldToScreen = useCallback(
    (wx: number, wz: number, width: number, height: number): [number, number] => {
      const aspect = width / height;
      const viewSpan = Math.max(regionHeight, regionWidth / aspect) / zoom;
      const viewW = viewSpan * aspect;
      const viewCX = centerX + pan.x;
      const viewCZ = centerZ + pan.z;

      const sx = width / 2 + (wx - viewCX) * (width / viewW);
      let sy = height / 2 + (wz - viewCZ) * (height / viewSpan);

      if (perspective === "relief" && reliefRendererReady) {
        sy = height / 2 + ((wz - viewCZ) * Math.cos(RELIEF_TILT) - terrainHeightAt(wx, wz) * 5 * Math.sin(RELIEF_TILT)) * (height / viewSpan);
      }

      return [sx, sy];
    },
    [regionWidth, regionHeight, zoom, centerX, centerZ, pan, perspective, terrainHeightAt, reliefRendererReady]
  );

  // Screen to world projection
  const projectScreenToWorld = useCallback(
    (sx: number, sy: number, width: number, height: number): [number, number] => {
      const aspect = width / height;
      const viewSpan = Math.max(regionHeight, regionWidth / aspect) / zoom;
      const viewW = viewSpan * aspect;
      const viewCX = centerX + pan.x;
      const viewCZ = centerZ + pan.z;

      const wx = viewCX + (sx / width - 0.5) * viewW;

      if (perspective === "relief" && reliefRendererReady) {
        const normalizedHeight = (sy / height - 0.5) * viewSpan;
        let wz = viewCZ + normalizedHeight / Math.cos(RELIEF_TILT);
        for (let i = 0; i < 3; i++) {
          wz = viewCZ + (normalizedHeight + terrainHeightAt(wx, wz) * 5 * Math.sin(RELIEF_TILT)) / Math.cos(RELIEF_TILT);
        }
        return [wx, wz];
      }

      const wz = viewCZ + (sy / height - 0.5) * viewSpan;
      return [wx, wz];
    },
    [regionWidth, regionHeight, zoom, centerX, centerZ, pan, perspective, terrainHeightAt, reliefRendererReady]
  );

  // Selection handlers
  const handleSelectSite = useCallback(
    (siteId: string) => {
      if (siteId !== selectedSiteId) {
        if (routeState === "driving" || routeState === "paused") {
          addLog(`Traverse diverted from ${activeSite.name}.`);
        }
        setSelectedSiteId(siteId);
        setWaypoint(null);
        setRouteState("preview");
        setTraverseProgress(0);
        setSimulatedRover(null);
        setPulseRing(1);
        onSelect(siteId);
      }
    },
    [selectedSiteId, routeState, activeSite.name, addLog, onSelect]
  );

  const handleCenterOnPosition = useCallback(
    (targetX: number, targetZ: number) => {
      const targetPanX = targetX - centerX;
      const targetPanZ = targetZ - centerZ;
      const maxPanX = regionWidth * 0.45;
      const maxPanZ = regionHeight * 0.45;
      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, targetPanX)),
        z: Math.max(-maxPanZ, Math.min(maxPanZ, targetPanZ)),
      });
      showToast("Centered on target");
    },
    [centerX, centerZ, regionWidth, regionHeight, showToast]
  );

  // Pan & Multi-Touch Pinch-Zoom interaction
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      pinchDistanceRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = true;
    dragDistanceRef.current = 0;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panZ: pan.z,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDistanceRef.current !== null && pinchDistanceRef.current > 0) {
        const factor = dist / pinchDistanceRef.current;
        if (Math.abs(factor - 1) > 0.015) {
          handleZoom(factor);
          pinchDistanceRef.current = dist;
        }
      } else {
        pinchDistanceRef.current = dist;
      }
      return;
    }
    if (!isDraggingRef.current) return;
    const vp = mapViewportRef.current;
    if (!vp) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragDistanceRef.current = Math.hypot(dx, dy);

    const aspect = vp.clientWidth / vp.clientHeight;
    const viewSpan = Math.max(regionHeight, regionWidth / aspect) / zoom;
    const metersPerPixelX = viewSpan / vp.clientHeight;
    const metersPerPixelZ = viewSpan / (vp.clientHeight *
      (perspective === "relief" && reliefRendererReady ? Math.cos(RELIEF_TILT) : 1));

    const maxPanX = regionWidth * 0.45;
    const maxPanZ = regionHeight * 0.45;

    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.panX - dx * metersPerPixelX)),
      z: Math.max(-maxPanZ, Math.min(maxPanZ, dragStartRef.current.panZ - dy * metersPerPixelZ)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) pinchDistanceRef.current = null;
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    // If it was a clean click without dragging and not during a multi-touch gesture, place a custom waypoint
    if (dragDistanceRef.current < 6 && activePointersRef.current.size === 0) {
      const vp = mapViewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wz] = projectScreenToWorld(sx, sy, rect.width, rect.height);
      const m = worldToMars(wx, wz);
      setWaypoint({ x: wx, z: wz, label: `GPS: ${m.latitude.toFixed(2)}°N, ${m.longitude.toFixed(2)}°E` });
      setRouteState("preview");
      setTraverseProgress(0);
      setSimulatedRover(null);
      setPulseRing(1);
      showToast(`Waypoint set: ${m.latitude.toFixed(2)}°N, ${m.longitude.toFixed(2)}°E`);
    }
  };

  // Zoom handlers
  const handleZoom = useCallback((factor: number) => {
    setZoom((cur) => Math.max(0.6, Math.min(4.0, cur * factor)));
  }, []);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    handleZoom(factor);
  };

  // Traverse route state machine action button
  const handleActionClick = () => {
    if (routeState === "preview") {
      setRouteState("armed");
      setPulseRing(1);
      addLog(`Waypoint set · ${waypoint ? "Custom GPS Waypoint" : activeSite.name}`);
      onSelect(activeSite.id);
      showToast("Waypoint locked");
    } else if (routeState === "armed" || routeState === "paused") {
      const actionName = routeState === "paused" ? "Resumed" : "Departed for";
      addLog(`${actionName} · ${waypoint ? "Custom GPS Waypoint" : activeSite.name}`);
      setRouteState("driving");
      onSelect(activeSite.id);
    } else if (routeState === "driving") {
      setRouteState("paused");
      addLog("Rover paused on route.");
      showToast("Traverse paused");
    }
  };

  // Route status text and button labels
  const statusText = useMemo(() => {
    if (routeState === "preview") return "Preview route";
    if (routeState === "armed") return "Waypoint locked";
    if (routeState === "driving") return `Traversing · ${Math.round(traverseProgress * 100)}%`;
    if (routeState === "paused") return "Traverse paused";
    return "Survey site reached";
  }, [routeState, traverseProgress]);

  const actionLabel = useMemo(() => {
    if (routeState === "preview") return "Set waypoint";
    if (routeState === "armed") return "Begin traverse";
    if (routeState === "driving") return "Pause traverse";
    if (routeState === "paused") return "Resume traverse";
    return "Site reached";
  }, [routeState]);

  const actionIcon = useMemo(() => {
    if (routeState === "driving") return "⏸";
    if (routeState === "arrived") return "✓";
    return "↗";
  }, [routeState]);

  // Continuous animation loop for animated dash offset, pulse ring, and rover traversal
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      setAnimTime((t) => t + dt);

      // Decaying pulse ring
      setPulseRing((cur) => Math.max(0, cur - dt * 1.2));

      // Driving simulation
      if (routeState === "driving") {
        setTraverseProgress((cur) => {
          const totalMeters = routeData.distance || 1000;
          const speedMps = Math.max(25, totalMeters / 15);
          const nextProgress = Math.min(1, cur + (dt * speedMps) / totalMeters);

          // Interpolate simulated rover coordinates along routePoints
          const pts = routeData.points;
          if (pts.length >= 2) {
            const indexFloat = nextProgress * (pts.length - 1);
            const idx = Math.floor(indexFloat);
            const frac = indexFloat - idx;
            const p1 = pts[idx];
            const p2 = pts[Math.min(pts.length - 1, idx + 1)];
            setSimulatedRover({
              x: p1.x + (p2.x - p1.x) * frac,
              z: p1.z + (p2.z - p1.z) * frac,
            });
          }

          if (nextProgress >= 1) {
            setRouteState("arrived");
            addLog(`Arrived · ${waypoint ? "Custom GPS Waypoint" : activeSite.name}`);
            showToast("Survey site reached");
          }
          return nextProgress;
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [routeState, routeData, activeSite.name, waypoint, addLog, showToast]);

  // Keep the large raster copy out of the per-frame route and waypoint drawing loop.
  useEffect(() => {
    const baseCanvas = baseMapCanvasRef.current;
    const vp = mapViewportRef.current;
    if (!baseCanvas || !vp) return;
    const width = vp.clientWidth;
    const height = vp.clientHeight;
    if (!width || !height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    baseCanvas.width = Math.round(width * dpr);
    baseCanvas.height = Math.round(height * dpr);
    const ctx = baseCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#563b2d";
    ctx.fillRect(0, 0, width, height);
    if (perspective === "plan" || !reliefRendererReady) {
      const image = baseMapImageRef.current;
      if (image) {
        const [left, top] = projectWorldToScreen(B.west, B.north, width, height);
        const [right, bottom] = projectWorldToScreen(B.east, B.south, width, height);
        ctx.drawImage(image, left, top, right - left, bottom - top);
      }
    }
  }, [viewportSize, terrainReady, reliefRendererReady, perspective, zoom, pan, projectWorldToScreen]);

  // Render the game overlays above either map mode.
  useEffect(() => {
    const canvas = terrainCanvasRef.current;
    const vp = mapViewportRef.current;
    if (!canvas || !vp) return;

    const width = vp.clientWidth;
    const height = vp.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Coordinate Grid Crosses
    ctx.strokeStyle = "rgba(244, 223, 178, 0.16)";
    ctx.lineWidth = 1;
    for (let gx = B.west; gx <= B.east; gx += regionWidth / 8) {
      for (let gz = B.north; gz <= B.south; gz += regionHeight / 8) {
        const [sx, sy] = projectWorldToScreen(gx, gz, width, height);
        if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
          ctx.beginPath();
          ctx.moveTo(sx - 3, sy);
          ctx.lineTo(sx + 3, sy);
          ctx.moveTo(sx, sy - 3);
          ctx.lineTo(sx, sy + 3);
          ctx.stroke();
        }
      }
    }

    // Playable Boundary Fence
    const playableCorners = [
      [PLAYABLE_BOUNDS.west, PLAYABLE_BOUNDS.north],
      [PLAYABLE_BOUNDS.east, PLAYABLE_BOUNDS.north],
      [PLAYABLE_BOUNDS.east, PLAYABLE_BOUNDS.south],
      [PLAYABLE_BOUNDS.west, PLAYABLE_BOUNDS.south],
    ].map(([wx, wz]) => projectWorldToScreen(wx, wz, width, height));
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    playableCorners.forEach(([sx, sy], i) => (i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Elevation Contour Lines
    if (showContours) {
      ctx.strokeStyle = "rgba(214, 232, 191, 0.38)";
      ctx.lineWidth = 0.8;
      const contourRes = 38;
      const cStepX = width / contourRes;
      const cStepY = height / contourRes;
      const contourInterval = zoom > 2.0 ? 500 : 1000;

      for (let cy = 0; cy < contourRes; cy++) {
        for (let cx = 0; cx < contourRes; cx++) {
          const sx = cx * cStepX;
          const sy = cy * cStepY;
          const [wx, wz] = projectScreenToWorld(sx, sy, width, height);
          const elev = sampleMarsElevation(worldToMars(wx, wz).longitude, worldToMars(wx, wz).latitude);

          if (Math.abs(elev % contourInterval) < 95) {
            ctx.beginPath();
            ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(214, 232, 191, 0.35)";
            ctx.fill();
          }
        }
      }
    }

    // 6. Plotted Traverse Route Line with Animated Marching Dash
    const routeScreenPts = routeData.points.map((pt) => projectWorldToScreen(pt.x, pt.z, width, height));

    if (routeScreenPts.length >= 2) {
      // Wide dark shadow under the route
      ctx.beginPath();
      routeScreenPts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1])));
      ctx.strokeStyle = "#382411c0";
      ctx.lineWidth = 4.1;
      ctx.stroke();

      // Dashed animated route on top
      ctx.beginPath();
      routeScreenPts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1])));
      ctx.strokeStyle = routeState === "arrived" ? "#cbe6c8" : "#ffcd79";
      ctx.lineWidth = 2.0;
      ctx.setLineDash(routeState === "preview" ? [2, 6] : [6, 4]);
      ctx.lineDashOffset = -animTime * 24;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Fictional Story Route (if provided in story mode)
    if (storyRoute && storyRoute.length >= 2) {
      const storyScreenPts = storyRoute.map((pt) => projectWorldToScreen(pt.x, pt.z, width, height));
      ctx.beginPath();
      storyScreenPts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1])));
      ctx.strokeStyle = "#ffcf77";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 7. Expanding Waypoint Pulse Animation
    if (pulseRing > 0 && routeScreenPts.length > 0) {
      const targetPt = routeScreenPts[routeScreenPts.length - 1];
      const radius = 5 + (1 - pulseRing) * 72;
      ctx.beginPath();
      ctx.arc(targetPt[0], targetPt[1], radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 204, 131, ${(pulseRing * 0.8).toFixed(2)})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.restore();
  }, [
    zoom,
    pan,
    perspective,
    terrainReady,
    reliefRendererReady,
    showContours,
    routeData,
    routeState,
    animTime,
    pulseRing,
    projectWorldToScreen,
    projectScreenToWorld,
    storyRoute,
    regionHeight,
    regionWidth,
  ]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (guideOpen) {
        if (e.key === "Escape") setGuideOpen(false);
        return;
      }

      if (e.key.toLowerCase() === "m" || e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key.toLowerCase() === "r" || e.key === " ") {
        e.preventDefault();
        handleCenterOnPosition(roverX, roverZ);
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setShowContours((prev) => !prev);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoom(1.2);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoom(1 / 1.2);
      } else if (e.key.toLowerCase() === "h" || e.key === "?") {
        e.preventDefault();
        setGuideOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [guideOpen, onClose, roverX, roverZ, handleCenterOnPosition, handleZoom]);

  const [roverScreenX, roverScreenY] = projectWorldToScreen(roverX, roverZ, viewportSize.width, viewportSize.height);

  return (
    <div className="atlas-expedition-wrap">
      {/* 1. Header Masthead */}
      <header className="mast">
        <div className="brand">
          <svg viewBox="0 0 48 32" fill="none" aria-hidden="true">
            <path d="M2 26Q24 4 46 26M9 26Q24 15 39 26" stroke="#c9d9d2" strokeWidth="1.4" />
            <path d="M24 0l2 15-2 15-2-15z" fill="#94e1d7" />
          </svg>
          TARUKH
        </div>
        <span className="program mono meta">Surface operations</span>
        <span className="live meta">
          <i className="dot" /> Rover online
        </span>
        <button
          type="button"
          className="helpBtn"
          id="help"
          title="Map controls (?)"
          aria-label="Map controls"
          onClick={() => setGuideOpen(true)}
        >
          ?
        </button>
        <button
          type="button"
          className="closeBtn"
          id="close"
          title="Return to Mars (M / Esc)"
          aria-label="Close Atlas"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      {/* 2. Main Titlebar & Sector */}
      <main className="wrap">
        <div className="titlebar">
          <div>
            <div className="kicker">Mars / Navigation</div>
            <h1>Expedition atlas</h1>
          </div>
          <div className="sector meta">
            <b>SOL 018</b>
            <br />
            Survey simulation · Elysium Planitia
          </div>
        </div>

        {/* 3. Main Grid Layout */}
        <div className="grid">
          {/* Left Column: Interactive Map Viewport */}
          <section
            id="map"
            ref={mapViewportRef}
            tabIndex={0}
            aria-label="Interactive Mars terrain map"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* Terrain Canvas */}
            <div id="terrain">
              <canvas
                ref={baseMapCanvasRef}
                className="atlas-base-map"
                style={{ display: perspective === "plan" || !reliefRendererReady ? "block" : "none" }}
                aria-hidden="true"
              />
              <canvas
                ref={reliefCanvasRef}
                className="atlas-relief-map"
                style={{ display: perspective === "relief" && reliefRendererReady ? "block" : "none" }}
                aria-hidden="true"
              />
              <canvas ref={terrainCanvasRef} className="atlas-map-overlay" aria-hidden="true" />
            </div>

            {/* Vignette Shadow Overlay */}
            <div className="vignette" />

            {/* Map Header Overlay */}
            <div className="maphead">
            <small>User map base · NASA MOLA relief</small>
              <strong>Elysium Planitia</strong>
            </div>

            {/* Perspective Switcher */}
            <div className="maptools" aria-label="Map perspective">
              <button
                type="button"
                id="plan"
                className={perspective === "plan" ? "on" : ""}
                onClick={() => setPerspective("plan")}
              >
                Plan
              </button>
              <button
                type="button"
                id="relief"
                className={perspective === "relief" ? "on" : ""}
                onClick={() => setPerspective("relief")}
              >
                3D relief
              </button>
            </div>

            {/* Interactive Pins Overlay */}
            <div id="pins">
              {/* Landmark & Base Pins */}
              {allSites.map((site) => {
                const { width, height } = viewportSize;
                const [sx, sy] = projectWorldToScreen(site.x, site.z, width, height);

                const isVisible = sx >= -20 && sx <= width + 20 && sy >= -20 && sy <= height + 20;
                if (!isVisible) return null;

                const isChosen = site.id === activeSite.id && !waypoint;

                return (
                  <button
                    key={site.id}
                    type="button"
                    className={`pin pin-site pin-${site.kind.replace(/\s+/g, "-")} ${isChosen ? "chosen" : ""}`}
                    style={{ left: `${sx}px`, top: `${sy}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSite(site.id);
                    }}
                    aria-label={`Select ${site.name}`}
                    title={`${site.name} (${site.typeLabel})`}
                  >
                    <i className="atlas-site-logo"><AtlasSiteLogo site={site} /></i>
                    <span>{site.name}</span>
                  </button>
                );
              })}

              {/* Custom Waypoint Pin (if placed) */}
              {waypoint && (() => {
                const { width, height } = viewportSize;
                const [sx, sy] = projectWorldToScreen(waypoint.x, waypoint.z, width, height);
                return (
                  <button
                    type="button"
                    className="pin chosen waypoint-pin"
                    style={{ left: `${sx}px`, top: `${sy}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWaypoint(null);
                    }}
                    title="Custom GPS Waypoint (Click to clear)"
                    aria-label="Custom GPS Waypoint"
                  >
                    <i>📍</i>
                    <span>WAYPOINT</span>
                  </button>
                );
              })()}

              {/* Story Objective Pin (if in story mode) */}
              {storyTarget && (() => {
                const { width, height } = viewportSize;
                const [sx, sy] = projectWorldToScreen(storyTarget.x, storyTarget.z, width, height);
                const isVisible = sx >= -20 && sx <= width + 20 && sy >= -20 && sy <= height + 20;
                if (!isVisible) return null;
                return (
                  <div
                    className="pin chosen"
                    style={{ left: `${sx}px`, top: `${sy}px` }}
                    title={`Story objective: ${storyTarget.label}`}
                    aria-label={`Story objective: ${storyTarget.label}`}
                  >
                    <i>!</i>
                    <span>{storyTarget.label}</span>
                  </div>
                );
              })()}

              {/* Rover / Player Marker Pin */}
              <div
                className="roverPin"
                style={{
                  left: `${roverScreenX}px`,
                  top: `${roverScreenY}px`,
                  transform: `translate(-50%, -50%) rotate(${Math.round((roverYaw * 180) / Math.PI)}deg)`,
                }}
                title={`${isDriving ? "MMSEV Crew Rover" : "Astronaut EVA"} at (${Math.round(roverX)}, ${Math.round(roverZ)})`}
              >
                ▲
                <span style={{ transform: `translateX(-50%) rotate(${-Math.round((roverYaw * 180) / Math.PI)}deg)` }}>
                  {isDriving ? "ROVER 01" : "EVA-01"}
                </span>
              </div>
            </div>

            {/* Floating Map Tools (Bottom-Right: Zoom, Center, Contours) */}
            <div className="tools">
              <button
                type="button"
                id="zin"
                title="Zoom in (+)"
                aria-label="Zoom in"
                onClick={() => handleZoom(1.25)}
              >
                +
              </button>
              <button
                type="button"
                id="zout"
                title="Zoom out (−)"
                aria-label="Zoom out"
                onClick={() => handleZoom(0.8)}
              >
                −
              </button>
              <button
                type="button"
                id="center"
                title="Center on rover (R)"
                aria-label="Center on rover"
                onClick={() => handleCenterOnPosition(roverX, roverZ)}
              >
                ◎
              </button>
              <button
                type="button"
                id="contour"
                className={showContours ? "on" : ""}
                title="Contour lines (C)"
                aria-label="Toggle contour lines"
                aria-pressed={showContours}
                onClick={() => {
                  setShowContours((cur) => !cur);
                  showToast(!showContours ? "Contours · 500m interval" : "Contours off");
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="m2 15 10-8 10 8-10 6z M2 10l10-8 10 8" />
                </svg>
              </button>
            </div>

            {/* Map Footer (Scale Bar & North Indicator) */}
            <div className="mapfoot">
              <div>
                <span id="scaleN">{zoom > 2.0 ? "500 m" : "1 km"}</span>
                <i
                  className="scale"
                  id="scale"
                  style={{ width: `${Math.round(Math.min(120, Math.max(45, 65 * zoom)))}px` }}
                />
              </div>
              <span className="legend" id="north">
                ↑ N
              </span>
            </div>

            {/* Ephemeral Toast Message */}
            {message && (
              <div className="message" id="msg">
                {message}
              </div>
            )}
          </section>

          {/* Right Column: Expedition Side Panel */}
          <aside className="panel">
            {/* Panel Tabs: Survey Sites vs Traverse Log */}
            <div className="tabs">
              <button
                type="button"
                id="sitesTab"
                className={activeTab === "sites" ? "on" : ""}
                onClick={() => setActiveTab("sites")}
              >
                Landmarks
              </button>
              <button
                type="button"
                id="logTab"
                className={activeTab === "log" ? "on" : ""}
                onClick={() => setActiveTab("log")}
              >
                Traverse log
              </button>
            </div>

            <div className="panelbody">
              {/* Tab 1: Landmarks Directory & Detail */}
              {activeTab === "sites" && (
                <div id="sites">
                  {/* Category Filter Pills */}
                  <div className="category-chips">
                    <button
                      type="button"
                      className={`chip ${categoryFilter === "all" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`chip ${categoryFilter === "base" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("base")}
                    >
                      Bases
                    </button>
                    <button
                      type="button"
                      className={`chip ${categoryFilter === "volcano" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("volcano")}
                    >
                      Volcanoes
                    </button>
                    <button
                      type="button"
                      className={`chip ${categoryFilter === "crater" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("crater")}
                    >
                      Craters
                    </button>
                  </div>

                  {/* Landmark and expedition site list */}
                  <div className="list" id="list">
                    {filteredSites.map((site) => {
                      const isChosen = site.id === activeSite.id && !waypoint;
                      const distMeters = Math.round(Math.hypot(site.x - roverX, site.z - roverZ));
                      const distLabel = distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1)} km` : `${distMeters} m`;

                      return (
                        <button
                          key={site.id}
                          type="button"
                          className={`site ${isChosen ? "on" : ""}`}
                          onClick={() => {
                            handleSelectSite(site.id);
                            handleCenterOnPosition(site.x, site.z);
                          }}
                          aria-pressed={isChosen}
                        >
                          <span className="g"><AtlasSiteLogo site={site} /></span>
                          <span className="site-title">{site.name}</span>
                          <span className="dist-chip">{distLabel}</span>
                          <span className="type">{site.typeLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Site Detail Profile */}
                  <section className="detail">
                    <div className="topline">
                      <span className="kicker">Landmark details</span>
                      <span id="type" className="typechip">
                        {activeSite.typeLabel}
                      </span>
                    </div>

                    <h2 id="name">{waypoint ? "Custom GPS Waypoint" : activeSite.name}</h2>
                    <p id="desc">{waypoint ? waypoint.label : activeSite.description}</p>

                    {/* Route Readings */}
                    <div className="readings">
                      <div>
                        <small>Route length</small>
                        <strong id="distance">{routeDistanceStr}</strong>
                      </div>
                      <div>
                        <small>Elevation gain</small>
                        <strong id="gain">+{routeElevationGain} m</strong>
                      </div>
                    </div>

                    {/* Mars Planetary Coordinates */}
                    <div className="meta-readings">
                      {activeSite.latitude !== undefined && activeSite.longitude !== undefined ? (
                        <span>
                          Coordinates: <b>{activeSite.latitude.toFixed(2)}° N, {activeSite.longitude.toFixed(2)}° E</b>
                        </span>
                      ) : (
                        <span>
                          Expedition Grid: <b>({Math.round(activeSite.x)}, {Math.round(activeSite.z)}) m</b>
                        </span>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {/* Tab 2: Traverse Log Journal */}
              {activeTab === "log" && (
                <section id="journal" className="brief">
                  <div className="kicker">Sol 018 / Navigation</div>
                  <h2>Traverse log</h2>
                  <ol id="entries">
                    {traverseLogs.map((entry, idx) => (
                      <li key={idx}>{entry}</li>
                    ))}
                  </ol>
                </section>
              )}
            </div>

            {/* Bottom Command Action Bar */}
            <div className="command">
              <div className="routeState" id="status" aria-live="polite">
                {statusText}
              </div>
              <button
                type="button"
                id="action"
                disabled={routeState === "arrived"}
                onClick={handleActionClick}
              >
                <span>{actionLabel}</span>
                <b>{actionIcon}</b>
              </button>
            </div>
          </aside>
        </div>

        {/* 4. Bottom Legend Strip */}
        <footer className="bottom">
          <span className="keys">
            <kbd>Drag</kbd> pan &nbsp; <kbd>Scroll</kbd> zoom &nbsp; <kbd>R</kbd> rover &nbsp; <kbd>C</kbd> contours &nbsp; <kbd>M / ESC</kbd> return to Mars
          </span>
          <span className="demo">
            TARUKH MOLA terrain · 1:4,940 ·{" "}
            <a
              href={MARS_TREK_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--ice)", textDecoration: "none" }}
            >
              NASA Mars Trek ↗
            </a>
          </span>
        </footer>
      </main>

      {/* 5. Help Guide Dialog */}
      {guideOpen && (
        <div className="guide-backdrop" onClick={() => setGuideOpen(false)}>
          <dialog
            id="guide"
            open
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="guide-title"
          >
            <h2 id="guide-title">Map controls</h2>
            <p>
              Select a site on the terrain or in the list. Set its waypoint, then begin the traverse to guide the rover along the plotted route.
            </p>
            <p>
              • <b>Drag</b> or use the arrow keys to pan across Elysium Planitia.<br />
              • Use <b>+</b> and <b>−</b> or scroll to zoom.<br />
              • <b>R</b> centers on the crew rover.<br />
              • <b>C</b> toggles 500 m MOLA elevation contours.<br />
              • Choose <b>3D relief</b> to tilt the terrain into an isometric relief perspective.<br />
              • Click anywhere on the map to place a custom GPS beacon.
            </p>
            <button type="button" id="dismiss" onClick={() => setGuideOpen(false)}>
              Close
            </button>
          </dialog>
        </div>
      )}
    </div>
  );
}
