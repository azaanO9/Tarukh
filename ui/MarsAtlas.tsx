"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MARS_LANDMARKS, MARS_TREK_URL } from "../content/marsLandmarks";
import {
  MARS_REGION,
  REGION_WORLD_BOUNDS as B,
  worldToMars,
  sampleMarsElevation,
  isSurveyedRegion,
} from "../game/marsRegion";
import { atlasBounds, type AtlasView } from "../game/marsAtlas";
import { PLAYABLE_BOUNDS } from "../game/explorationBounds";
import { assetUrl } from "../lib/assetUrl";
import { OUTPOST_SITE } from "../game/outpostSite";
import { GARAGE_SITE } from "../game/garageSite";
import { GREENHOUSE_SITES } from "../game/greenhouseSites";
import type { View } from "./MarsWorld";

interface Waypoint {
  x: number;
  z: number;
  label: string;
}

interface BasePOI {
  id: string;
  name: string;
  kind: "base" | "infrastructure";
  x: number;
  z: number;
  icon: string;
  description: string;
}

const EXPEDITION_BASES: BasePOI[] = [
  {
    id: "shuttle",
    name: "Landing Shuttle Base",
    kind: "base",
    x: 0,
    z: 12,
    icon: "🚀",
    description: "Primary landing craft and pressurized environmental shelter. Full radiation shielding.",
  },
  {
    id: "outpost",
    name: "Habitat Campus Outpost",
    kind: "base",
    x: OUTPOST_SITE.x,
    z: OUTPOST_SITE.z,
    icon: "🏛️",
    description: "Main surface habitat modules, airlocks, and life support control systems.",
  },
  {
    id: "garage",
    name: "Rover Garage & Charger",
    kind: "infrastructure",
    x: GARAGE_SITE.x,
    z: GARAGE_SITE.z,
    icon: "🚙",
    description: "MMSEV maintenance bay, 1200W solar inverter array, and automated battery dock.",
  },
  {
    id: "greenhouses",
    name: "Hydroponic Greenhouse Farm",
    kind: "infrastructure",
    x: GREENHOUSE_SITES[0].x,
    z: GREENHOUSE_SITES[0].z,
    icon: "🌿",
    description: "Six circular pressurized crop domes producing oxygen and expedition food rations.",
  },
];

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
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, z: 0 });
  const [activeTab, setActiveTab] = useState<"map" | "poi" | "brief">("map");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "volcano" | "crater" | "base">("all");
  const [waypoint, setWaypoint] = useState<Waypoint | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number; elev: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panZ: 0 });
  const dragDistanceRef = useRef(0);

  // Region bounds
  const regionWidth = B.east - B.west;
  const regionHeight = B.south - B.north;
  const centerX = (B.west + B.east) / 2;
  const centerZ = (B.north + B.south) / 2;

  // Real world coordinates of the explorer
  const playerCoords = worldToMars(x, z);
  const playerElevation = Math.round(sampleMarsElevation(playerCoords.longitude, playerCoords.latitude));

  // Current view window in world units
  const viewWidth = regionWidth / zoom;
  const viewHeight = regionHeight / zoom;
  const viewCenterX = centerX + pan.x;
  const viewCenterZ = centerZ + pan.z;
  const viewWest = viewCenterX - viewWidth / 2;
  const viewNorth = viewCenterZ - viewHeight / 2;

  // Selected landmark object
  const activeLandmark =
    MARS_LANDMARKS.find((p) => p.id === selected) ??
    EXPEDITION_BASES.find((b) => b.id === selected) ??
    MARS_LANDMARKS[0];

  // Center on player coordinates
  const handleCenterOnPlayer = useCallback(() => {
    setPan({ x: x - centerX, z: z - centerZ });
    setZoom((zCur) => Math.max(1.8, zCur));
  }, [x, z, centerX, centerZ]);

  // Center on a specific world position
  const handleCenterOnPosition = useCallback((targetX: number, targetZ: number) => {
    setPan({ x: targetX - centerX, z: targetZ - centerZ });
    setZoom((zCur) => Math.max(1.6, zCur));
  }, [centerX, centerZ]);

  // Reset to full regional overview
  const handleResetView = useCallback(() => {
    setPan({ x: 0, z: 0 });
    setZoom(1.0);
  }, []);

  // Keyboard controls inside the map
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyM" || e.key.toLowerCase() === "m" || e.key === "Escape" || e.code === "CapsLock") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        handleCenterOnPlayer();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(4.0, z * 1.25));
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(0.6, z / 1.25));
        return;
      }
      if (e.code === "KeyL") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleCenterOnPlayer]);

  // Pointer dragging and click handling
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
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    // Calculate live Mars coordinates under mouse
    const mouseRatioX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const mouseRatioY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const mouseWorldX = viewWest + mouseRatioX * viewWidth;
    const mouseWorldZ = viewNorth + mouseRatioY * viewHeight;
    const mCoords = worldToMars(mouseWorldX, mouseWorldZ);
    const mElev = Math.round(sampleMarsElevation(mCoords.longitude, mCoords.latitude));
    setHoverCoords({ lat: mCoords.latitude, lon: mCoords.longitude, elev: mElev });

    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragDistanceRef.current = Math.hypot(dx, dy);

    const metersPerPixelX = viewWidth / rect.width;
    const metersPerPixelY = viewHeight / rect.height;

    const maxPanX = regionWidth * 0.7;
    const maxPanZ = regionHeight * 0.7;

    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.panX - dx * metersPerPixelX)),
      z: Math.max(-maxPanZ, Math.min(maxPanZ, dragStartRef.current.panZ - dy * metersPerPixelY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    // If drag was very small, treat it as a click to set waypoint
    if (dragDistanceRef.current < 6) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clickRatioX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const clickRatioY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const clickWorldX = viewWest + clickRatioX * viewWidth;
      const clickWorldZ = viewNorth + clickRatioY * viewHeight;

      // Find if clicked near an existing landmark
      const clickedLandmark = MARS_LANDMARKS.find((p) => {
        const dist = Math.hypot(p.x - clickWorldX, p.z - clickWorldZ);
        return dist < (viewWidth * 0.035);
      });

      if (clickedLandmark) {
        onSelect(clickedLandmark.id);
        setWaypoint({
          x: clickedLandmark.x,
          z: clickedLandmark.z,
          label: clickedLandmark.name,
        });
      } else {
        setWaypoint({
          x: clickWorldX,
          z: clickWorldZ,
          label: "GPS Waypoint",
        });
      }
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.max(0.6, Math.min(4.0, z * zoomFactor)));
  };

  // Metric scale calculation
  const scaleDisplayMeters = zoom > 2.5 ? 100 : zoom > 1.4 ? 250 : 500;
  const scalePercentWidth = (scaleDisplayMeters / viewWidth) * 100;

  // Waypoint distance and bearing calculation
  const waypointDist = waypoint
    ? Math.round(Math.hypot(waypoint.x - x, waypoint.z - z))
    : null;
  const waypointBearing = waypoint
    ? Math.round((Math.atan2(waypoint.x - x, -(waypoint.z - z)) * 180 / Math.PI + 360) % 360)
    : null;

  // Filtered landmarks list
  const filteredLandmarks = MARS_LANDMARKS.filter((p) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "volcano") return p.kind === "volcano";
    if (categoryFilter === "crater") return p.kind === "crater" || p.kind === "valley" || p.kind === "plain";
    return true;
  });

  return (
    <div className="gta-atlas-container" role="dialog" aria-modal="true" aria-label="Mars Expedition Map">
      {/* 1. GTA V Style Top Pause Menu Navigation Bar */}
      <header className="gta-atlas-header">
        <div className="gta-atlas-brand">
          <span className="gta-brand-dot" />
          <span className="gta-brand-title">TARUKH</span>
          <span className="gta-brand-sub">// MARS EXPEDITION ATLAS</span>
        </div>

        <nav className="gta-atlas-tabs" aria-label="Map categories">
          <button
            type="button"
            className={`gta-atlas-tab ${activeTab === "map" ? "active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            <span>MAP</span>
            {activeTab === "map" && <i className="gta-tab-active-bar" />}
          </button>
          <button
            type="button"
            className={`gta-atlas-tab ${activeTab === "poi" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("poi");
              setSidebarOpen(true);
            }}
          >
            <span>LANDMARKS</span>
            {activeTab === "poi" && <i className="gta-tab-active-bar" />}
          </button>
          <button
            type="button"
            className={`gta-atlas-tab ${activeTab === "brief" ? "active" : ""}`}
            onClick={() => setActiveTab("brief")}
          >
            <span>EXPEDITION BRIEF</span>
            {activeTab === "brief" && <i className="gta-tab-active-bar" />}
          </button>
        </nav>

        <div className="gta-atlas-meta">
          <div className="gta-meta-item">
            <span className="meta-lbl">COORDINATES</span>
            <span className="meta-val">
              {Math.abs(playerCoords.latitude).toFixed(2)}°{playerCoords.latitude < 0 ? "S" : "N"}{" "}
              {playerCoords.longitude.toFixed(2)}°E
            </span>
          </div>
          <div className="gta-meta-item">
            <span className="meta-lbl">ELEVATION</span>
            <span className="meta-val">{playerElevation >= 0 ? "+" : ""}{playerElevation}M</span>
          </div>
          <div className="gta-meta-item">
            <span className="meta-lbl">SOL TIME</span>
            <span className="meta-val">10:42</span>
          </div>
          <button
            type="button"
            className="gta-atlas-close-btn"
            onClick={onClose}
            title="Return to exploration [M] / [ESC]"
            aria-label="Close map"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 2. Main Map Workspace & Interactive Surface */}
      <div className="gta-atlas-workspace">
        <div
          ref={containerRef}
          className="gta-atlas-map-viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          role="region"
          aria-label="Interactive Mars MOLA elevation map. Click and drag to pan, scroll to zoom, click to place waypoint."
        >
          {/* SVG Map Canvas */}
          <svg
            className="gta-atlas-svg-canvas"
            viewBox={`${viewWest} ${viewNorth} ${viewWidth} ${viewHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <pattern id="gtaGridSmall" width={regionWidth / 20} height={regionHeight / 20} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${regionWidth / 20} 0 L 0 0 0 ${regionHeight / 20}`}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth={0.8 / zoom}
                />
              </pattern>
            </defs>

            {/* NASA MOLA Elevation Map Shaded Relief Image */}
            <image
              href={assetUrl("art/mars-mola-overview.webp")}
              x={B.west}
              y={B.north}
              width={regionWidth}
              height={regionHeight}
              preserveAspectRatio="none"
            />

            {/* Subtle High-Tech Coordinate Grid Overlay */}
            <rect
              x={B.west}
              y={B.north}
              width={regionWidth}
              height={regionHeight}
              fill="url(#gtaGridSmall)"
              pointerEvents="none"
            />

            {/* Latitude & Longitude Reference Lines */}
            {[-10, 0, 10, 20, 30].map((lat) => {
              const yPos = B.north + ((MARS_REGION.north - lat) / (MARS_REGION.north - MARS_REGION.south)) * regionHeight;
              return (
                <g key={`lat-${lat}`} opacity="0.35" pointerEvents="none">
                  <line
                    x1={B.west}
                    y1={yPos}
                    x2={B.east}
                    y2={yPos}
                    stroke="rgba(56, 189, 248, 0.4)"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  />
                  <text
                    x={viewWest + 10 / zoom}
                    y={yPos - 3 / zoom}
                    fill="#38bdf8"
                    fontSize={9 / zoom}
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    {lat >= 0 ? `${lat}°N` : `${Math.abs(lat)}°S`}
                  </text>
                </g>
              );
            })}

            {/* GPS Route Line from Player to Custom Waypoint */}
            {waypoint && (
              <g pointerEvents="none">
                <line
                  x1={x}
                  y1={z}
                  x2={waypoint.x}
                  y2={waypoint.z}
                  stroke="#ff6d00"
                  strokeWidth={2.5 / zoom}
                  strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  opacity="0.85"
                />
                <circle cx={waypoint.x} cy={waypoint.z} r={16 / zoom} fill="none" stroke="#ff6d00" strokeWidth={1.5 / zoom} opacity="0.4" />
              </g>
            )}

            {/* Expedition Base Pins */}
            {EXPEDITION_BASES.map((b) => {
              const isSel = selected === b.id;
              return (
                <g
                  key={b.id}
                  transform={`translate(${b.x}, ${b.z})`}
                  className="gta-base-pin-group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(b.id);
                    handleCenterOnPosition(b.x, b.z);
                  }}
                  cursor="pointer"
                >
                  <circle
                    cx="0"
                    cy="0"
                    r={isSel ? 10 / zoom : 7 / zoom}
                    fill={isSel ? "#ff6d00" : "rgba(30, 41, 59, 0.9)"}
                    stroke="#ffffff"
                    strokeWidth={1.5 / zoom}
                  />
                  <text
                    x="0"
                    y={3 / zoom}
                    textAnchor="middle"
                    fontSize={8 / zoom}
                  >
                    {b.icon}
                  </text>
                  {(zoom > 1.2 || isSel) && (
                    <text
                      x="0"
                      y={-12 / zoom}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={9 / zoom}
                      fontFamily="monospace"
                      fontWeight="800"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.9))"
                    >
                      {b.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* NASA MOLA Survey Landmark Pins */}
            {MARS_LANDMARKS.map((p) => {
              const isSel = selected === p.id;
              return (
                <g
                  key={p.id}
                  transform={`translate(${p.x}, ${p.z})`}
                  className="gta-landmark-pin-group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(p.id);
                    handleCenterOnPosition(p.x, p.z);
                  }}
                  cursor="pointer"
                >
                  {isSel && (
                    <circle
                      cx="0"
                      cy="0"
                      r={18 / zoom}
                      fill="none"
                      stroke="#ff6d00"
                      strokeWidth={2 / zoom}
                      opacity="0.8"
                    />
                  )}
                  <circle
                    cx="0"
                    cy="0"
                    r={isSel ? 12 / zoom : 8 / zoom}
                    fill={isSel ? "#ff6d00" : "#0f172a"}
                    stroke={isSel ? "#ffffff" : "#38bdf8"}
                    strokeWidth={1.8 / zoom}
                  />
                  <text
                    x="0"
                    y={3.5 / zoom}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={8.5 / zoom}
                    fontFamily="monospace"
                    fontWeight="800"
                  >
                    {p.number}
                  </text>
                  {(zoom > 1.3 || isSel) && (
                    <g transform={`translate(0, ${-14 / zoom})`} pointerEvents="none">
                      <rect
                        x={-p.name.length * 3.5 / zoom - 4 / zoom}
                        y={-9 / zoom}
                        width={p.name.length * 7 / zoom + 8 / zoom}
                        height={12 / zoom}
                        rx={2 / zoom}
                        fill="rgba(15, 23, 42, 0.9)"
                        stroke={isSel ? "#ff6d00" : "rgba(255,255,255,0.2)"}
                        strokeWidth={0.8 / zoom}
                      />
                      <text
                        x="0"
                        y={0}
                        textAnchor="middle"
                        fill={isSel ? "#ffedd5" : "#f1f5f9"}
                        fontSize={8.5 / zoom}
                        fontFamily="sans-serif"
                        fontWeight="700"
                      >
                        {p.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Custom GPS Waypoint Marker */}
            {waypoint && (
              <g
                transform={`translate(${waypoint.x}, ${waypoint.z})`}
                className="gta-waypoint-group"
                onClick={(e) => {
                  e.stopPropagation();
                  setWaypoint(null);
                }}
                cursor="pointer"
              >
                <polygon
                  points={`0,${-12 / zoom} ${10 / zoom},0 0,${12 / zoom} ${-10 / zoom},0`}
                  fill="#ff6d00"
                  stroke="#ffffff"
                  strokeWidth={2 / zoom}
                />
                <circle cx="0" cy="0" r={3 / zoom} fill="#ffffff" />
                <g transform={`translate(0, ${-18 / zoom})`} pointerEvents="none">
                  <rect
                    x={-42 / zoom}
                    y={-10 / zoom}
                    width={84 / zoom}
                    height={13 / zoom}
                    rx={2 / zoom}
                    fill="rgba(10, 8, 10, 0.92)"
                    stroke="#ff6d00"
                    strokeWidth={1 / zoom}
                  />
                  <text
                    x="0"
                    y={-1 / zoom}
                    textAnchor="middle"
                    fill="#ffedd5"
                    fontSize={8 / zoom}
                    fontFamily="monospace"
                    fontWeight="800"
                  >
                    GPS WAYPOINT
                  </text>
                </g>
              </g>
            )}

            {/* Player Explorer Position & Directional Heading Chevron */}
            <g transform={`translate(${x}, ${z})`} className="gta-player-pin-group" pointerEvents="none">
              <circle cx="0" cy="0" r={15 / zoom} fill="none" stroke="#00e676" strokeWidth={1.5 / zoom} opacity="0.6">
                <animate attributeName="r" values={`${10 / zoom};${24 / zoom}`} dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0" dur="1.8s" repeatCount="indefinite" />
              </circle>
              {/* Heading Cone / Vision Angle */}
              {view && (
                <path
                  d={`M 0 0 L ${Math.sin(view.yaw - 0.4) * (28 / zoom)} ${-Math.cos(view.yaw - 0.4) * (28 / zoom)} A ${28 / zoom} ${28 / zoom} 0 0 1 ${Math.sin(view.yaw + 0.4) * (28 / zoom)} ${-Math.cos(view.yaw + 0.4) * (28 / zoom)} Z`}
                  fill="rgba(0, 230, 118, 0.22)"
                />
              )}
              {/* Player Core Blip */}
              <circle cx="0" cy="0" r={7 / zoom} fill="#00e676" stroke="#ffffff" strokeWidth={2 / zoom} />
              {/* Heading Pointer Arrow */}
              {view && (
                <polygon
                  points={`0,${-12 / zoom} ${4 / zoom},${-5 / zoom} ${-4 / zoom},${-5 / zoom}`}
                  fill="#ffffff"
                  transform={`rotate(${(view.yaw * 180) / Math.PI} 0 0)`}
                />
              )}
              <text
                x="0"
                y={17 / zoom}
                textAnchor="middle"
                fill="#00e676"
                fontSize={9 / zoom}
                fontFamily="monospace"
                fontWeight="900"
                filter="drop-shadow(0 1px 3px rgba(0,0,0,0.9))"
              >
                YOU
              </text>
            </g>

            {/* Crew Rover Blip (when player is on foot and rover is parked) */}
            {view?.roverX !== undefined && view.roverZ !== undefined && !view.roverDriving && (
              <g transform={`translate(${view.roverX}, ${view.roverZ})`} pointerEvents="none">
                <rect
                  x={-6 / zoom}
                  y={-5 / zoom}
                  width={12 / zoom}
                  height={10 / zoom}
                  rx={2 / zoom}
                  fill="#0284c7"
                  stroke="#ffffff"
                  strokeWidth={1.2 / zoom}
                />
                <text x="0" y={-8 / zoom} textAnchor="middle" fill="#38bdf8" fontSize={7.5 / zoom} fontFamily="monospace" fontWeight="800">
                  ROVER
                </text>
              </g>
            )}

            {/* Curiosity Autonomous Rover Blip */}
            {view?.curiosityX !== undefined && view.curiosityZ !== undefined && (
              <g transform={`translate(${view.curiosityX}, ${view.curiosityZ})`} pointerEvents="none">
                <circle cx="0" cy="0" r={5 / zoom} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.2 / zoom} />
                <text x="0" y={-8 / zoom} textAnchor="middle" fill="#fbbf24" fontSize={7.5 / zoom} fontFamily="monospace" fontWeight="800">
                  CURIOSITY
                </text>
              </g>
            )}
          </svg>

          {/* North Directional Compass (Top-Left) */}
          <div className="gta-map-north-badge" aria-hidden="true">
            <span className="north-arrow">▲</span>
            <span className="north-label">N</span>
          </div>

          {/* Live Mouse Crosshair Coordinates (Top-Right HUD Overlay) */}
          {hoverCoords && (
            <div className="gta-map-crosshair-hud" aria-hidden="true">
              <span className="crosshair-icon">✛</span>
              <span>
                {Math.abs(hoverCoords.lat).toFixed(2)}°{hoverCoords.lat < 0 ? "S" : "N"}{" "}
                {hoverCoords.lon.toFixed(2)}°E · ELEV {hoverCoords.elev >= 0 ? "+" : ""}{hoverCoords.elev}M
              </span>
            </div>
          )}

          {/* On-Map Zoom & Centering Controls HUD (GTA 5 Style) */}
          <div className="gta-map-controls-hud">
            <button
              type="button"
              className="gta-hud-btn"
              onClick={() => setZoom((z) => Math.min(4.0, z * 1.35))}
              title="Zoom In [+]"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="gta-hud-btn"
              onClick={() => setZoom((z) => Math.max(0.6, z / 1.35))}
              title="Zoom Out [-]"
              aria-label="Zoom out"
            >
              −
            </button>
            <div className="gta-hud-divider" />
            <button
              type="button"
              className="gta-hud-btn center-btn"
              onClick={handleCenterOnPlayer}
              title="Center Map on You [Space]"
              aria-label="Center on player"
            >
              ◎
            </button>
            <button
              type="button"
              className="gta-hud-btn reset-btn"
              onClick={handleResetView}
              title="Full Region Overview [1x]"
              aria-label="Reset map"
            >
              1×
            </button>
          </div>

          {/* Metric Elevation & Ground Scale Bar (Bottom-Left) */}
          <div className="gta-map-scale-hud">
            <div className="scale-bar-track">
              <i style={{ width: `${Math.min(100, Math.max(10, scalePercentWidth))}%` }} />
            </div>
            <span className="scale-text">
              {scaleDisplayMeters}m (Game) ≈ {(scaleDisplayMeters * MARS_REGION.realKmPerGameMetre).toFixed(0)} km (Mars)
            </span>
          </div>

          {/* Active Waypoint Distance & Bearing HUD Pill */}
          {waypoint && waypointDist !== null && (
            <div className="gta-map-waypoint-hud">
              <span className="waypoint-icon">◆</span>
              <div className="waypoint-info">
                <b>{waypoint.label}</b>
                <small>{waypointDist} m · {waypointBearing}° N</small>
              </div>
              <button
                type="button"
                className="waypoint-clear-btn"
                onClick={() => setWaypoint(null)}
                title="Clear GPS waypoint"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* 3. Right-Side Collapsible Landmark Directory (GTA V POI Index) */}
        {sidebarOpen && (
          <aside className="gta-atlas-sidebar">
            <div className="gta-sidebar-header">
              <h3>POINTS OF INTEREST</h3>
              <div className="gta-filter-chips">
                <button
                  type="button"
                  className={`filter-chip ${categoryFilter === "all" ? "active" : ""}`}
                  onClick={() => setCategoryFilter("all")}
                >
                  ALL
                </button>
                <button
                  type="button"
                  className={`filter-chip ${categoryFilter === "volcano" ? "active" : ""}`}
                  onClick={() => setCategoryFilter("volcano")}
                >
                  VOLCANOES
                </button>
                <button
                  type="button"
                  className={`filter-chip ${categoryFilter === "crater" ? "active" : ""}`}
                  onClick={() => setCategoryFilter("crater")}
                >
                  CRATERS
                </button>
              </div>
            </div>

            {/* List of Landmarks & Bases */}
            <div className="gta-poi-list">
              {/* Bases Section */}
              <div className="gta-poi-category-title">EXPEDITION BASES</div>
              {EXPEDITION_BASES.map((b) => {
                const dist = Math.round(Math.hypot(b.x - x, b.z - z));
                const isSel = selected === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`gta-poi-card ${isSel ? "active" : ""}`}
                    onClick={() => {
                      onSelect(b.id);
                      handleCenterOnPosition(b.x, b.z);
                    }}
                  >
                    <div className="poi-card-icon">{b.icon}</div>
                    <div className="poi-card-meta">
                      <b>{b.name}</b>
                      <small>{dist} m · {b.kind.toUpperCase()}</small>
                    </div>
                    <span className="poi-card-chevron">›</span>
                  </button>
                );
              })}

              {/* Natural Landmarks Section */}
              <div className="gta-poi-category-title">NATURAL LANDMARKS</div>
              {filteredLandmarks.map((p) => {
                const dist = Math.round(Math.hypot(p.x - x, p.z - z));
                const isSel = selected === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`gta-poi-card ${isSel ? "active" : ""}`}
                    onClick={() => {
                      onSelect(p.id);
                      handleCenterOnPosition(p.x, p.z);
                    }}
                  >
                    <div className="poi-card-num">{p.number}</div>
                    <div className="poi-card-meta">
                      <b>{p.name}</b>
                      <small>{dist} m · {p.kind.toUpperCase()}</small>
                    </div>
                    <span className="poi-card-chevron">›</span>
                  </button>
                );
              })}
            </div>

            {/* Active Landmark Information Card */}
            {activeLandmark && (
              <div className="gta-landmark-detail-card">
                <div className="detail-header">
                  <h4>{"number" in activeLandmark ? `${activeLandmark.number}. ` : ""}{activeLandmark.name}</h4>
                  <span className="detail-tag">{activeLandmark.kind.toUpperCase()}</span>
                </div>
                <p className="detail-desc">{activeLandmark.description}</p>
                {"source" in activeLandmark && (
                  <a
                    href={activeLandmark.source}
                    target="_blank"
                    rel="noreferrer"
                    className="detail-source-link"
                  >
                    {activeLandmark.sourceLabel ?? "NASA / USGS Source"} ↗
                  </a>
                )}
                <div className="detail-actions">
                  <button
                    type="button"
                    className="gta-waypoint-set-btn"
                    onClick={() => {
                      setWaypoint({
                        x: activeLandmark.x,
                        z: activeLandmark.z,
                        label: activeLandmark.name,
                      });
                      handleCenterOnPosition(activeLandmark.x, activeLandmark.z);
                    }}
                  >
                    ◆ SET AS GPS WAYPOINT
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* 4. Bottom GTA V Controller / Keyboard Legend Strip */}
      <footer className="gta-atlas-footer">
        <div className="gta-legend-keys">
          <span className="gta-key-tip">
            <kbd className="gta-kbd">LMB DRAG</kbd> PAN MAP
          </span>
          <span className="gta-key-tip">
            <kbd className="gta-kbd">SCROLL / + −</kbd> ZOOM
          </span>
          <span className="gta-key-tip">
            <kbd className="gta-kbd">SPACE</kbd> CENTER PLAYER
          </span>
          <span className="gta-key-tip">
            <kbd className="gta-kbd">LMB CLICK</kbd> SET WAYPOINT
          </span>
          <span className="gta-key-tip">
            <kbd className="gta-kbd">L</kbd> TOGGLE POI
          </span>
          <span className="gta-key-tip">
            <kbd className="gta-kbd">M / ESC</kbd> BACK
          </span>
        </div>

        <div className="gta-footer-right">
          <a
            href={MARS_TREK_URL}
            target="_blank"
            rel="noreferrer"
            className="gta-trek-link"
          >
            NASA Mars Trek Regional Model ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
