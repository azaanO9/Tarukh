"use client";
import { useState, useMemo } from "react";
import type { View } from "./MarsWorld";
import { mapRectPoint as mapPoint, mapHeading, mapLidarContacts, MAP_RANGE } from "../game/minimap";
import { LIDAR_RANGE } from "../game/roverLidar";
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

type MinimapMode = "region" | "local";

/**
 * Minimal GTA 5 style Mars Field Map with real-time player location tracking.
 * - Defaults to the authentic NASA MOLA elevation region map (the image on which the 3D ground is based).
 * - Accurately displays all craters, valleys, volcanic peaks, and landmarks with real player GPS tracking.
 * - Supports one-click toggle between Full Region Map and Local LiDAR Radar.
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
  const [mode, setMode] = useState<MinimapMode>("region");

  const driving = Boolean(view.roverDriving);
  const x = driving ? view.roverX ?? view.x : view.x;
  const z = driving ? view.roverZ ?? view.z : view.z;
  const scan = driving ? view.lidar : undefined;
  const range = driving ? scan?.range ?? LIDAR_RANGE : MAP_RANGE;
  const qx = Math.round(x * 2);
  const qz = Math.round(z * 2);

  // Real Mars topography contours computed from actual elevation model (quantized to 0.5m for 60fps cache)
  const topo = useMemo(
    () => generateTopoContours(qx * 0.5, qz * 0.5, range, 6, 31, 188, 138),
    [qx, qz, range]
  );

  if (view.cockpitView) return null;

  // Real-world coordinates and elevation on Mars
  const coords = worldToMars(x, z);
  const elevation = Math.round(sampleMarsElevation(coords.longitude, coords.latitude));
  const coordsLabel = `${Math.abs(coords.latitude).toFixed(2)}°${
    coords.latitude < 0 ? "S" : "N"
  } ${coords.longitude.toFixed(2)}°E · ${elevation >= 0 ? "+" : ""}${elevation}M`;

  // Local radar points
  const home = mapPoint(0, 12, x, z, range);
  const crew = mapPoint(view.roverX ?? x, view.roverZ ?? z, x, z, range);
  const scout =
    view.curiosityX === undefined
      ? null
      : mapPoint(view.curiosityX, view.curiosityZ ?? 0, x, z, range);

  // Region map coordinate projection (maps world meters to the 188x138 radar frame)
  const toRegion = (wx: number, wz: number) => ({
    x: 6 + Math.max(0, Math.min(1, (wx - B.west) / (B.east - B.west))) * 188,
    y: 31 + Math.max(0, Math.min(1, (wz - B.north) / (B.south - B.north))) * 138,
    inBounds: isSurveyedRegion(wx, wz),
  });

  const playerRegion = toRegion(x, z);
  const homeRegion = toRegion(0, 12);
  const crewRegion = toRegion(view.roverX ?? x, view.roverZ ?? z);
  const scoutRegion =
    view.curiosityX === undefined ? null : toRegion(view.curiosityX, view.curiosityZ ?? 0);

  const target = MARS_LANDMARKS.find((p) => p.id === selected) ?? MARS_LANDMARKS[0];
  const topoScale = 88 / range;
  const threat = scan?.threatDistance;
  const blocked = threat !== null && threat !== undefined;

  const localStatus = driving
    ? blocked
      ? `OBSTACLE · ${threat.toFixed(1)} M`
      : scan
      ? "PATH CLEAR · 12 M"
      : "SCANNING…"
    : "LIDAR DOCKED IN ROVER";

  const status = mode === "region" ? (blocked ? "HAZARD IN PATH" : coordsLabel) : localStatus;

  const clearancePct =
    blocked && threat !== undefined
      ? Math.min(100, Math.max(15, (threat / 20) * 100))
      : 100;

  return (
    <aside
      className="roam-minimap gta-minimap"
      data-driving={driving}
      data-open={open}
      data-mode={mode}
      data-blocked={blocked}
      aria-label="Exploration minimap and rover LiDAR"
    >
      <div className="roam-radar-frame">
        {/* Sleek minimal HUD tag overlay directly on the radar screen */}
        <div className="roam-gta-hud-overlay">
          <button
            type="button"
            className="roam-map-badge roam-mode-btn"
            onClick={() => setMode((m) => (m === "region" ? "local" : "region"))}
            title="Click to toggle Full Region MOLA Map / Local Radar"
            aria-label={`Current view: ${
              mode === "region" ? "Full MOLA Region" : "Local Radar"
            }. Click to switch view.`}
          >
            <span className="roam-badge-dot" />
            {mode === "region"
              ? "MOLA REGION"
              : driving
              ? `LIDAR · ${range}M`
              : `SURFACE · ${range}M`}
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
              mode === "region"
                ? "full NASA MOLA elevation region map"
                : `${range} metre local terrain radar`
            } with real-time player location tracking and numbered landmarks.`}
          >
            <defs>
              {/* Rectangular radar clip */}
              <clipPath id="gta-rect-clip">
                <rect x="6" y="31" width="188" height="138" rx="6" />
              </clipPath>

              {/* HD Photographic Mars Ground Texture for local mode */}
              <pattern
                id="gta-mars-hd-ground"
                patternUnits="userSpaceOnUse"
                width="80"
                height="80"
                patternTransform={`translate(${((100 - (x * 88) / range) % 80 + 80) % 80} ${
                  ((100 - (z * 88) / range) % 80 + 80) % 80
                })`}
              >
                <image
                  href={assetUrl("art/mars-surface/dry-rocky-soil-color.webp")}
                  xlinkHref={assetUrl("art/mars-surface/dry-rocky-soil-color.webp")}
                  width="80"
                  height="80"
                  preserveAspectRatio="xMidYMid slice"
                />
              </pattern>

              {/* Local Topographic Relief Shading */}
              <linearGradient
                id="gta-topo-hillshade"
                x1={`${50 - Math.cos((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
                y1={`${50 - Math.sin((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
                x2={`${50 + Math.cos((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
                y2={`${50 + Math.sin((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
              >
                <stop
                  offset="0%"
                  stopColor="#ffffff"
                  stopOpacity={0.28 * topo.hillshadeGradient.contrast}
                />
                <stop offset="50%" stopColor="#000000" stopOpacity={0} />
                <stop
                  offset="100%"
                  stopColor="#000000"
                  stopOpacity={0.55 * topo.hillshadeGradient.contrast}
                />
              </linearGradient>

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
              {mode === "region" ? (
                /* =========================================================================
                   REGION MODE: The exact authentic NASA MOLA overview map from the image,
                   showing all real craters, canyons, volcanoes and elevation in crisp HD,
                   with real-time player GPS tracking across Mars.
                   ========================================================================= */
                <>
                  {/* Base warm Mars background */}
                  <rect x="6" y="31" width="188" height="138" fill="#180e0a" />

                  {/* Real NASA MOLA Elevation Map (Full extent matching the terrain heightmap) */}
                  <image
                    href={assetUrl("art/mars-mola-overview.webp")}
                    xlinkHref={assetUrl("art/mars-mola-overview.webp")}
                    x="6"
                    y="31"
                    width="188"
                    height="138"
                    preserveAspectRatio="none"
                  />

                  {/* Subtle GPS Grid Lines */}
                  <line x1="53" y1="31" x2="53" y2="169" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.6" strokeDasharray="3 3" />
                  <line x1="100" y1="31" x2="100" y2="169" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="0.75" />
                  <line x1="147" y1="31" x2="147" y2="169" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.6" strokeDasharray="3 3" />
                  <line x1="6" y1="77" x2="194" y2="77" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.6" strokeDasharray="3 3" />
                  <line x1="6" y1="100" x2="194" y2="100" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="0.75" />
                  <line x1="6" y1="123" x2="194" y2="123" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.6" strokeDasharray="3 3" />

                  {/* Landing Shuttle Base */}
                  <g transform={`translate(${homeRegion.x} ${homeRegion.y}) scale(0.65)`}>
                    <use href="#icon-landing-shuttle" />
                  </g>

                  {/* Parked Crew Rover (when walking on foot) */}
                  {!driving && (
                    <g
                      transform={`translate(${crewRegion.x} ${crewRegion.y}) rotate(${mapHeading(
                        view.roverYaw ?? 0
                      )}) scale(0.65)`}
                    >
                      <use href="#icon-crew-rover" />
                    </g>
                  )}

                  {/* Curiosity Rover */}
                  {scoutRegion && (
                    <g
                      transform={`translate(${scoutRegion.x} ${scoutRegion.y}) rotate(${mapHeading(
                        view.curiosityYaw ?? 0
                      )}) scale(0.65)`}
                    >
                      <use href="#icon-curiosity-rover" />
                    </g>
                  )}

                  {/* Numbered Landmark Pins positioned at their actual craters / mountains */}
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

                  {/* REAL-TIME PLAYER GPS TRACKING ON MARS MAP */}
                  <g transform={`translate(${playerRegion.x} ${playerRegion.y})`}>
                    {/* Pulsing Sonar Ring */}
                    <circle
                      r="8"
                      fill="rgba(56, 189, 248, 0.28)"
                      stroke="#38bdf8"
                      strokeWidth="1.2"
                      className="roam-radar-pulse-ring"
                    />
                    <circle r="14" fill="none" stroke="#38bdf8" strokeWidth="0.7" strokeDasharray="2.5 2" opacity="0.45" />

                    {/* GTA 5 Sharp Player Chevron Arrow */}
                    <g
                      transform={`rotate(${mapHeading(
                        driving ? view.roverYaw ?? view.yaw : view.yaw
                      )})`}
                    >
                      {/* Arrow drop shadow */}
                      <polygon points="0,-8 5,5.5 0,2.2 -5,5.5" fill="rgba(0,0,0,0.6)" transform="translate(0, 0.8)" />
                      {/* Sharp white arrow */}
                      <polygon
                        points="0,-8 5,5.5 0,2.2 -5,5.5"
                        fill="#ffffff"
                        stroke="#060c14"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                      <circle cx="0" cy="2.2" r="0.9" fill="#38bdf8" />
                    </g>

                    {/* High-Contrast "YOU" Badge */}
                    <text
                      y="-10"
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
              ) : (
                /* =========================================================================
                   LOCAL RADAR MODE: Close-up 30m / 80m LiDAR scan centered on the player,
                   with local vector elevation contours, rocks and obstacle hazard diamonds.
                   ========================================================================= */
                <>
                  <rect x="6" y="31" width="188" height="138" fill="#180e0a" />

                  {/* Local photographic ground texture */}
                  <rect x="6" y="31" width="188" height="138" fill="url(#gta-mars-hd-ground)" opacity="0.92" />

                  {/* Registered MOLA relief overlay */}
                  <image
                    href={assetUrl("art/mars-mola-overview.webp")}
                    xlinkHref={assetUrl("art/mars-mola-overview.webp")}
                    x={100 + (B.west - x) * topoScale}
                    y={100 + (B.north - z) * topoScale}
                    width={(B.east - B.west) * topoScale}
                    height={(B.south - B.north) * topoScale}
                    opacity="0.35"
                    style={{ mixBlendMode: "overlay" }}
                    preserveAspectRatio="none"
                  />

                  {/* Shaded relief hillshade */}
                  <rect
                    x="6"
                    y="31"
                    width="188"
                    height="138"
                    fill="url(#gta-topo-hillshade)"
                    style={{ mixBlendMode: "multiply" }}
                  />

                  {/* Vector Topographic Contour Lines */}
                  {topo.contours.map((contour, i) => (
                    <path
                      key={i}
                      d={contour.path}
                      fill="none"
                      stroke={contour.isMajor ? "#fde047" : "#f97316"}
                      strokeOpacity={contour.isMajor ? 0.9 : 0.55}
                      strokeWidth={contour.isMajor ? "1.2" : "0.75"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={contour.isMajor ? undefined : "3 1.5"}
                    />
                  ))}

                  {/* GPS Radar Crosshairs */}
                  <line x1="100" y1="31" x2="100" y2="169" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="0.75" />
                  <line x1="6" y1="100" x2="194" y2="100" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="0.75" />

                  {/* Range Rings */}
                  <circle cx="100" cy="100" r={44} fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.7" strokeDasharray="3 3" />
                  <circle cx="100" cy="100" r={88} fill="none" stroke="rgba(255, 255, 255, 0.22)" strokeWidth="0.8" />

                  {/* Surface Rocks (on foot) */}
                  {!driving &&
                    (view.mapRocks ?? []).map((r, i) => {
                      const p = mapPoint(r.x, r.z, x, z);
                      return (
                        !p.edge && (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={Math.max(1.5, (r.radius * 88) / MAP_RANGE)}
                            fill="#b39879"
                            stroke="#5c4833"
                            strokeWidth="0.5"
                          />
                        )
                      );
                    })}

                  {/* Active LiDAR Detected Contacts */}
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
                            <path
                              d="M0 -8.5 L8.5 0 L0 8.5 L-8.5 0 Z"
                              fill="#ef4444"
                              stroke="#ffffff"
                              strokeWidth="1.2"
                            />
                            <text y="3" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="900">
                              !
                            </text>
                          </>
                        ) : (
                          <circle
                            r={contact.radius}
                            fill="#38bdf8"
                            fillOpacity="0.75"
                            stroke="#0284c7"
                            strokeWidth="0.8"
                          />
                        )}
                      </g>
                    ))}

                  {/* Local Landing Shuttle */}
                  <g transform={`translate(${home.x} ${home.y})`}>
                    <use href="#icon-landing-shuttle" />
                  </g>

                  {/* Local Parked Crew Rover */}
                  {!driving && (
                    <g transform={`translate(${crew.x} ${crew.y}) rotate(${mapHeading(view.roverYaw ?? 0)})`}>
                      <use href="#icon-crew-rover" />
                    </g>
                  )}

                  {/* Local Curiosity */}
                  {scout && (
                    <g transform={`translate(${scout.x} ${scout.y}) rotate(${mapHeading(view.curiosityYaw ?? 0)})`}>
                      <use href="#icon-curiosity-rover" />
                    </g>
                  )}

                  {/* Local Landmark Clamped Bearing Diamonds */}
                  {MARS_LANDMARKS.filter((p) => p.id !== target.id)
                    .concat(target)
                    .map((place) => {
                      const pin = mapPoint(place.x, place.z, x, z, range);
                      return (
                        <g
                          key={place.id}
                          opacity={place.id === target.id ? 1 : 0.7}
                          transform={`translate(${pin.x} ${pin.y})`}
                        >
                          <title>
                            {place.name} · {Math.round(Math.hypot(place.x - x, place.z - z))} game metres
                          </title>
                          <path
                            d="M0 -10L9 0L0 10L-9 0Z"
                            fill={place.id === target.id ? "#fff1b9" : "#b9d9df"}
                            stroke="#18242d"
                          />
                          <text
                            y="5"
                            textAnchor="middle"
                            fontSize="14"
                            fontWeight="700"
                            fill="#18242d"
                          >
                            {place.number}
                          </text>
                        </g>
                      );
                    })}

                  {/* Centered Player Arrow */}
                  <g
                    transform={`translate(100 100) rotate(${mapHeading(
                      driving ? view.roverYaw ?? view.yaw : view.yaw
                    )})`}
                    className="roam-player-arrow"
                  >
                    <circle r="3.5" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
                    <path
                      d="M 0 -9.5 L 5.5 6.5 L 0 3.2 L -5.5 6.5 Z"
                      fill="#ffffff"
                      stroke="#040811"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <circle cx="0" cy="3.2" r="1.1" fill="#38bdf8" />
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
            {/* Bar 1 (Path Clearance / Health): Green, turns Red on hazard */}
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
