"use client";
import { useState, useMemo } from "react";
import type { View } from "./MarsWorld";
import { mapRectPoint as mapPoint, mapHeading, mapLidarContacts, MAP_RANGE } from "../game/minimap";
import { LIDAR_RANGE } from "../game/roverLidar";
import { MARS_LANDMARKS } from "../content/marsLandmarks";
import { surveyRegionLabel } from "../content/marsLandingSites";
import { REGION_WORLD_BOUNDS as B, isSurveyedRegion } from "../game/marsRegion";
import { assetUrl } from "../lib/assetUrl";
import { generateTopoContours } from "../game/topoContours";

/**
 * Minimal GTA 5 style North-up Mars Field Map with real HD Mars ground texture,
 * authentic MOLA topography contour lines, vehicle vector icons and LiDAR status.
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

  const home = mapPoint(0, 12, x, z, range);
  const crew = mapPoint(view.roverX ?? x, view.roverZ ?? z, x, z, range);
  const scout =
    view.curiosityX === undefined
      ? null
      : mapPoint(view.curiosityX, view.curiosityZ ?? 0, x, z, range);

  const target = MARS_LANDMARKS.find((p) => p.id === selected) ?? MARS_LANDMARKS[0];
  const topoScale = 88 / range;
  const threat = scan?.threatDistance;
  const blocked = threat !== null && threat !== undefined;
  const status = driving
    ? blocked
      ? `OBSTACLE · ${threat.toFixed(1)} M`
      : scan
      ? "PATH CLEAR · 12 M"
      : "SCANNING…"
    : "LIDAR DOCKED IN ROVER";

  const clearancePct =
    blocked && threat !== undefined
      ? Math.min(100, Math.max(15, (threat / 20) * 100))
      : 100;

  return (
    <aside
      className="roam-minimap gta-minimap"
      data-driving={driving}
      data-open={open}
      data-blocked={blocked}
      aria-label="Exploration minimap and rover LiDAR"
    >
      <div className="roam-radar-frame">
        {/* Sleek minimal HUD tag overlay directly on the radar screen */}
        <div className="roam-gta-hud-overlay">
          <span className="roam-map-badge">
            <span className="roam-badge-dot" />
            {driving ? "LIDAR" : "SURFACE"} · {range}M
          </span>
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
            aria-label={`North-up ${range} metre MOLA terrain map with compressed distances and numbered landmarks. Player arrow in center. Crew rover, Curiosity rover, and lander indicated by icons. ${
              driving
                ? "Contacts show detected rocks; marked hazard diamonds indicate obstacles in travel path."
                : "Dots show nearby surface rocks."
            }`}
          >
            <defs>
              {/* Rectangular radar clip */}
              <clipPath id="gta-rect-clip">
                <rect x="6" y="31" width="188" height="138" rx="6" />
              </clipPath>

              {/* REAL HD MARS GROUND PATTERN (Authentic NASA/Poly Haven 2K photographic regolith texture) */}
              <pattern
                id="gta-mars-hd-ground"
                patternUnits="userSpaceOnUse"
                width="80"
                height="80"
                patternTransform={`translate(${((100 - (x * 88) / range) % 80 + 80) % 80} ${((100 - (z * 88) / range) % 80 + 80) % 80})`}
              >
                <image
                  href={assetUrl("art/mars-surface/dry-rocky-soil-color.webp")}
                  xlinkHref={assetUrl("art/mars-surface/dry-rocky-soil-color.webp")}
                  width="80"
                  height="80"
                  preserveAspectRatio="xMidYMid slice"
                />
              </pattern>

              {/* TOPOGRAPHIC RELIEF LIGHTING / HILLSHADE */}
              <linearGradient
                id="gta-topo-hillshade"
                x1={`${50 - Math.cos((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
                y1={`${50 - Math.sin((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
                x2={`${50 + Math.cos((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
                y2={`${50 + Math.sin((topo.hillshadeGradient.angleDeg * Math.PI) / 180) * 50}%`}
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.28 * topo.hillshadeGradient.contrast} />
                <stop offset="50%" stopColor="#000000" stopOpacity={0} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0.55 * topo.hillshadeGradient.contrast} />
              </linearGradient>

              {/* 1. CREW ROVER VECTOR ICON (NASA MMSEV Style 6-wheel rover) */}
              <g id="icon-crew-rover">
                <circle r="14" fill="#38bdf8" fillOpacity="0.14" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 2" />
                {/* Left 3 wheels */}
                <rect x="-8.5" y="-8" width="3.2" height="4.8" rx="1" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.6" />
                <rect x="-8.5" y="-2.4" width="3.2" height="4.8" rx="1" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.6" />
                <rect x="-8.5" y="3.2" width="3.2" height="4.8" rx="1" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.6" />
                {/* Right 3 wheels */}
                <rect x="5.3" y="-8" width="3.2" height="4.8" rx="1" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.6" />
                <rect x="5.3" y="-2.4" width="3.2" height="4.8" rx="1" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.6" />
                <rect x="5.3" y="3.2" width="3.2" height="4.8" rx="1" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.6" />
                {/* Suspension axles */}
                <line x1="-7" y1="-5.6" x2="7" y2="-5.6" stroke="#475569" strokeWidth="0.8" />
                <line x1="-7" y1="0" x2="7" y2="0" stroke="#475569" strokeWidth="0.8" />
                <line x1="-7" y1="5.6" x2="7" y2="5.6" stroke="#475569" strokeWidth="0.8" />
                {/* Pressurized cabin chassis */}
                <rect x="-5.5" y="-8.5" width="11" height="17" rx="3.5" fill="#0284c7" stroke="#e0f2fe" strokeWidth="0.9" />
                {/* Cockpit canopy */}
                <path d="M -4 -3.5 C -4 -7.5, 4 -7.5, 4 -3.5 Z" fill="#bae6fd" />
                {/* Solar panel roof tiles */}
                <rect x="-3.5" y="-1.5" width="7" height="6.5" rx="0.8" fill="#0369a1" stroke="#38bdf8" strokeWidth="0.5" />
                {/* Headlights */}
                <circle cx="-3" cy="-8.5" r="0.8" fill="#f8fafc" />
                <circle cx="3" cy="-8.5" r="0.8" fill="#f8fafc" />
              </g>

              {/* 2. CURIOSITY / SCIENCE ROVER VECTOR ICON (Rocker-Bogie 6-wheel science rover) */}
              <g id="icon-curiosity-rover">
                <circle r="14" fill="#c084fc" fillOpacity="0.14" stroke="#c084fc" strokeWidth="0.8" strokeDasharray="3 2" />
                {/* Left 3 wheels */}
                <rect x="-9" y="-7.5" width="3" height="4.6" rx="0.8" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.6" />
                <rect x="-9" y="-2" width="3" height="4.6" rx="0.8" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.6" />
                <rect x="-9" y="3.5" width="3" height="4.6" rx="0.8" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.6" />
                {/* Right 3 wheels */}
                <rect x="6" y="-7.5" width="3" height="4.6" rx="0.8" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.6" />
                <rect x="6" y="-2" width="3" height="4.6" rx="0.8" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.6" />
                <rect x="6" y="3.5" width="3" height="4.6" rx="0.8" fill="#1e1b4b" stroke="#c084fc" strokeWidth="0.6" />
                {/* Rocker-Bogie struts */}
                <line x1="-7.5" y1="-5.2" x2="-4" y2="0" stroke="#7e22ce" strokeWidth="0.8" />
                <line x1="-7.5" y1="5.8" x2="-4" y2="0" stroke="#7e22ce" strokeWidth="0.8" />
                <line x1="7.5" y1="-5.2" x2="4" y2="0" stroke="#7e22ce" strokeWidth="0.8" />
                <line x1="7.5" y1="5.8" x2="4" y2="0" stroke="#7e22ce" strokeWidth="0.8" />
                {/* Central Science Equipment Box */}
                <rect x="-5" y="-5.5" width="10" height="12" rx="2" fill="#7e22ce" stroke="#f3e8ff" strokeWidth="0.9" />
                <rect x="-3.5" y="-3.5" width="7" height="6.5" rx="1" fill="#9333ea" />
                {/* Forward Mast / ChemCam */}
                <line x1="1.8" y1="-5.5" x2="2.2" y2="-10.5" stroke="#fbbf24" strokeWidth="1.2" />
                <circle cx="2.2" cy="-11" r="1.5" fill="#f59e0b" stroke="#78350f" strokeWidth="0.4" />
                <circle cx="2.2" cy="-11" r="0.6" fill="#ef4444" />
                {/* Rear RTG Generator */}
                <rect x="-2" y="6.5" width="4" height="3" rx="0.6" fill="#f59e0b" stroke="#b45309" strokeWidth="0.5" />
              </g>

              {/* 3. LANDING SHUTTLE / BASE HABITAT VECTOR ICON */}
              <g id="icon-landing-shuttle">
                <circle r="14" fill="#f59e0b" fillOpacity="0.14" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3 2" />
                {/* 4 Diagonal Landing Legs */}
                <line x1="-5" y1="-5" x2="-9" y2="-9" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="-9" cy="-9" r="1.4" fill="#fbbf24" />
                <line x1="5" y1="-5" x2="9" y2="-9" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="9" cy="-9" r="1.4" fill="#fbbf24" />
                <line x1="-5" y1="5" x2="-9" y2="9" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="-9" cy="9" r="1.4" fill="#fbbf24" />
                <line x1="5" y1="5" x2="9" y2="9" stroke="#d97706" strokeWidth="1.2" />
                <circle cx="9" cy="9" r="1.4" fill="#fbbf24" />
                {/* Solar arrays */}
                <rect x="-10" y="-1.5" width="20" height="3" rx="0.8" fill="#fde68a" stroke="#b45309" strokeWidth="0.6" />
                {/* Central Module */}
                <circle r="5.5" fill="#f59e0b" stroke="#78350f" strokeWidth="0.9" />
                <circle r="2" fill="#ffffff" />
              </g>
            </defs>

            {/* Rectangular Bezel & Outer Frame */}
            <rect
              x="5.5"
              y="30.5"
              width="189"
              height="139"
              rx="6"
              fill="#060c14"
              stroke="rgba(255, 255, 255, 0.22)"
              strokeWidth="1.2"
            />

            {/* Clipped Map Contents */}
            <g clipPath="url(#gta-rect-clip)">
              {/* Layer 1: Mars Warm Terracotta Subsurface Base */}
              <rect x="6" y="31" width="188" height="138" fill="#180e0a" />

              {/* Layer 2: REAL HD MARS GROUND TEXTURE (photographic 2K soil, pebbles & regolith) */}
              <rect x="6" y="31" width="188" height="138" fill="url(#gta-mars-hd-ground)" opacity="0.92" />

              {/* Layer 3: Subtle NASA MOLA regional elevation tint for broad macro context */}
              <image
                href={assetUrl("art/mars-mola-overview.webp")}
                xlinkHref={assetUrl("art/mars-mola-overview.webp")}
                x={100 + (B.west - x) * topoScale}
                y={100 + (B.north - z) * topoScale}
                width={(B.east - B.west) * topoScale}
                height={(B.south - B.north) * topoScale}
                opacity="0.32"
                style={{ mixBlendMode: "overlay" }}
                preserveAspectRatio="none"
              />

              {/* Layer 4: Topographic Shaded Relief (Hillshade) */}
              <rect
                x="6"
                y="31"
                width="188"
                height="138"
                fill="url(#gta-topo-hillshade)"
                style={{ mixBlendMode: "multiply" }}
              />

              {/* Layer 5: REAL MARS TOPOGRAPHIC CONTOUR LINES (GTA 5 Topo Isolines) */}
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

              {/* Layer 6: Subtle GPS Grid Crosshairs */}
              <line x1="100" y1="31" x2="100" y2="169" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="0.75" />
              <line x1="6" y1="100" x2="194" y2="100" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="0.75" />

              {/* Layer 7: Distance range rings */}
              <circle cx="100" cy="100" r={44} fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.7" strokeDasharray="3 3" />
              <circle cx="100" cy="100" r={88} fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="0.8" />

              {/* Nearby Surface Rocks (when walking on foot) */}
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

              {/* Active LiDAR Detected Contacts (static blips, no sweep scanning beam) */}
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

              {/* LANDING SHUTTLE / BASE MODULE */}
              <g
                transform={`translate(${home.x} ${home.y})`}
                className="roam-blip-landmark"
                aria-label="Landing shuttle"
              >
                <use href="#icon-landing-shuttle" />
              </g>

              {/* CREW ROVER (When on foot: shown parked with heading yaw rotation) */}
              {!driving && (
                <g
                  transform={`translate(${crew.x} ${crew.y}) rotate(${mapHeading(view.roverYaw ?? 0)})`}
                  className="roam-blip-rover"
                  aria-label="Crew Rover"
                >
                  <use href="#icon-crew-rover" />
                </g>
              )}

              {/* CURIOSITY / SCIENCE ROVER (Shown with real-time heading yaw rotation) */}
              {scout && (
                <g
                  transform={`translate(${scout.x} ${scout.y}) rotate(${mapHeading(view.curiosityYaw ?? 0)})`}
                  className="roam-blip-curiosity"
                  aria-label="Curiosity Rover"
                >
                  <use href="#icon-curiosity-rover" />
                </g>
              )}

              {/* Numbered Landmark Diamonds */}
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

              {/* Player Arrow follows the active walker or rover heading */}
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
            </g>

            {/* North Indicator */}
            <polygon points="100,32 96,38 104,38" fill="#ef4444" />
            <text
              x="100"
              y="47"
              textAnchor="middle"
              fill="#ef4444"
              fontSize="9.5"
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
