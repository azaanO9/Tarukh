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
    typeLabel: "Shelter Base",
    glyph: "🚀",
    x: 0,
    z: 12,
    description: "Primary landing craft and pressurized environmental shelter. Full 100% radiation shielding.",
  },
  {
    id: "outpost",
    name: "Habitat Campus Outpost",
    kind: "base",
    typeLabel: "Habitat Base",
    glyph: "🏛️",
    x: OUTPOST_SITE.x,
    z: OUTPOST_SITE.z,
    description: "Main surface habitat modules, automated airlocks, and life support atmospheric scrubbers.",
  },
  {
    id: "garage",
    name: "Rover Garage & Charger",
    kind: "infrastructure",
    typeLabel: "Maintenance Bay",
    glyph: "⚡",
    x: GARAGE_SITE.x,
    z: GARAGE_SITE.z,
    description: "MMSEV maintenance bay, 1,200W solar inverter array, and automated battery dock.",
  },
  {
    id: "greenhouses",
    name: "Hydroponic Greenhouse Farm",
    kind: "infrastructure",
    typeLabel: "Life Support",
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
  const [traverseLogs, setTraverseLogs] = useState<string[]>([
    "Rover online at landing site.",
    "MOLA elevation survey loaded · Elysium Quadrangle.",
    "Telemetry link active with orbital constellation.",
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
  const roverX = view?.roverX ?? x;
  const roverZ = view?.roverZ ?? z;
  const isDriving = Boolean(view?.roverDriving);
  const roverYaw = view?.yaw ?? 0;

  // Real world coordinates of the explorer
  const playerCoords = worldToMars(x, z);
  const playerElevation = Math.round(sampleMarsElevation(playerCoords.longitude, playerCoords.latitude));

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
            ? "Impact Crater"
            : lm.kind === "valley"
              ? "Valley"
              : lm.kind === "landing site"
                ? "Landing Site"
                : "Planitia",
      glyph: lm.kind === "volcano" ? "◇" : lm.kind === "crater" ? "◉" : lm.kind === "valley" ? "⌁" : lm.kind === "landing site" ? "🚀" : "▱",
      x: lm.x,
      z: lm.z,
      latitude: lm.latitude,
      longitude: lm.longitude,
      description: lm.description,
      source: lm.source,
      sourceLabel: lm.sourceLabel,
    }));
    return [...landmarks, ...EXPEDITION_BASES];
  }, []);

  // Filtered sites
  const filteredSites = useMemo(() => {
    if (categoryFilter === "all") return allSites;
    if (categoryFilter === "volcano") return allSites.filter((s) => s.kind === "volcano");
    if (categoryFilter === "base") return allSites.filter((s) => s.kind === "base" || s.kind === "infrastructure");
    if (categoryFilter === "crater") return allSites.filter((s) => s.kind === "crater" || s.kind === "valley" || s.kind === "plain");
    return allSites;
  }, [allSites, categoryFilter]);

  // Currently selected site
  const activeSite = useMemo(() => {
    return allSites.find((s) => s.id === selectedSiteId) ?? allSites[0];
  }, [allSites, selectedSiteId]);

  // Route calculation
  const routeTargetX = waypoint ? waypoint.x : activeSite.x;
  const routeTargetZ = waypoint ? waypoint.z : activeSite.z;
  const routeDistanceMeters = Math.round(Math.hypot(routeTargetX - roverX, routeTargetZ - roverZ));
  const routeDistanceStr = routeDistanceMeters >= 1000 ? `${(routeDistanceMeters / 1000).toFixed(2)} km` : `${routeDistanceMeters} m`;
  const routeElevationGain = Math.max(0, Math.round(sampleMarsElevation(worldToMars(routeTargetX, routeTargetZ).longitude, worldToMars(routeTargetX, routeTargetZ).latitude) - playerElevation));

  // Show a brief message toast
  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    if (messageTimeoutRef.current) window.clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = window.setTimeout(() => setMessage(null), 2200);
  }, []);

  // Select a site
  const handleSelectSite = useCallback(
    (siteId: string) => {
      setSelectedSiteId(siteId);
      onSelect(siteId);
      const target = allSites.find((s) => s.id === siteId);
      if (target) {
        showToast(`Selected · ${target.name}`);
      }
    },
    [allSites, onSelect, showToast]
  );

  // Set waypoint action
  const handleSetWaypointAction = useCallback(() => {
    if (waypoint) {
      setTraverseLogs((prev) => [`Waypoint locked · GPS (${Math.round(waypoint.x)}, ${Math.round(waypoint.z)})`, ...prev.slice(0, 50)]);
      showToast("Custom waypoint locked in rover nav");
    } else {
      setTraverseLogs((prev) => [`Route plotted to ${activeSite.name} · ${routeDistanceStr}`, ...prev.slice(0, 50)]);
      showToast(`Waypoint set · ${activeSite.name}`);
      onSelect(activeSite.id);
    }
  }, [waypoint, activeSite, routeDistanceStr, showToast, onSelect]);

  // Center on rover / player
  const handleCenterOnPlayer = useCallback(() => {
    setPan({ x: roverX - centerX, z: roverZ - centerZ });
    setZoom((zCur) => Math.max(1.8, zCur));
    showToast("Centered on rover");
  }, [roverX, roverZ, centerX, centerZ, showToast]);

  // Center on a specific position
  const handleCenterOnPosition = useCallback(
    (targetX: number, targetZ: number) => {
      setPan({ x: targetX - centerX, z: targetZ - centerZ });
      setZoom((zCur) => Math.max(1.6, zCur));
    },
    [centerX, centerZ]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyM" || e.key.toLowerCase() === "m" || e.key === "Escape" || e.code === "CapsLock") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.code === "KeyR" || e.key.toLowerCase() === "r" || e.code === "Space") {
        e.preventDefault();
        handleCenterOnPlayer();
        return;
      }
      if (e.code === "KeyC" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        setShowContours((prev) => {
          showToast(!prev ? "Contours · 500m interval" : "Contours hidden");
          return !prev;
        });
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((zVal) => Math.min(4.0, zVal * 1.25));
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((zVal) => Math.max(0.6, zVal / 1.25));
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleCenterOnPlayer, showToast]);

  // Coordinate projections
  // World units (meters) to screen pixels inside map viewport
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
        // Isometric 3D relief projection tilt
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

  // Screen pixels to world coordinates
  const projectScreenToWorld = useCallback(
    (sx: number, sy: number, width: number, height: number): [number, number] => {
      const viewW = regionWidth / zoom;
      const viewH = regionHeight / zoom;
      const viewCX = centerX + pan.x;
      const viewCZ = centerZ + pan.z;

      const normX = sx / width;
      const normZ = sy / height;

      const wx = viewCX - viewW / 2 + normX * viewW;
      const wz = viewCZ - viewH / 2 + normZ * viewH;
      return [wx, wz];
    },
    [regionWidth, regionHeight, zoom, centerX, centerZ, pan]
  );

  // Pointer dragging and pan
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
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
    const rect = vp.getBoundingClientRect();

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragDistanceRef.current = Math.hypot(dx, dy);

    const metersPerPixelX = regionWidth / (zoom * rect.width);
    const metersPerPixelZ = regionHeight / (zoom * rect.height);

    const maxPanX = regionWidth * 0.7;
    const maxPanZ = regionHeight * 0.7;

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
      showToast(`Waypoint set: ${m.latitude.toFixed(2)}°N, ${m.longitude.toFixed(2)}°E`);
    }
  };

  // Zoom handlers
  const handleZoom = (factor: number) => {
    setZoom((cur) => Math.max(0.6, Math.min(4.0, cur * factor)));
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    handleZoom(factor);
  };

  // Render Map Canvas (MOLA Elevation, Contours, Route line)
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

    // 2. Render Elevation Heatmap & Shading
    // Sample a 64x64 resolution grid across the visible screen
    const gridRes = 54;
    const stepX = width / gridRes;
    const stepY = height / gridRes;

    for (let gy = 0; gy < gridRes; gy++) {
      for (let gx = 0; gx < gridRes; gx++) {
        const sx = gx * stepX;
        const sy = gy * stepY;
        const [wx, wz] = projectScreenToWorld(sx + stepX / 2, sy + stepY / 2, width, height);
        const m = worldToMars(wx, wz);
        const elev = sampleMarsElevation(m.longitude, m.latitude);

        // Normalized elevation: -4000m to 14000m
        const normElev = Math.max(0, Math.min(1, (elev + 4000) / 18000));

        // Color ramp: deep rust -> ochre -> dusty terracotta -> pale summit
        const r = Math.round(75 + normElev * 140);
        const g = Math.round(45 + normElev * 110);
        const b = Math.round(35 + normElev * 85);
        const alpha = 0.42 + normElev * 0.38;

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
      const contourRes = 36;
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

    // 6. Route Line between Rover/Player and Selected Target
    const [rRoverX, rRoverY] = projectWorldToScreen(roverX, roverZ, width, height);
    const [rTargetX, rTargetY] = projectWorldToScreen(routeTargetX, routeTargetZ, width, height);

    ctx.beginPath();
    ctx.moveTo(rRoverX, rRoverY);
    ctx.lineTo(rTargetX, rTargetY);
    ctx.strokeStyle = "rgba(20, 14, 10, 0.75)";
    ctx.lineWidth = 4.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rRoverX, rRoverY);
    ctx.lineTo(rTargetX, rTargetY);
    ctx.strokeStyle = "#ffcd79";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Expanding Waypoint Pulse
    ctx.beginPath();
    ctx.arc(rTargetX, rTargetY, 18, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 191, 118, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }, [
    zoom,
    pan,
    perspective,
    showContours,
    roverX,
    roverZ,
    routeTargetX,
    routeTargetZ,
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
    const grid: [number, number][][] = [];

    for (let p = 0; p < rows; p++) {
      grid[p] = [];
      for (let q = 0; q < cols; q++) {
        const u = ((q / (cols - 1)) - 0.5) * 2;
        const v = ((p / (rows - 1)) - 0.5) * 2;
        const wx = site.x + u * r;
        const wz = site.z + v * r;
        const elev = sampleMarsElevation(worldToMars(wx, wz).longitude, worldToMars(wx, wz).latitude);

        // Isometric projection math matching reference
        const sx = w * (0.5 + 0.35 * u + 0.12 * v);
        const sy = h * (0.52 + 0.14 * u - 0.24 * v) - (elev / 8000) * (h * 0.42);
        grid[p].push([sx, sy]);
      }
    }

    // Normalize vertical bounds within canvas
    const allY = grid.flat().map((pt) => pt[1]);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const rangeY = maxY - minY || 1;

    for (const row of grid) {
      for (const pt of row) {
        pt[1] = 8 + ((h - 16) * (pt[1] - minY)) / rangeY;
      }
    }

    // Draw grid lines
    const strokeLine = (pts: [number, number][], strokeColor: string) => {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      pts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.stroke();
    };

    // Horizontal curves
    for (const row of grid) {
      strokeLine(row, "rgba(175, 198, 180, 0.65)");
    }
    // Vertical curves
    for (let c = 0; c < cols; c++) {
      strokeLine(grid.map((rPts) => rPts[c]), "rgba(137, 180, 170, 0.45)");
    }

    ctx.restore();
  }, [activeSite]);

  return (
    <div className="atlas-expedition-wrap" role="dialog" aria-modal="true" aria-label="Mars Expedition Atlas">
      {/* 1. Mast Header Bar */}
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
          <i className="dot" /> {isDriving ? "Rover online" : "Astronaut EVA"}
        </span>
        <button
          type="button"
          className="helpBtn"
          onClick={() => setGuideOpen(true)}
          title="Map Controls Guide"
          aria-label="Map controls"
        >
          ?
        </button>
        <button
          type="button"
          className="closeBtn"
          onClick={onClose}
          title="Exit Atlas [M / ESC]"
          aria-label="Close expedition atlas"
        >
          ✕
        </button>
      </header>

      {/* 2. Main Wrap Container */}
      <main className="wrap">
        {/* Titlebar with Sector Telemetry */}
        <div className="titlebar">
          <div>
            <div className="kicker">Mars / Navigation</div>
            <h1>Expedition atlas</h1>
          </div>
          <div className="sector meta">
            <b>SOL 018</b>
            <br />
            {view?.lightPhase ?? "Day"} · Survey simulation
          </div>
        </div>

        {/* 3. Main Split Grid: Map Viewport (Left) + Expedition Panel (Right) */}
        <div className="grid">
          {/* Left Column: Interactive Map */}
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
            {/* Terrain Render Canvas */}
            <div id="terrain">
              <canvas ref={terrainCanvasRef} />
            </div>

            {/* Atmosphere Vignette Overlay */}
            <div className="vignette" aria-hidden="true" />

            {/* Sector Header on Map */}
            <div className="maphead" aria-hidden="true">
              <small>Local survey sector</small>
              <strong>Elysium Planitia</strong>
            </div>

            {/* Map Perspective Switcher (Plan 2D vs 3D relief) */}
            <div className="maptools" aria-label="Map perspective">
              <button
                type="button"
                id="plan"
                className={perspective === "plan" ? "on" : ""}
                onClick={() => {
                  setPerspective("plan");
                  showToast("Plan perspective: Top-down 2D");
                }}
              >
                Plan
              </button>
              <button
                type="button"
                id="relief"
                className={perspective === "relief" ? "on" : ""}
                onClick={() => {
                  setPerspective("relief");
                  showToast("3D Relief perspective: Isometric elevation");
                }}
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
              {(() => {
                const { width, height } = viewportSize;
                const [sx, sy] = projectWorldToScreen(roverX, roverZ, width, height);
                return (
                  <div
                    className="roverPin"
                    style={{
                      left: `${sx}px`,
                      top: `${sy}px`,
                      transform: `translate(-50%, -50%) rotate(${Math.round((roverYaw * 180) / Math.PI)}deg)`,
                    }}
                    title={`${isDriving ? "MMSEV Crew Rover" : "Astronaut EVA"} at (${Math.round(roverX)}, ${Math.round(roverZ)})`}
                  >
                    ▲
                    <span style={{ transform: `translateX(-50%) rotate(${-Math.round((roverYaw * 180) / Math.PI)}deg)` }}>
                      {isDriving ? "ROVER 01" : "EVA-01"}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Floating Map Tools (Bottom-Right: Zoom, Center, Contours) */}
            <div className="tools">
              <button
                type="button"
                id="zin"
                onClick={() => handleZoom(1.25)}
                aria-label="Zoom in"
                title="Zoom in [+]"
              >
                +
              </button>
              <button
                type="button"
                id="zout"
                onClick={() => handleZoom(0.8)}
                aria-label="Zoom out"
                title="Zoom out [−]"
              >
                −
              </button>
              <button
                type="button"
                id="center"
                onClick={handleCenterOnPlayer}
                title="Center on rover [R]"
                aria-label="Center on rover"
              >
                ◎
              </button>
              <button
                type="button"
                id="contour"
                className={showContours ? "on" : ""}
                onClick={() => {
                  setShowContours((prev) => !prev);
                  showToast(!showContours ? "Contours · 500m interval" : "Contours hidden");
                }}
                title="Toggle contour lines [C]"
                aria-label="Toggle contour lines"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="m2 15 10-8 10 8-10 6z M2 10l10-8 10 8" />
                </svg>
              </button>
            </div>

            {/* Map Footer (Scale bar & North Indicator) */}
            <div className="mapfoot" aria-hidden="true">
              <div>
                <span id="scaleN">{zoom >= 2.0 ? "500 m" : "1 km"}</span>
                <i className="scale" style={{ width: `${Math.round(44 * zoom)}px` }} />
              </div>
              <span className="legend" id="north">
                ↑ N
              </span>
            </div>

            {/* Notification Toast Message */}
            {message && <div className="message">{message}</div>}
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
                      const isChosen = site.id === activeSite.id;
                      const distMeters = Math.round(Math.hypot(site.x - roverX, site.z - roverZ));
                      const distLabel = distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1)}km` : `${distMeters}m`;

                      return (
                        <button
                          key={site.id}
                          type="button"
                          className={`site ${isChosen ? "on" : ""}`}
                          onClick={() => {
                            setWaypoint(null);
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

                    <h2 id="name">{activeSite.name}</h2>
                    <p id="desc">{activeSite.description}</p>

                    {/* Real 3D Terrain Wireframe Mesh Canvas */}
                    <canvas
                      className="wire"
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
                {waypoint ? "Custom GPS Waypoint Active" : `Target locked · ${activeSite.name}`}
              </div>
              <button type="button" id="action" onClick={handleSetWaypointAction}>
                <span>{waypoint ? "Lock GPS Waypoint" : "Set Waypoint / Drive"}</span>
                <b>↗</b>
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
            Elysium Quadrangle · 12 × 12 km MOLA Survey ·{" "}
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
            <h2 id="guide-title">Map controls & Navigation Guide</h2>
            <p>
              Select any site on the terrain or in the survey list. Set its waypoint to guide rover navigation across Martian terrain.
            </p>
            <p>
              • <b>Drag</b> or use arrow keys to pan across Elysium Planitia.<br />
              • <b>Scroll / Pinch</b> or use <b>+ / −</b> to zoom.<br />
              • <b>R / Space</b> centers instantly on your rover or astronaut.<br />
              • <b>C</b> toggles 500m MOLA elevation contour lines.<br />
              • Choose <b>3D relief</b> at the top right to tilt into an isometric terrain perspective.<br />
              • Tap anywhere on the terrain to place a custom GPS beacon.
            </p>
            <button type="button" id="dismiss" onClick={() => setGuideOpen(false)}>
              Close Guide
            </button>
          </dialog>
        </div>
      )}
    </div>
  );
}
