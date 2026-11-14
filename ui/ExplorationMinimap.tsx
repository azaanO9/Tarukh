"use client";
import { useState, useMemo } from "react";
import type { View } from "./MarsWorld";
import { mapRectPoint, mapPoint, mapHeading, mapLidarContacts } from "../game/minimap";
import { MARS_LANDMARKS } from "../content/marsLandmarks";
import { surveyRegionLabel } from "../content/marsLandingSites";
import {
  REGION_WORLD_BOUNDS as B,
  isSurveyedRegion,
  worldToMars,
  sampleMarsElevation,
} from "../game/marsRegion";
import { assetUrl } from "../lib/assetUrl";
import { generateTopoContours } from "../game/topoContours";

export type MinimapZoomPreset = 120 | 220 | 450 | "overview";
const ZOOM_CYCLE: MinimapZoomPreset[] = [120, 220, 450, "overview"];

/**
 * Minimal GTA 5 style Mars Field Map.
 * - Defaults to a high-definition ZOOMED-IN view of the authentic NASA MOLA overview map
 *   (the real elevation map upon which the 3D ground, craters, and heights are built).
 * - Tracks the player in real-time in the center with a rotating heading chevron and sonar pulse.
 * - Scrolls the MOLA map smoothly under the player as they walk or drive across craters and plains.
 * - Supports one-click cycling between Close (120m), Cruising (220m), Wide (450m), and Full Regional Map.
 */
export default function ExplorationMinimap({
  view,
  selected,
  onOpenAtlas,
}: {
  view: View;
  selected: string;
  onOpenAtlas: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [userZoom, setUserZoom] = useState<MinimapZoomPreset | null>(null);

  const driving = Boolean(view.roverDriving);
  const x = driving ? view.roverX ?? view.x : view.x;
  const z = driving ? view.roverZ ?? view.z : view.z;
  const scan = driving ? view.lidar : undefined;

  // Active zoom preset: defaults to 120m on foot, 220m when driving rover, or user choice
  const activeZoom: MinimapZoomPreset = userZoom ?? (driving ? 220 : 120);
  const isOverview = activeZoom === "overview";
  const activeRange: number = isOverview ? 942 : activeZoom;

  const qx = Math.round(x * 2);
  const qz = Math.round(z * 2);

  // Real Mars topography contours computed from actual elevation model (quantized for 60fps caching)
  const topo = useMemo(
    () => generateTopoContours(qx * 0.5, qz * 0.5, activeRange, 6, 31, 188, 138),
    [qx, qz, activeRange]
  );

  if (view.cockpitView) return null;

  // Real-world coordinates and elevation on Mars
  const coords = worldToMars(x, z);
  const elevation = Math.round(sampleMarsElevation(coords.longitude, coords.latitude));
  const coordsLabel = `${Math.abs(coords.latitude).toFixed(2)}°${
    coords.latitude < 0 ? "S" : "N"
  } ${coords.longitude.toFixed(2)}°E · ${elevation >= 0 ? "+" : ""}${elevation}M`;

  // Scale in pixels per game meter for the zoomed-in MOLA map
  const scale = 88 / activeRange;

  // MOLA image position and dimensions in zoomed mode (centered on player at 100, 100)
  const imgX = 100 + (B.west - x) * scale;
  const imgY = 100 + (B.north - z) * scale;
  const imgWidth = (B.east - B.west) * scale;
  const imgHeight = (B.south - B.north) * scale;

  // Overview mode coordinate projection (maps entire region to the 188x138 radar box)
  const toRegion = (wx: number, wz: number) => ({
    x: 6 + Math.max(0, Math.min(1, (wx - B.west) / (B.east - B.west))) * 188,
    y: 31 + Math.max(0, Math.min(1, (wz - B.north) / (B.south - B.north))) * 138,
    inBounds: isSurveyedRegion(wx, wz),
  });

  const target = MARS_LANDMARKS.find((p) => p.id === selected) ?? MARS_LANDMARKS[0];
  const threat = scan?.threatDistance;
  const blocked = threat !== null && threat !== undefined;

  const localStatus = driving
    ? blocked
      ? `OBSTACLE · ${threat.toFixed(1)} M`
      : scan
      ? "PATH CLEAR · 12 M"
      : "SCANNING…"
    : "LIDAR DOCKED IN ROVER";

  const status = isOverview ? (blocked ? "HAZARD IN PATH" : coordsLabel) : localStatus;

  const clearancePct =
    blocked && threat !== undefined
      ? Math.min(100, Math.max(15, (threat / 20) * 100))
      : 100;

  const handleCycleZoom = () => {
    const currentIndex = ZOOM_CYCLE.indexOf(activeZoom);
    const nextIndex = (currentIndex + 1) % ZOOM_CYCLE.length;
    setUserZoom(ZOOM_CYCLE[nextIndex]);
  };

  const zoomBadgeLabel =
    activeZoom === "overview"
      ? "MOLA · REGION"
      : `MOLA · ${activeZoom}M`;

  return (
    <aside
      className="roam-minimap gta-minimap"
      data-driving={driving}
      data-open={open}
      data-zoom={activeZoom}
      data-blocked={blocked}
      aria-label="Exploration minimap and rover LiDAR"
    >
      <div className="roam-radar-frame">
        {/* Sleek minimal HUD tag overlay directly on the radar screen */}
        <div className="roam-gta-hud-overlay">
          <button
            type="button"
            className="roam-map-badge roam-mode-btn"
            onClick={handleCycleZoom}
            title="Click to cycle zoom: 120m (close), 220m (medium), 450m (wide), Full Region"
            aria-label={`Current minimap zoom: ${zoomBadgeLabel}. Click to cycle zoom level.`}
          >
            <span className="roam-badge-dot" />
            {zoomBadgeLabel}
          </button>
          <button
            type="button"
            className="roam-map-toggle"
            aria-label={open ? "Hide map" : "Show map"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "−" : "+"}
          </button>
        </div>

        {open && (
          <svg
            viewBox="5 30 190 140"
            className="roam-radar-svg roam-gta-rect-svg"
            role="img"
            aria-label={`North-up ${
              isOverview
                ? "full NASA MOLA elevation region map"
                : `${activeRange} metre zoomed NASA MOLA terrain map`
            } with real-time player location tracking and numbered landmarks.`}
          >
            <defs>
              {/* Rectangular radar clip */}
              <clipPath id="gta-rect-clip">
                <rect x="6" y="31" width="188" height="138" rx="6" />
              </clipPath>

              {/* 1. CREW ROVER VECTOR ICON */}
              <g id="icon-crew-rover">
                <circle
                  r="12"
                  fill="#38bdf8"
                  fillOpacity="0.18"
                  stroke="#38bdf8"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                />
                <rect x="-7.5" y="-7" width="2.8" height="4.2" rx="0.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
                <rect x="-7.5" y="-2.1" width="2.8" height="4.2" rx="0.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
                <rect x="-7.5" y="2.8" width="2.8" height="4.2" rx="0.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
                <rect x="4.7" y="-7" width="2.8" height="4.2" rx="0.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
                <rect x="4.7" y="-2.1" width="2.8" height="4.2" rx="0.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
                <rect x="4.7" y="2.8" width="2.8" height="4.2" rx="0.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
                <line x1="-6" y1="-5" x2="6" y2="-5" stroke="#475569" strokeWidth="0.8" />
                <line x1="-6" y1="0" x2="6" y2="0" stroke="#475569" strokeWidth="0.8" />
                <line x1="-6" y1="5" x2="6" y2="5" stroke="#475569" strokeWidth="0.8" />
                <rect x="-5" y="-7.5" width="10" height="15" rx="3" fill="#0284c7" stroke="#e0f2fe" strokeWidth="0.8" />
                <path d="M -3.5 -3 C -3.5 -6.5, 3.5 -6.5, 3.5 -3 Z" fill="#bae6fd" />
                <circle cx="-2.5" cy="-7.5" r="0.7" fill="#f8fafc" />
                <circle cx="2.5" cy="-7.5" r="0.7" fill="#f8fafc" />
              </g>

              {/* 2. CURIOSITY / SCIENCE ROVER VECTOR ICON */}
              <g id="icon-curiosity-rover">
                <circle
                  r="12"
                  fill="#c084fc"
                  fillOpacity="0.18"
                  stroke="#c084fc"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                />
                <rect x="-7.5" y="-6.5" width="2.5" height="4" rx="0.6" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.5" />
                <rect x="-7.5" y="-1.8" width="2.5" height="4" rx="0.6" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.5" />
                <rect x="-7.5" y="3" width="2.5" height="4" rx="0.6" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.5" />
                <rect x="5" y="-6.5" width="2.5" height="4" rx="0.6" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.5" />
                <rect x="5" y="-1.8" width="2.5" height="4" rx="0.6" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.5" />
                <rect x="5" y="3" width="2.5" height="4" rx="0.6" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.5" />
                <rect x="-4.5" y="-5" width="9" height="10.5" rx="1.8" fill="#7e22ce" stroke="#f3e8ff" strokeWidth="0.8" />
                <line x1="1.5" y1="-5" x2="1.8" y2="-9.5" stroke="#fbbf24" strokeWidth="1" />
                <circle cx="1.8" cy="-10" r="1.3" fill="#f59e0b" stroke="#78350f" strokeWidth="0.4" />
                <circle cx="1.8" cy="-10" r="0.5" fill="#ef4444" />
              </g>

              {/* 3. LANDING SHUTTLE / BASE MODULE ICON */}
              <g id="icon-landing-shuttle">
                <circle
                  r="12"
                  fill="#f59e0b"
                  fillOpacity="0.2"
                  stroke="#f59e0b"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                />
                <line x1="-4" y1="-4" x2="-8" y2="-8" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="-8" cy="-8" r="1.2" fill="#fbbf24" />
                <line x1="4" y1="-4" x2="8" y2="-8" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="8" cy="-8" r="1.2" fill="#fbbf24" />
                <line x1="-4" y1="4" x2="-8" y2="8" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="-8" cy="8" r="1.2" fill="#fbbf24" />
                <line x1="4" y1="4" x2="8" y2="8" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="1.2" fill="#fbbf24" />
                <rect x="-9" y="-1.5" width="18" height="3" rx="0.8" fill="#fde68a" stroke="#b45309" strokeWidth="0.5" />
                <circle r="4.8" fill="#f59e0b" stroke="#78350f" strokeWidth="0.8" />
                <circle r="1.8" fill="#ffffff" />
              </g>
            </defs>

            {/* Radar Bezel Frame */}
            <rect
              x="5.5"
              y="30.5"
              width="189"
              height="139"
              rx="6"
              fill="#060c14"
              stroke="rgba(255, 255, 255, 0.24)"
              strokeWidth="1.2"
            />

            {/* Clipped Map Contents */}
            <g clipPath="url(#gta-rect-clip)">
              {isOverview ? (
                /* =========================================================================
                   FULL OVERVIEW MODE: Complete Mars Trek region map (1884m x 1466m extent)
                   ========================================================================= */
                <>
                  <rect x="6" y="31" width="188" height="138" fill="#180e0a" />
                  <image
                    href={assetUrl("art/mars-mola-overview.webp")}
                    xlinkHref={assetUrl("art/mars-mola-overview.webp")}
                    x="6"
                    y="31"
                    width="188"
                    height="138"
                    preserveAspectRatio="none"
                  />

                  {/* Regional GPS Grid */}
                  <line x1="100" y1="31" x2="100" y2="169" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="0.75" />
                  <line x1="6" y1="100" x2="194" y2="100" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="0.75" />

                  {/* Landing Shuttle Base */}
                  {(() => {
                    const homePos = toRegion(0, 12);
                    return (
                      <g transform={`translate(${homePos.x} ${homePos.y}) scale(0.65)`}>
                        <use href="#icon-landing-shuttle" />
                      </g>
                    );
                  })()}

                  {/* Crew Rover */}
                  {!driving && (() => {
                    const crewPos = toRegion(view.roverX ?? x, view.roverZ ?? z);
                    return (
                      <g transform={`translate(${crewPos.x} ${crewPos.y}) rotate(${mapHeading(view.roverYaw ?? 0)}) scale(0.65)`}>
                        <use href="#icon-crew-rover" />
                      </g>
                    );
                  })()}

                  {/* Curiosity Rover */}
                  {view.curiosityX !== undefined && (() => {
                    const scoutPos = toRegion(view.curiosityX, view.curiosityZ ?? 0);
                    return (
                      <g transform={`translate(${scoutPos.x} ${scoutPos.y}) rotate(${mapHeading(view.curiosityYaw ?? 0)}) scale(0.65)`}>
                        <use href="#icon-curiosity-rover" />
                      </g>
                    );
                  })()}

                  {/* Numbered Landmark Pins */}
                  {MARS_LANDMARKS.map((place) => {
                    const pin = toRegion(place.x, place.z);
                    const isSelected = place.id === target.id;
                    return (
                      <g
                        key={place.id}
                        transform={`translate(${pin.x} ${pin.y})`}
                        opacity={isSelected ? 1 : 0.8}
                        style={{ cursor: "pointer" }}
                        onClick={onOpenAtlas}
                      >
                        <title>
                          {place.number}. {place.name} · {Math.round(Math.hypot(place.x - x, place.z - z))}m
                        </title>
                        {isSelected && (
                          <circle r="7.5" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 1.5" />
                        )}
                        <path
                          d="M0 -6 L5.5 0 L0 6 L-5.5 0 Z"
                          fill={isSelected ? "#f59e0b" : "#09111c"}
                          stroke={isSelected ? "#ffffff" : "#cbd5e1"}
                          strokeWidth={isSelected ? "1.2" : "0.8"}
                        />
                        <text
                          y="2.5"
                          textAnchor="middle"
                          fontSize="7"
                          fontWeight="900"
                          fill={isSelected ? "#09111c" : "#ffffff"}
                        >
                          {place.number}
                        </text>
                      </g>
                    );
                  })}

                  {/* Player Marker across region */}
                  {(() => {
                    const playerPos = toRegion(x, z);
                    return (
                      <g transform={`translate(${playerPos.x} ${playerPos.y})`}>
                        <circle r="8" fill="rgba(56, 189, 248, 0.28)" stroke="#38bdf8" strokeWidth="1.2" className="roam-radar-pulse-ring" />
                        <g transform={`rotate(${mapHeading(driving ? view.roverYaw ?? view.yaw : view.yaw)})`}>
                          <polygon points="0,-8 5,5.5 0,2.2 -5,5.5" fill="#ffffff" stroke="#060c14" strokeWidth="1.3" />
                          <circle cx="0" cy="2.2" r="0.9" fill="#38bdf8" />
                        </g>
                        <text y="-10" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="900" style={{ filter: "drop-shadow(0 1px 2px #000000)" }}>
                          YOU
                        </text>
                      </g>
                    );
                  })()}
                </>
              ) : (
                /* =========================================================================
                   ZOOMED-IN MOLA MAP: The authentic NASA MOLA big map zoomed in around the
                   player with 100% precision! Every crater, ridge, and valley scrolls
                   under the player arrow with crisp HD clarity.
                   ========================================================================= */
                <>
                  {/* Base Mars soil */}
                  <rect x="6" y="31" width="188" height="138" fill="#180e0a" />

                  {/* Authentic NASA MOLA map zoomed in and smoothly scrolling around the player */}
                  <image
                    href={assetUrl("art/mars-mola-overview.webp")}
                    xlinkHref={assetUrl("art/mars-mola-overview.webp")}
                    x={imgX}
                    y={imgY}
                    width={imgWidth}
                    height={imgHeight}
                    preserveAspectRatio="none"
                    className="roam-mola-zoomed-img"
                  />

                  {/* Vector Topographic Elevation Contour Lines */}
                  {topo.contours.map((contour, i) => (
                    <path
                      key={i}
                      d={contour.path}
                      fill="none"
                      stroke={contour.isMajor ? "#fde047" : "#fb923c"}
                      strokeOpacity={contour.isMajor ? 0.65 : 0.35}
                      strokeWidth={contour.isMajor ? "1.1" : "0.7"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={contour.isMajor ? undefined : "3 1.5"}
                    />
                  ))}

                  {/* Range Circles centered on player */}
                  <circle cx="100" cy="100" r={44} fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.7" strokeDasharray="3 3" />
                  <circle cx="100" cy="100" r={88} fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="0.8" />
                  <text x="146" y="98" fill="rgba(255, 255, 255, 0.45)" fontSize="6" fontWeight="700">
                    {Math.round(activeRange / 2)}m
                  </text>

                  {/* Subtle GPS Crosshairs */}
                  <line x1="100" y1="31" x2="100" y2="169" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="0.75" />
                  <line x1="6" y1="100" x2="194" y2="100" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="0.75" />

                  {/* Surface Rocks (on foot) */}
                  {!driving &&
                    (view.mapRocks ?? []).map((r, i) => {
                      const p = mapPoint(r.x, r.z, x, z, activeRange);
                      return (
                        !p.edge && (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={Math.max(1.5, (r.radius * 88) / activeRange)}
                            fill="#b39879"
                            stroke="#5c4833"
                            strokeWidth="0.5"
                          />
                        )
                      );
                    })}

                  {/* Active LiDAR Obstacles & Contacts (when driving rover) */}
                  {scan &&
                    mapLidarContacts(scan, x, z).map((contact, i) => (
                      <g
                        key={i}
                        className="roam-lidar-contact"
                        data-hazard={contact.inPath}
                        transform={`translate(${contact.x} ${contact.y})`}
                      >
                        {contact.inPath ? (
                          <>
                            <path d="M0 -8.5 L8.5 0 L0 8.5 L-8.5 0 Z" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
                            <text y="3" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="900">!</text>
                          </>
                        ) : (
                          <circle r={contact.radius} fill="#38bdf8" fillOpacity="0.75" stroke="#0284c7" strokeWidth="0.8" />
                        )}
                      </g>
                    ))}

                  {/* Landing Shuttle Base */}
                  {(() => {
                    const homePin = mapPoint(0, 12, x, z, activeRange);
                    return (
                      <g transform={`translate(${homePin.x} ${homePin.y})`}>
                        <use href="#icon-landing-shuttle" />
                      </g>
                    );
                  })()}

                  {/* Parked Crew Rover */}
                  {!driving && (() => {
                    const crewPin = mapPoint(view.roverX ?? x, view.roverZ ?? z, x, z, activeRange);
                    return (
                      <g transform={`translate(${crewPin.x} ${crewPin.y}) rotate(${mapHeading(view.roverYaw ?? 0)})`}>
                        <use href="#icon-crew-rover" />
                      </g>
                    );
                  })()}

                  {/* Curiosity Science Rover */}
                  {view.curiosityX !== undefined && (() => {
                    const scoutPin = mapPoint(view.curiosityX, view.curiosityZ ?? 0, x, z, activeRange);
                    return (
                      <g transform={`translate(${scoutPin.x} ${scoutPin.y}) rotate(${mapHeading(view.curiosityYaw ?? 0)})`}>
                        <use href="#icon-curiosity-rover" />
                      </g>
                    );
                  })()}

                  {/* Landmark Diamonds: Placed right on the craters when in view, clamped to edge when distant */}
                  {MARS_LANDMARKS.filter((p) => p.id !== target.id)
                    .concat(target)
                    .map((place) => {
                      const pin = mapRectPoint(place.x, place.z, x, z, activeRange);
                      const isSelected = place.id === target.id;
                      const dist = Math.round(Math.hypot(place.x - x, place.z - z));
                      return (
                        <g
                          key={place.id}
                          opacity={isSelected ? 1 : 0.8}
                          transform={`translate(${pin.x} ${pin.y})`}
                          style={{ cursor: "pointer" }}
                          onClick={onOpenAtlas}
                        >
                          <title>{place.name} · {dist} game metres</title>
                          {isSelected && (
                            <circle r="11" fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 2" />
                          )}
                          <path
                            d="M0 -9 L8 0 L0 9 L-8 0 Z"
                            fill={isSelected ? "#f59e0b" : "#0f172a"}
                            stroke={isSelected ? "#ffffff" : "#94a3b8"}
                            strokeWidth={isSelected ? "1.4" : "0.9"}
                          />
                          <text
                            y="3.5"
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="900"
                            fill={isSelected ? "#09111c" : "#ffffff"}
                          >
                            {place.number}
                          </text>
                        </g>
                      );
                    })}

                  {/* REAL-TIME PLAYER MARKER (Always centered on the zoomed MOLA map at 100, 100) */}
                  <g transform="translate(100 100)">
                    {/* Sonar Beacon Ring */}
                    <circle
                      r="8"
                      fill="rgba(56, 189, 248, 0.28)"
                      stroke="#38bdf8"
                      strokeWidth="1.2"
                      className="roam-radar-pulse-ring"
                    />
                    <circle r="14" fill="none" stroke="#38bdf8" strokeWidth="0.7" strokeDasharray="2.5 2" opacity="0.45" />

                    {/* GTA 5 Sharp Heading Chevron */}
                    <g
                      transform={`rotate(${mapHeading(
                        driving ? view.roverYaw ?? view.yaw : view.yaw
                      )})`}
                      className="roam-player-arrow"
                    >
                      <polygon points="0,-8.5 5,5.5 0,2.2 -5,5.5" fill="rgba(0,0,0,0.6)" transform="translate(0, 0.8)" />
                      <polygon
                        points="0,-8.5 5,5.5 0,2.2 -5,5.5"
                        fill="#ffffff"
                        stroke="#060c14"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                      <circle cx="0" cy="2.2" r="1.1" fill="#38bdf8" />
                    </g>

                    {/* High-Contrast "YOU" Badge */}
                    <text
                      y="-11"
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="7"
                      fontWeight="900"
                      letterSpacing="0.4"
                      style={{ filter: "drop-shadow(0 1px 2px #000000)" }}
                    >
                      YOU
                    </text>
                  </g>
                </>
              )}
            </g>

            {/* North Indicator */}
            <polygon points="100,32 96,38 104,38" fill="#ef4444" />
            <text
              x="100"
              y="47"
              textAnchor="middle"
              fill="#ef4444"
              fontSize="9"
              fontWeight="900"
              letterSpacing="0.5"
            >
              N
            </text>
          </svg>
        )}
      </div>

      {open && (
        <div className="roam-gta-hud-bottom">
          {/* 1. STATUS GAUGES (GTA 5 Tri-Bars directly beneath the radar frame) */}
          <div className="roam-gta-bars" aria-label="Status gauges">
            {/* Bar 1 (Path Clearance / Health): Cyan/Green, turns Orange/Red on hazard */}
            <div
              className={`roam-gta-bar roam-bar-clearance ${blocked ? "is-hazard" : "is-clear"}`}
              title={`Path clearance: ${blocked ? "Hazard detected" : "All clear"}`}
            >
              <div className="roam-gta-bar-fill" style={{ width: `${clearancePct}%` }} />
            </div>
            {/* Bar 2 (Sensor / Armor): Cyan */}
            <div className="roam-gta-bar roam-bar-telemetry" title="LiDAR active when driving">
              <div className="roam-gta-bar-fill" style={{ width: driving ? "100%" : "0%" }} />
            </div>
            {/* Bar 3 (MOLA Survey / Ability): Yellow */}
            <div className="roam-gta-bar roam-bar-special" title="Inside surveyed MOLA region">
              <div className="roam-gta-bar-fill" style={{ width: isSurveyedRegion(x, z) ? "100%" : "0%" }} />
            </div>
          </div>

          {/* 2. COMPACT GTA 5 LOCATION & TELEMETRY READOUT */}
          <div className="roam-gta-readout">
            <span className="roam-gta-loc">{driving && blocked ? "HAZARD DETECTED" : surveyRegionLabel(x, z)}</span>
            <span className={`roam-gta-sub ${blocked ? "is-blocked" : ""}`}>{status}</span>
          </div>

          {/* 3. MINIMAL FOOTER: LEGEND + ATLAS SHORTCUT */}
          <div className="roam-gta-footer">
            <div className="roam-map-legend" aria-label="Minimap legend">
              <span className="roam-legend-item"><span className="roam-legend-dot dot-shuttle" /> Lander</span>
              <span className="roam-legend-item"><span className="roam-legend-dot dot-crew" /> Crew</span>
              <span className="roam-legend-item"><span className="roam-legend-dot dot-scout" /> Curiosity</span>
            </div>
            <button
              type="button"
              className="roam-atlas-open"
              onClick={onOpenAtlas}
              aria-keyshortcuts="CapsLock"
              title="Open landmark atlas · Caps Lock"
              aria-label={`Open landmark atlas. Selected ${target.name}`}
            >
              <span className="roam-atlas-target">
                <span className="roam-atlas-pin-icon">◆</span>
                {target.number}. {target.name}
              </span>
              <small className="roam-atlas-dist">{Math.round(Math.hypot(target.x - x, target.z - z))}m · Atlas</small>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
