"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MARS_LANDMARKS, MARS_TREK_URL } from "../content/marsLandmarks";
import {
  REGION_WORLD_BOUNDS as B,
  worldToMars,
  sampleMarsElevation,
} from "../game/marsRegion";
import { PLAYABLE_BOUNDS } from "../game/explorationBounds";
import { OUTPOST_SITE } from "../game/outpostSite";
import { GARAGE_SITE } from "../game/garageSite";
import { GREENHOUSE_SITES } from "../game/greenhouseSites";
import type { View } from "./MarsWorld";

export interface AtlasSite {
  id: string;
  name: string;
  kind: "volcano" | "crater" | "valley" | "plain" | "landing site" | "base" | "infrastructure" | "waypoint";
  typeLabel: string;
  glyph: string;
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
    glyph: "🚀",
    x: 0,
    z: 12,
    description: "Primary landing craft and pressurized environmental shelter. Full 100% radiation shielding.",
  },
  {
    id: "outpost",
    name: "Habitat Campus Outpost",
    kind: "base",
    typeLabel: "Base",
    glyph: "🏛️",
    x: OUTPOST_SITE.x,
    z: OUTPOST_SITE.z,
    description: "Main surface habitat modules, airlocks, and life support control systems.",
  },
  {
    id: "garage",
    name: "Rover Garage & Charger",
    kind: "infrastructure",
    typeLabel: "Infrastructure",
    glyph: "🚙",
    x: GARAGE_SITE.x,
    z: GARAGE_SITE.z,
    description: "MMSEV maintenance bay, 1,200W solar inverter array, and automated battery dock.",
  },
  {
    id: "greenhouses",
    name: "Hydroponic Greenhouse Farm",
    kind: "infrastructure",
    typeLabel: "Infrastructure",
    glyph: "🌿",
    x: GREENHOUSE_SITES[0].x,
    z: GREENHOUSE_SITES[0].z,
    description: "Six circular pressurized crop domes producing oxygen and expedition food rations.",
  },
];

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
}: {
  x: number;
  z: number;
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  view?: View;
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
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const wireCanvasRef = useRef<HTMLCanvasElement>(null);
  const messageTimeoutRef = useRef<number | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panZ: 0 });
  const dragDistanceRef = useRef(0);

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

  // Region dimensions
  const regionWidth = B.east - B.west;
  const regionHeight = B.south - B.north;
  const centerX = (B.west + B.east) / 2;
  const centerZ = (B.north + B.south) / 2;

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
      glyph: lm.kind === "volcano" ? "⌁" : lm.kind === "crater" ? "◇" : lm.kind === "valley" ? "◉" : lm.kind === "landing site" ? "◆" : "◉",
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
      const viewW = regionWidth / zoom;
      const viewH = regionHeight / zoom;
      const viewCX = centerX + pan.x;
      const viewCZ = centerZ + pan.z;

      const normX = (wx - (viewCX - viewW / 2)) / viewW;
      const normZ = (wz - (viewCZ - viewH / 2)) / viewH;

      const sx = normX * width;
      let sy = normZ * height;

      if (perspective === "relief") {
        const elev = sampleMarsElevation(worldToMars(wx, wz).longitude, worldToMars(wx, wz).latitude);
        const elevOffset = (elev / 15000) * (height * 0.14) * zoom;
        const tiltFactor = 0.38;
        const centerYScreen = height / 2;
        sy = centerYScreen + (sy - centerYScreen) * Math.cos(tiltFactor) - elevOffset;
      }

      return [sx, sy];
    },
    [regionWidth, regionHeight, zoom, centerX, centerZ, pan, perspective]
  );

  // Screen to world projection
  const projectScreenToWorld = useCallback(
    (sx: number, sy: number, width: number, height: number): [number, number] => {
      const viewW = regionWidth / zoom;
      const viewH = regionHeight / zoom;
      const viewCX = centerX + pan.x;
      const viewCZ = centerZ + pan.z;

      const normX = sx / width;
      let normZ = sy / height;

      if (perspective === "relief") {
        const tiltFactor = 0.38;
        const centerYScreen = height / 2;
        const unTiltedY = centerYScreen + (sy - centerYScreen) / Math.cos(tiltFactor);
        normZ = unTiltedY / height;
      }

      const wx = viewCX - viewW / 2 + normX * viewW;
      const wz = viewCZ - viewH / 2 + normZ * viewH;
      return [wx, wz];
    },
    [regionWidth, regionHeight, zoom, centerX, centerZ, pan, perspective]
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

  // Pan interaction
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
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
    if (!isDraggingRef.current) return;
    const vp = mapViewportRef.current;
    if (!vp) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragDistanceRef.current = Math.hypot(dx, dy);

    const metersPerPixelX = regionWidth / (vp.clientWidth * zoom);
    const metersPerPixelZ = regionHeight / (vp.clientHeight * zoom);

    const maxPanX = regionWidth * 0.45;
    const maxPanZ = regionHeight * 0.45;

    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.panX - dx * metersPerPixelX)),
      z: Math.max(-maxPanZ, Math.min(maxPanZ, dragStartRef.current.panZ - dy * metersPerPixelZ)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    // If it was a clean click without dragging, place a custom waypoint
    if (dragDistanceRef.current < 6) {
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

  // Render Map Canvas (MOLA Elevation, Shaded Relief, Contours, Route line)
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

    // 1. Draw base Mars terrain fill
    ctx.fillStyle = "#563b2d";
    ctx.fillRect(0, 0, width, height);

    // 2. Render Elevation Heatmap & Shaded Relief
    const gridRes = 56;
    const stepX = width / gridRes;
    const stepY = height / gridRes;

    for (let gy = 0; gy < gridRes; gy++) {
      for (let gx = 0; gx < gridRes; gx++) {
        const sx = gx * stepX;
        const sy = gy * stepY;
        const [wx, wz] = projectScreenToWorld(sx + stepX / 2, sy + stepY / 2, width, height);
        const m = worldToMars(wx, wz);
        const elev = sampleMarsElevation(m.longitude, m.latitude);

        // Directional relief shading
        const [wxR, wzR] = projectScreenToWorld(sx + stepX * 1.5, sy + stepY / 2, width, height);
        const [wxD, wzD] = projectScreenToWorld(sx + stepX / 2, sy + stepY * 1.5, width, height);
        const elevR = sampleMarsElevation(worldToMars(wxR, wzR).longitude, worldToMars(wxR, wzR).latitude);
        const elevD = sampleMarsElevation(worldToMars(wxD, wzD).longitude, worldToMars(wxD, wzD).latitude);
        const slopeX = (elevR - elev) / 100;
        const slopeZ = (elevD - elev) / 100;

        // Light direction: (-0.42, 0.82, 0.36)
        const light = Math.max(0.7, Math.min(1.25, 0.7 + 0.5 * (slopeX * -0.42 + 0.82 + slopeZ * 0.36)));

        // Normalized elevation: -4000m to 14000m
        const normElev = Math.max(0, Math.min(1, (elev + 4000) / 18000));

        // Color ramp: deep rust -> ochre -> dusty terracotta -> pale summit
        const r = Math.round(Math.min(255, (75 + normElev * 140) * light));
        const g = Math.round(Math.min(255, (45 + normElev * 110) * light));
        const b = Math.round(Math.min(255, (35 + normElev * 85) * light));
        const alpha = 0.44 + normElev * 0.36;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        ctx.fillRect(sx, sy, stepX + 0.6, stepY + 0.6);
      }
    }

    // 3. Coordinate Grid Crosses
    ctx.strokeStyle = "rgba(244, 223, 178, 0.16)";
    ctx.lineWidth = 1;
    for (let gx = -4000; gx <= 4000; gx += 1000) {
      for (let gz = -4000; gz <= 4000; gz += 1000) {
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

    // 4. Playable Boundary Fence
    const [pWest, pNorth] = projectWorldToScreen(PLAYABLE_BOUNDS.west, PLAYABLE_BOUNDS.north, width, height);
    const [pEast, pSouth] = projectWorldToScreen(PLAYABLE_BOUNDS.east, PLAYABLE_BOUNDS.south, width, height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(pWest, pNorth, pEast - pWest, pSouth - pNorth);
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
    showContours,
    routeData,
    routeState,
    animTime,
    pulseRing,
    projectWorldToScreen,
    projectScreenToWorld,
  ]);

  // Render 3D Terrain Wireframe Mesh Canvas (`wire` canvas)
  useEffect(() => {
    const canvas = wireCanvasRef.current;
    if (!canvas) return;

    const w = canvas.clientWidth || 290;
    const h = canvas.clientHeight || 80;
    canvas.width = Math.round(w * 2);
    canvas.height = Math.round(h * 2);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const site = activeSite;
    const r = 800; // 800m sample radius
    const cols = 35;
    const rows = 23;
    const mesh: [number, number][][] = [];

    for (let l = 0; l < rows; l++) {
      mesh[l] = [];
      for (let g = 0; g < cols; g++) {
        const u = (g / (cols - 1) - 0.5) * 2;
        const v = (l / (rows - 1) - 0.5) * 2;
        const wx = site.x + u * r;
        const wz = site.z + v * r;
        const elev = sampleMarsElevation(worldToMars(wx, wz).longitude, worldToMars(wx, wz).latitude);

        // Isometric projection math from reference
        mesh[l].push([
          w * (0.51 + 0.32 * u + 0.13 * v),
          h * (0.52 + 0.12 * u - 0.22 * v) - (elev / 5000) * h * 1.14,
        ]);
      }
    }

    // Normalize mesh height to cleanly fit inside canvas
    const allY = mesh.flat().map((p) => p[1]);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const diffY = maxY - minY || 1;

    for (const row of mesh) {
      for (const pt of row) {
        pt[1] = 9 + ((h - 18) * (pt[1] - minY)) / diffY;
      }
    }

    // Draw rows with `#afc6b497`
    ctx.lineWidth = 0.75;
    for (const row of mesh) {
      ctx.strokeStyle = "#afc6b497";
      ctx.beginPath();
      row.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1])));
      ctx.stroke();
    }

    // Draw columns with `#89b4aa64`
    for (let col = 0; col < cols; col++) {
      ctx.strokeStyle = "#89b4aa64";
      ctx.beginPath();
      mesh.forEach((row, idx) => (idx === 0 ? ctx.moveTo(row[col][0], row[col][1]) : ctx.lineTo(row[col][0], row[col][1])));
      ctx.stroke();
    }

    ctx.restore();
  }, [activeSite]);

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
              <canvas ref={terrainCanvasRef} />
            </div>

            {/* Vignette Shadow Overlay */}
            <div className="vignette" />

            {/* Map Header Overlay */}
            <div className="maphead">
              <small>Regional elevation map · NASA MOLA</small>
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
                    className={`pin ${isChosen ? "chosen" : ""}`}
                    style={{ left: `${sx}px`, top: `${sy}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSite(site.id);
                    }}
                    aria-label={`Select ${site.name}`}
                    title={`${site.name} (${site.typeLabel})`}
                  >
                    <i />
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
                Survey sites
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
              {/* Tab 1: Survey Sites Directory & Profile */}
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

                  {/* List of Sites */}
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
                          <span className="g">{site.glyph}</span>
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
                      <span className="kicker">Site profile</span>
                      <span id="type" className="typechip">
                        {activeSite.typeLabel}
                      </span>
                    </div>

                    <h2 id="name">{waypoint ? "Custom GPS Waypoint" : activeSite.name}</h2>
                    <p id="desc">{waypoint ? waypoint.label : activeSite.description}</p>

                    {/* Real 3D Terrain Wireframe Mesh Canvas */}
                    <canvas
                      className="wire"
                      id="wire"
                      ref={wireCanvasRef}
                      aria-label="Local terrain elevation mesh"
                    />

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
