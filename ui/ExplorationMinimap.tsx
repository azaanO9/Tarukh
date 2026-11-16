"use client";
import { useState } from "react";
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
import { OUTPOST_SITE } from "../game/outpostSite";
import { GREENHOUSE_SITES } from "../game/greenhouseSites";
import { GARAGE_SITE } from "../game/garageSite";

export type MinimapZoomPreset = 120 | 220 | 450 | "overview";
const ZOOM_CYCLE: MinimapZoomPreset[] = [120, 220, 450, "overview"];

/**
 * Minimal GTA 5 style Mars Field Map.
 * - Clean HD zoomed-in view of the authentic NASA MOLA map centered on the player.
 * - Subtle, minimal LiDAR rock pips and vehicle/base blips.
 * - Real-time player tracking with heading chevron and smooth map scrolling.
 * - One-click zoom cycling: 120m (close), 220m (medium), 450m (wide), Full Region.
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
  const outpostPin = isOverview ? toRegion(OUTPOST_SITE.x, OUTPOST_SITE.z) : mapRectPoint(OUTPOST_SITE.x, OUTPOST_SITE.z, x, z, activeRange);
  const missionPin = view.storyTarget ? (isOverview ? toRegion(view.storyTarget.x,view.storyTarget.z) : mapRectPoint(view.storyTarget.x,view.storyTarget.z,x,z,activeRange)) : null;
  const threat = scan?.threatDistance;
  const blocked = threat !== null && threat !== undefined;

  const status = isOverview
    ? blocked
      ? "HAZARD IN PATH"
      : coordsLabel
    : driving && blocked
    ? `OBSTACLE · ${threat?.toFixed(1)} M`
    : coordsLabel;

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
      data-ui-zone="minimap"
      data-driving={driving}
      data-open={open}
      data-zoom={activeZoom}
      data-blocked={blocked}
      aria-label="Exploration minimap and navigation radar"
    >
      <div className="roam-radar-frame">
        {/* Sleek minimal HUD tag overlay directly on the radar screen */}
        <div className="roam-gta-hud-overlay">
          <button
            type="button"
            className="roam-map-badge roam-mode-btn"
            onClick={handleCycleZoom}
            title="Cycle zoom: 120m, 220m, 450m, Full Region"
            aria-label={`Current minimap zoom: ${zoomBadgeLabel}. Cycle zoom level.`}
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
            } with real-time player location and minimal landmark pins.`}
          >
            <defs>
              {/* Rectangular radar clip */}
              <clipPath id="gta-rect-clip">
                <rect x="6" y="31" width="188" height="138" rx="6" />
              </clipPath>

              {/* 1. MINIMAL CREW ROVER ICON (Compact 5x8px GTA 5 vehicle blip) */}
              <g id="icon-crew-rover">
                <rect x="-2.5" y="-4.2" width="5" height="8.4" rx="1.4" fill="#0284c7" stroke="#ffffff" strokeWidth="0.9" />
                <rect x="-1.6" y="-3.2" width="3.2" height="2.2" rx="0.5" fill="#bae6fd" />
              </g>

              {/* 2. MINIMAL CURIOSITY ROVER ICON (Compact 4.5x7.5px science blip) */}
              <g id="icon-curiosity-rover">
                <rect x="-2.2" y="-3.6" width="4.4" height="7.2" rx="1.2" fill="#7e22ce" stroke="#ffffff" strokeWidth="0.9" />
                <circle cx="0.8" cy="-3.6" r="0.9" fill="#f59e0b" />
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

                  {/* Crew Rover */}
                  {!driving && (() => {
                    const crewPos = toRegion(view.roverX ?? x, view.roverZ ?? z);
                    return (
                      <g transform={`translate(${crewPos.x} ${crewPos.y}) rotate(${mapHeading(view.roverYaw ?? 0)})`}>
                        <use href="#icon-crew-rover" />
                      </g>
                    );
                  })()}

                  {/* Curiosity Rover */}
                  {view.curiosityX !== undefined && (() => {
                    const scoutPos = toRegion(view.curiosityX, view.curiosityZ ?? 0);
                    return (
                      <g transform={`translate(${scoutPos.x} ${scoutPos.y}) rotate(${mapHeading(view.curiosityYaw ?? 0)})`}>
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
                        <circle r="7" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="1.1" className="roam-radar-pulse-ring" />
                        <g transform={`rotate(${mapHeading(driving ? view.roverYaw ?? view.yaw : view.yaw)})`}>
                          <polygon points="0,-7.5 4.5,5 0,2 -4.5,5" fill="#ffffff" stroke="#060c14" strokeWidth="1.2" />
                          <circle cx="0" cy="2" r="0.9" fill="#38bdf8" />
                        </g>
                        <text y="-9.5" textAnchor="middle" fill="#38bdf8" fontSize="6.5" fontWeight="900" style={{ filter: "drop-shadow(0 1px 2px #000000)" }}>
                          YOU
                        </text>
                      </g>
                    );
                  })()}
                </>
              ) : (
                /* =========================================================================
                   ZOOMED-IN MOLA MAP: Clean, pristine HD ground relief without contour clutter.
                   Subtle minimal rocks and sleek minimal vehicle blips.
                   ========================================================================= */
                <>
                  {/* Base Mars soil */}
                  <rect x="6" y="31" width="188" height="138" fill="#180e0a" />

                  {/* Authentic NASA MOLA map zoomed in around the player */}
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

                  {/* Subtle Range Circles centered on player */}
                  <circle cx="100" cy="100" r={44} fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.6" strokeDasharray="3 3" />
                  <circle cx="100" cy="100" r={88} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="0.75" />
                  <text x="146" y="98" fill="rgba(255, 255, 255, 0.35)" fontSize="6" fontWeight="700">
                    {Math.round(activeRange / 2)}m
                  </text>

                  {/* Subtle GPS Crosshairs */}
                  <line x1="100" y1="31" x2="100" y2="169" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.7" />
                  <line x1="6" y1="100" x2="194" y2="100" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.7" />

                  {/* Surface Rocks (on foot) - subtle and minimal */}
                  {!driving &&
                    (view.mapRocks ?? []).map((r, i) => {
                      const p = mapPoint(r.x, r.z, x, z, activeRange);
                      return (
                        !p.edge && (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={1.2}
                            fill="#d97706"
                            fillOpacity="0.25"
                          />
                        )
                      );
                    })}

                  {/* Active LiDAR Obstacles & Contacts (driving) - SUBTLE & MINIMAL BLUE DOTS */}
                  {scan &&
                    mapLidarContacts(scan, x, z).map((contact, i) => (
                      <g
                        key={i}
                        className="roam-lidar-contact"
                        data-hazard={contact.inPath}
                        transform={`translate(${contact.x} ${contact.y})`}
                      >
                        {contact.inPath ? (
                          <g>
                            <polygon points="0,-4 4,0 0,4 -4,0" fill="#ef4444" stroke="#ffffff" strokeWidth="0.8" />
                            <circle cx="0" cy="0" r="0.8" fill="#ffffff" />
                          </g>
                        ) : (
                          /* Subtle, small, translucent cyan pip */
                          <circle
                            r="1.6"
                            fill="#38bdf8"
                            fillOpacity="0.45"
                          />
                        )}
                      </g>
                    ))}

                  {/* Minimal Parked Crew Rover */}
                  {!driving && (() => {
                    const crewPin = mapPoint(view.roverX ?? x, view.roverZ ?? z, x, z, activeRange);
                    return (
                      <g transform={`translate(${crewPin.x} ${crewPin.y}) rotate(${mapHeading(view.roverYaw ?? 0)})`}>
                        <use href="#icon-crew-rover" />
                      </g>
                    );
                  })()}

                  {/* Minimal Curiosity Science Rover */}
                  {view.curiosityX !== undefined && (() => {
                    const scoutPin = mapPoint(view.curiosityX, view.curiosityZ ?? 0, x, z, activeRange);
                    return (
                      <g transform={`translate(${scoutPin.x} ${scoutPin.y}) rotate(${mapHeading(view.curiosityYaw ?? 0)})`}>
                        <use href="#icon-curiosity-rover" />
                      </g>
                    );
                  })()}

                  {/* Minimal Landmark Diamonds */}
                  {MARS_LANDMARKS.filter((p) => p.id !== target.id)
                    .concat(target)
                    .map((place) => {
                      const pin = mapRectPoint(place.x, place.z, x, z, activeRange);
                      const isSelected = place.id === target.id;
                      const dist = Math.round(Math.hypot(place.x - x, place.z - z));
                      return (
                        <g
                          key={place.id}
                          opacity={isSelected ? 1 : 0.75}
                          transform={`translate(${pin.x} ${pin.y})`}
                          style={{ cursor: "pointer" }}
                          onClick={onOpenAtlas}
                        >
                          <title>{place.name} · {dist} game metres</title>
                          {isSelected && (
                            <circle r="9.5" fill="none" stroke="#f59e0b" strokeWidth="1.1" strokeDasharray="2.5 1.5" />
                          )}
                          <path
                            d="M0 -7.5 L6.5 0 L0 7.5 L-6.5 0 Z"
                            fill={isSelected ? "#f59e0b" : "#0f172a"}
                            stroke={isSelected ? "#ffffff" : "#94a3b8"}
                            strokeWidth={isSelected ? "1.2" : "0.8"}
                          />
                          <text
                            y="2.8"
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

                  {/* REAL-TIME PLAYER MARKER (Always centered at 100, 100) */}
                  <g transform="translate(100 100)">
                    {/* Subtle Sonar Beacon Ring */}
                    <circle
                      r="7"
                      fill="rgba(56, 189, 248, 0.22)"
                      stroke="#38bdf8"
                      strokeWidth="1"
                      className="roam-radar-pulse-ring"
                    />

                    {/* GTA 5 Sharp Heading Chevron */}
                    <g
                      transform={`rotate(${mapHeading(
                        driving ? view.roverYaw ?? view.yaw : view.yaw
                      )})`}
                      className="roam-player-arrow"
                    >
                      <polygon points="0,-7.5 4.5,5 0,2 -4.5,5" fill="rgba(0,0,0,0.5)" transform="translate(0, 0.7)" />
                      <polygon
                        points="0,-7.5 4.5,5 0,2 -4.5,5"
                        fill="#ffffff"
                        stroke="#060c14"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                      <circle cx="0" cy="2" r="0.9" fill="#38bdf8" />
                    </g>

                    {/* High-Contrast "YOU" Badge */}
                    <text
                      y="-10"
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="6.5"
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

            <g transform={`translate(${outpostPin.x} ${outpostPin.y})`} role="img" aria-label="TARUKH outpost">
              <title>Outpost · {Math.round(Math.hypot(x - OUTPOST_SITE.x, z - OUTPOST_SITE.z))} game metres · fictional base</title>
              <path d="M-6 -2 L0 -7 L6 -2 V6 H-6Z" fill="#e7ffff" stroke="#113c48" strokeWidth="1.5" />
              <path d="M-1.5 6 V0 H1.5 V6" fill="#113c48" />
              <text y="14" textAnchor="middle" fill="#e7ffff" stroke="#102c37" strokeWidth="2" paintOrder="stroke" fontSize="6.5" fontWeight="800">OUTPOST</text>
            </g>
            {!isOverview && GREENHOUSE_SITES.map(site => {
              const point = mapRectPoint(site.x,site.z,x,z,activeRange);
              return <g key={site.id} transform={`translate(${point.x} ${point.y})`} role="img" aria-label={site.label}>
                <title>{site.label} · Food cultivation · {Math.round(Math.hypot(x-site.x,z-site.z))} game metres</title>
                <path d="M-4 4 Q-6 -5 5 -5 Q6 5 -4 4 M-4 4 L2 -2" fill="#d1eaa9" stroke="#213f2d" strokeWidth="1.3" />
              </g>;
            })}
            {!isOverview && (() => {
              const pin=mapRectPoint(GARAGE_SITE.x,GARAGE_SITE.z,x,z,activeRange);
              return <g transform={`translate(${pin.x} ${pin.y})`} role="img" aria-label="Rover garage">
                <title>Rover garage · E to deploy or park the crew rover · {Math.round(Math.hypot(x-GARAGE_SITE.x,z-GARAGE_SITE.z))} game metres</title>
                <path d="M-6 -2 L0 -6 L6 -2 V6 H-6Z" fill="#f5d397" stroke="#453521" strokeWidth="1.4" />
                <path d="M-3 5 V-1 H3 V5 M-3 2 H3" fill="none" stroke="#453521" strokeWidth="1.4" />
              </g>;
            })()}
            {missionPin && <g transform={`translate(${missionPin.x} ${missionPin.y})`} role="img" aria-label={`Mission destination: ${view.storyTarget?.label}`}>
              <title>Next stop · {view.storyTarget?.label}</title>
              <path d="M0 -8 L8 0 L0 8 L-8 0Z" fill="#ffd077" stroke="#192c38" strokeWidth="2"/>
              <text y="3" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#192c38">!</text>
            </g>}
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
              <span className="roam-legend-item"><span className="roam-legend-dot dot-crew" /> Crew</span>
              <span className="roam-legend-item"><span className="roam-legend-dot dot-scout" /> Curiosity</span>
            </div>
            <button
              type="button"
              className="roam-atlas-open"
              onClick={onOpenAtlas}
              aria-keyshortcuts="KeyM"
              title="Open field map · [M]"
              aria-label={`Open field map. Selected ${target.name}`}
            >
              <span className="roam-atlas-target">
                <span className="roam-atlas-pin-icon">◆</span>
                {target.number}. {target.name}
              </span>
              <small className="roam-atlas-dist">{Math.round(Math.hypot(target.x - x, target.z - z))}m · Map [M]</small>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
