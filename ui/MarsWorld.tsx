"use client";
import { createStreamedMars } from "./world/streamedMars";
import { createMarsRegionalLandscape, MARS_HORIZON_DISTANCE } from "./world/marsRegionalLandscape";
import { createDetailDistanceCulling } from "./world/detailDistanceCulling";
import { allocatedRoverCharge, approachStoryDaylight, type ElysiumWorldBridge } from "../game/elysiumWorld";
import { ROVER_NOMINAL_RANGE_KM } from "../game/roverVehicle";
import { marsExpeditionHeight, marsOutpostHeight, OUTPOST_GROUND_HEIGHT } from "../game/marsExpeditionTerrain";
import { OUTPOST_SITE } from "../game/outpostSite";
import { createMarsOutpost } from "./world/createMarsOutpost";
import { createGreenhouseFarm } from "./world/createGreenhouseFarm";
import { GREENHOUSE_SCALE, GREENHOUSE_SITES } from "../game/greenhouseSites";
import { greenhousePoint } from "../game/greenhouses";
import { GARAGE_SITE } from "../game/garageSite";
import { createGarageState, garageControlsRover, garageIndoors, garagePrompt, requestGarageCycle, stepGarage } from "../game/roverGarage";
import { createRoverGarage } from "./world/createRoverGarage";
import { roverHiddenByGarage } from './world/garageVisibility';
import { ARRIVAL_SPAWN, ARRIVAL_YAW } from "../game/arrivalSpawn";
import { streamingBudget, STREAM_LIMIT, streamedHeight } from "../game/terrainStreaming";
import { PERSEVERANCE_LANDING } from '../content/marsLandingSites';
import { createPerseveranceRover, perseveranceFootprint, PERSEVERANCE_CLEARING } from './world/createPerseveranceRover';
import { nightAmount, daylightPhase, daylightAngle, helmetLightAmount } from "../game/daylightCycle";
import { safeLookDelta } from "../game/mouseLook";
import {createInteriorCamera,updateInteriorCamera,createCameraBlend,updateCameraBlend} from "../game/interiorCamera";
import { performanceReadout, type PerformanceMeterMode } from "../game/performanceMeter";
import { assetUrl } from "../lib/assetUrl";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Mesh, Object3D } from "three";
import { scanRoverLidar, type LidarScan } from "../game/roverLidar";
import { stepMarsLocomotion } from "../game/marsLocomotion";
import { spawnWalker, WALKER_RADIUS, type MoveAxes } from "../game/navigation";
import { nearbyObstacles, type CollisionObstacle } from "../game/collision";
import { createExplorationBoundaryObstacles, PLAYABLE_BOUNDS } from "../game/explorationBounds";
import { isCoarsePointerDevice } from "./mobileDevice";
import { MarsTouchDeck } from "./world/MarsTouchDeck";
import { RoverTouchDeck } from "./world/RoverTouchDeck";
import { ChevronDown, ChevronLeft, House, Power, Smartphone, Settings2 } from "lucide-react";
import RadiationPhoneHome from "./RadiationPhoneHome";
import FlightMenu from "./FlightMenu";
import { createMarsSky, createMarsFootprints } from "./world/marsTerrain";
import { loadMarsSurfaceTextures, disposeMarsSurfaceTextures } from "./world/marsSurfaceTextures";
import { createRiggedAstronaut } from "./world/createRiggedAstronaut";
import { createBigRover } from "./world/createBigRover";
import { createCuriosityRover } from "./world/createCuriosityRover";
import { spawnCuriosityRover, stepCuriosityRover, curiosityFootprint, exportCuriositySave, type CuriosityRoverState, } from "../game/curiosityRover";
import { CURIOSITY_SAVE_KEY, parseCuriositySave } from "../game/curiositySave";
import { createMarsWindDust } from "./world/marsWindDust";
import { createSoftContactShadow } from "./world/contactShadow";
import { graphicsTier, graphicsEffects } from "./world/graphicsTiers";
import {createOutpostRendering,updateOutpostRendering} from './world/outpostRendering';
import {createGraphicsSamplingGate,updateGraphicsSamplingGate} from '../game/graphicsSampling';
import {prepareWorldMaterials} from './world/prepareWorldBuffers';
import { AUTO_TARGET_FPS, browserThrottledFrame, createAutoGraphics, adaptAutoGraphics, approachRenderScale, profileName, type AutoProfile } from '../game/autoGraphics';
import { createBackgroundGraphics } from '../game/backgroundGraphics';
import { mobileGraphicsTier, mobileAutoPixelCap, createRenderPacer, renderFrameDue } from '../game/mobileGraphics';
import { createMarsEnvironment, MARS_SUN_DIRECTION } from "./world/marsAtmosphere";
import {
  spawnRoverVehicle,
  stepRoverVehicle,
  canEnterRover,
  enterRover,
  exitRover,
  roverFootprint,
  getRoverGear,
  getNearestRoverPart,
  repairRoverPart,
  INITIAL_ROVER_DAMAGE,
  type RoverAnalogInput,
  type RoverGear,
  type RoverDamageState,
  type RoverPartId,
} from "../game/roverVehicle";
import {createMarsCatchSite} from './world/createMarsCatchSite';
import {STARSHIP_RETURN_CUT,type ArrivalPlayback} from '../game/starshipArrival';
import {
  SpaceWeatherService,
  type SpaceWeatherTelemetry,
  calculateExposureDelta,
  isBaseShelter,
  getEnvironmentalShielding,
  calculateRadiationDrain,
} from "../game/spaceWeatherService";
import { GeigerAudio } from "../game/geigerAudio";
import { radiationPhoneCommand, trapRadiationPhoneTab } from './radiationPhoneControls';
import './radiationPhone.css';
function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI)
    diff -= Math.PI * 2;
  if (diff < -Math.PI)
    diff += Math.PI * 2;
  return diff;
}

function getPartDamageClass(health: number): string {
  if (health >= 70) return "nominal";
  if (health >= 30) return "warning";
  return "critical";
}
export type View = {
  phoneOpen?: boolean;
  storySite?: string | null;
  storyRevision?: number;
  storyTarget?: {id:string;label:string;x:number;z:number};
  roverBattery?: number;
  roverHealth?: number;
  garagePhase?: string;
  lightPhase?: string;
  mapRocks?: readonly {
    x: number;
    z: number;
    radius: number;
  }[];
  x: number;
  z: number;
  yaw: number;
  target: string | null;
  distance: number;
  locked: boolean;
  jumpHeight: number;
  radiationExposure?: number;
  sepFluxPFU?: number;
  isShielded?: boolean;
  roverX?: number;
  roverZ?: number;
  roverYaw?: number;
  roverDriving?: boolean;
  cockpitView?: boolean;
  roverSpeed?: number;
  roverGear?: RoverGear;
  mudDepth?: number;
  curiosityX?: number;
  curiosityZ?: number;
  curiosityYaw?: number;
  curiosityPhase?: "driving" | "scanning";
  curiosityScanStage?: "none" | "deploy" | "laser" | "stow";
  curiosityScans?: number;
  curiositySample?: string;
  lidar?: LidarScan;
};
type Props = {
  story?: ElysiumWorldBridge;
  onReady?: () => void;
  onLoadingProgress?: (progress: number, stage: string) => void;
  onGraphicsCalibration?: (status: string) => void;
  onTerrainMode?: (enabled: boolean) => void;
  enabled: boolean;
  showTouchControls: boolean;
  autoDetectTouch?: boolean;
  onInspect: (id: string) => void;
  onOpenMap?: () => void;
  onView: (view: View) => void;
  onUnavailable: () => void;
  initialQuality?: "auto" | "performance";
  onTouchControlsChange?: (active: boolean) => void;
  coveredByArrival?: boolean;
  arrivalPlayback?: ArrivalPlayback;
  onRestart?: () => void;
  menuOpen?: boolean;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
  onMainMenu?: () => void;
  onMenuFullscreen?: () => void;
};
function MarsWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  const aim = useRef<HTMLDivElement>(null);
  const debugPanel = useRef<HTMLPreElement>(null);
  const [debug] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1");
  const [performanceMeter, setPerformanceMeter] = useState<PerformanceMeterMode>(debug ? "detailed" : "off");
  current.current = props;
  const controls = useRef(new Set<string>());
  const lockAction = useRef<() => void>(() => { });
  const toggleRoverAction = useRef<() => void>(() => { });
  const inspectAction = useRef<() => void>(() => { });
  const repairAction = useRef<() => void>(() => { });
  const analogWalk = useRef<MoveAxes>({});
  const analogDrive = useRef<RoverAnalogInput>({});
  const [autoCoarse, setAutoCoarse] = useState(false);
  const touchControlsActive = props.showTouchControls || (props.autoDetectTouch !== false && autoCoarse);
  useEffect(() => {
    const syncCoarse = () => setAutoCoarse(isCoarsePointerDevice());
    syncCoarse();
    const media = window.matchMedia?.("(pointer: coarse)");
    media?.addEventListener?.("change", syncCoarse);
    return () => media?.removeEventListener?.("change", syncCoarse);
  }, []);
  useEffect(() => {
    controls.current.clear();
    analogWalk.current = {}; analogDrive.current = {};
    props.onTouchControlsChange?.(touchControlsActive);
  }, [touchControlsActive, props.onTouchControlsChange]);
  const [roverDriving, setRoverDriving] = useState(false);
  const [roverNear, setRoverNear] = useState(false);
  const [canInspect, setCanInspect] = useState(false);
  const [roverSpeed, setRoverSpeed] = useState(0);
  const [roverGear, setRoverGear] = useState<RoverGear>("N");
  const [roverBoost, setRoverBoost] = useState(false);
  const [roverBattery, setRoverBattery] = useState(100);
  const [roverSolarCharging, setRoverSolarCharging] = useState(false);
  const [roverGarageCharging, setRoverGarageCharging] = useState(false);
  const [garageDockPopup, setGarageDockPopup] = useState<{
    visible: boolean;
    chargingSource: "base-solar" | "base-inverter" | "none";
    repairActive: boolean;
  }>({
    visible: false,
    chargingSource: "none",
    repairActive: false,
  });
  const [garageDockDismissed, setGarageDockDismissed] = useState(false);
  const garageDockDismissedRef = useRef(false);
  garageDockDismissedRef.current = garageDockDismissed;
  const lastGaragePhaseRef = useRef<string>("parked");
  const [roverRangeDisplay, setRoverRangeDisplay] = useState("85.0 KM");
  const [roverMud, setRoverMud] = useState(false);
  const [roverHandbrake, setRoverHandbrake] = useState(false);
  const [roverDamage, setRoverDamage] = useState<RoverDamageState>(INITIAL_ROVER_DAMAGE);
  const [playerScrap, setPlayerScrap] = useState<number>(6);
  const playerScrapRef = useRef(6);
  playerScrapRef.current = playerScrap;
  const [repairTarget, setRepairTarget] = useState<{ id: RoverPartId; name: string; health: number } | null>(null);
  const repairTargetRef = useRef<{ id: RoverPartId; name: string; health: number } | null>(null);
  repairTargetRef.current = repairTarget;
  const [phoneOpen, setPhoneOpen] = useState(false);
  const phoneOpenRef = useRef(false);
  phoneOpenRef.current = phoneOpen;
  const phoneDialog = useRef<HTMLDialogElement>(null);
  const phoneReturnFocus = useRef<HTMLElement | null>(null);
  const releasePhoneInput = useRef<() => void>(() => {});
  const openPhone = useCallback(() => {
    if (!current.current.enabled || current.current.coveredByArrival) return;
    phoneReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    phoneOpenRef.current = true;
    controls.current.clear();
    analogWalk.current = {};
    analogDrive.current = {};
    releasePhoneInput.current();
    if (document.pointerLockElement) document.exitPointerLock();
    setActivePhoneTab("home");
    setPhoneOpen(true);
  }, []);
  const closePhone = useCallback(() => {
    phoneOpenRef.current = false;
    controls.current.clear();
    analogWalk.current = {};
    analogDrive.current = {};
    setPhoneOpen(false);
  }, []);
  const [activePhoneTab, setActivePhoneTab] = useState<"telemetry" | "home" | "systems" | "data" | "settings">("home");
  const phoneContent = useRef<HTMLDivElement>(null);
  const phoneHeading = useRef<HTMLHeadingElement>(null);
  const prevStormActive = useRef(false);
  const TouchDeck = (roverDriving ? RoverTouchDeck : MarsTouchDeck);
  const spaceWeatherService = useRef<SpaceWeatherService | null>(null);
  if (!spaceWeatherService.current) {
    spaceWeatherService.current = new SpaceWeatherService(false);
  }
  const geigerAudio = useRef<GeigerAudio | null>(null);
  if (!geigerAudio.current) {
    geigerAudio.current = new GeigerAudio();
  }
  const [spaceWeather, setSpaceWeather] = useState<SpaceWeatherTelemetry>(() =>
    spaceWeatherService.current!.update(0)
  );
  useEffect(() => {
    const service = spaceWeatherService.current!;
    void service.fetchLiveTelemetry();
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine && service.getMode() === 'live') void service.fetchLiveTelemetry();
    }, 60000);
    return () => {
      window.clearInterval(timer);
      service.dispose();
      geigerAudio.current?.dispose();
    };
  }, []);
  const [radiationExposure, setRadiationExposure] = useState(0);
  const radiationExposureRef = useRef(0);
  radiationExposureRef.current = radiationExposure;
  const [astronautHealth, setAstronautHealth] = useState(100);
  const astronautHealthRef = useRef(100);
  astronautHealthRef.current = astronautHealth;
  const [isDead, setIsDead] = useState(false);
  const isDeadRef = useRef(false);
  isDeadRef.current = isDead;
  const [isShielded, setIsShielded] = useState(false);
  const isShieldedRef = useRef(false);
  isShieldedRef.current = isShielded;
  const [geigerMuted, setGeigerMuted] = useState(false);

  // Environmental Radiation Shielding States & Notifications
  const [baseShieldPopup, setBaseShieldPopup] = useState<{ visible: boolean; fading: boolean }>({ visible: false, fading: false });
  const baseShieldTimeoutRef = useRef<number | null>(null);
  const baseShieldFadeTimeoutRef = useRef<number | null>(null);
  const prevInBaseRef = useRef<boolean>(false);

  const [roverShieldPopup, setRoverShieldPopup] = useState<{ visible: boolean; fading: boolean }>({ visible: false, fading: false });
  const [roverShieldHudActive, setRoverShieldHudActive] = useState<boolean>(false);
  const roverShieldTimeoutRef = useRef<number | null>(null);
  const roverShieldFadeTimeoutRef = useRef<number | null>(null);
  const prevInRoverRef = useRef<boolean>(false);

  const [sepAlertDismissedTime, setSepAlertDismissedTime] = useState<number>(0);

  const dismissBaseShieldPopup = useCallback(() => {
    if (baseShieldTimeoutRef.current) window.clearTimeout(baseShieldTimeoutRef.current);
    if (baseShieldFadeTimeoutRef.current) window.clearTimeout(baseShieldFadeTimeoutRef.current);
    setBaseShieldPopup({ visible: false, fading: false });
  }, []);

  const dismissRoverShieldPopup = useCallback(() => {
    if (roverShieldTimeoutRef.current) window.clearTimeout(roverShieldTimeoutRef.current);
    if (roverShieldFadeTimeoutRef.current) window.clearTimeout(roverShieldFadeTimeoutRef.current);
    setRoverShieldPopup({ visible: false, fading: false });
    setRoverShieldHudActive(true);
  }, []);

  const triggerBaseShieldPopup = useCallback(() => {
    if (baseShieldTimeoutRef.current) window.clearTimeout(baseShieldTimeoutRef.current);
    if (baseShieldFadeTimeoutRef.current) window.clearTimeout(baseShieldFadeTimeoutRef.current);
    setBaseShieldPopup({ visible: true, fading: false });
    baseShieldTimeoutRef.current = window.setTimeout(() => {
      setBaseShieldPopup((prev) => ({ ...prev, fading: true }));
      baseShieldFadeTimeoutRef.current = window.setTimeout(() => {
        setBaseShieldPopup({ visible: false, fading: false });
      }, 500);
    }, 5000);
  }, []);

  const triggerRoverShieldPopup = useCallback(() => {
    if (roverShieldTimeoutRef.current) window.clearTimeout(roverShieldTimeoutRef.current);
    if (roverShieldFadeTimeoutRef.current) window.clearTimeout(roverShieldFadeTimeoutRef.current);
    setRoverShieldHudActive(false);
    setRoverShieldPopup({ visible: true, fading: false });
    roverShieldTimeoutRef.current = window.setTimeout(() => {
      setRoverShieldPopup((prev) => ({ ...prev, fading: true }));
      setRoverShieldHudActive(true);
      roverShieldFadeTimeoutRef.current = window.setTimeout(() => {
        setRoverShieldPopup({ visible: false, fading: false });
      }, 600);
    }, 5000);
  }, []);

  const clearRoverShieldState = useCallback(() => {
    if (roverShieldTimeoutRef.current) window.clearTimeout(roverShieldTimeoutRef.current);
    if (roverShieldFadeTimeoutRef.current) window.clearTimeout(roverShieldFadeTimeoutRef.current);
    setRoverShieldPopup({ visible: false, fading: false });
    setRoverShieldHudActive(false);
  }, []);

  const triggerBaseShieldRef = useRef(triggerBaseShieldPopup);
  triggerBaseShieldRef.current = triggerBaseShieldPopup;
  const triggerRoverShieldRef = useRef(triggerRoverShieldPopup);
  triggerRoverShieldRef.current = triggerRoverShieldPopup;
  const clearRoverShieldRef = useRef(clearRoverShieldState);
  clearRoverShieldRef.current = clearRoverShieldState;

  const handleRestartWorld = useCallback(() => {
    if (props.onRestart) {
      props.onRestart();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, [props.onRestart]);

  useEffect(() => {
    if (!isDead) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRestartWorld();
      }
    };
    window.addEventListener("keydown", handleKey);
    const timer = setTimeout(() => {
      handleRestartWorld();
    }, 3800);
    return () => {
      window.removeEventListener("keydown", handleKey);
      clearTimeout(timer);
    };
  }, [isDead, handleRestartWorld]);

  const [sepInfoOpen, setSepInfoOpen] = useState(false);
  const sepDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!sepInfoOpen) return;
    const dialog = sepDialog.current;
    dialog?.showModal();
    const handleKey = (e: KeyboardEvent) => {
      if (dialog && trapRadiationPhoneTab(e, dialog)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSepInfoOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
      dialog?.close();
    };
  }, [sepInfoOpen]);

  const toggleSpaceWeatherMode = useCallback(() => {
    geigerAudio.current?.resume();
    spaceWeatherService.current?.toggleMode();
    if (spaceWeatherService.current) {
      setSpaceWeather(spaceWeatherService.current.update(0));
    }
  }, []);

  const selectHistoricalEvent = useCallback((index: number) => {
    const service = spaceWeatherService.current!;
    service.setMode('historical');
    service.selectHistoricalEvent(index);
    setSpaceWeather(service.update(0));
  }, []);

  const handleToggleGeigerMute = useCallback(() => {
    geigerAudio.current?.resume();
    if (geigerAudio.current) {
      const nextMuted = geigerAudio.current.toggleMute();
      setGeigerMuted(nextMuted);
    }
  }, []);


  const toggleSpaceWeatherAction = useRef(toggleSpaceWeatherMode);
  toggleSpaceWeatherAction.current = toggleSpaceWeatherMode;

  useEffect(() => {
    const dialog = phoneDialog.current;
    const worldElement = host.current;
    if (!phoneOpen || !props.enabled) {
      if (dialog?.open) dialog.close();
      return;
    }
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[aria-label="Minimize phone"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const otherDialog = target?.closest('dialog, [role="dialog"]') !== dialog;
      if (!otherDialog && trapRadiationPhoneTab(event, dialog)) return;
      const command = radiationPhoneCommand(event.key, {
        open: true, enabled: current.current.enabled, repeat: event.repeat,
        modified: event.altKey || event.ctrlKey || event.metaKey,
        editable: Boolean(target?.matches('input, textarea, select') || target?.isContentEditable),
        interactive: Boolean(target?.closest('button, a, summary')),
        otherDialog,
      });
      if (!command) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (command === 'close') closePhone();
      if (command === 'toggle-feed') toggleSpaceWeatherAction.current();
      if (command === 'next-tab' || command === 'previous-tab') {
        const tabs = ['home', 'telemetry', 'systems', 'data', 'settings'] as const;
        setActivePhoneTab(tab => tabs[(tabs.indexOf(tab) + (command === 'next-tab' ? 1 : 4)) % tabs.length]);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      dialog.close();
      if (current.current.enabled) {
        const previous = phoneReturnFocus.current;
        (previous?.isConnected ? previous : worldElement)?.focus({ preventScroll: true });
      }
    };
  }, [phoneOpen, props.enabled, closePhone]);
  useEffect(() => {
    if (!phoneOpen) return;
    const frame = requestAnimationFrame(() => {
      phoneContent.current?.scrollTo({ top: 0 });
      phoneHeading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePhoneTab, phoneOpen]);
  const [loadingStage, setLoadingStage] = useState("Loading explorers and rovers…");
  const [loadingProgress, setLoadingProgress] = useState(10);
  useEffect(() => { current.current.onLoadingProgress?.(loadingProgress, loadingStage); }, [loadingProgress, loadingStage]);
  const [loaded, setLoaded] = useState(false);
  const [cursorFree, setCursorFree] = useState(false);
  const [message, setMessage] = useState("");
  const [outpostPrompt, setOutpostPrompt] = useState("");
  const [outpostPromptDisabled, setOutpostPromptDisabled] = useState(false);
  const [thirdPerson, setThirdPerson] = useState(true);
  const [sensitivity, setSensitivity] = useState(1);
  const [quality, setQuality] = useState<string>(props.initialQuality ?? "auto");
  const [autoLabel, setAutoLabel] = useState("Detecting");
  const [autoReport, setAutoReport] = useState('');
  const cursorReleased = useRef(false);
  const cameraSettings = useRef({ thirdPerson, sensitivity, quality, touchControlsActive, performanceMeter });
  cameraSettings.current = { thirdPerson, sensitivity, quality, touchControlsActive, performanceMeter };
  useEffect(() => {
    cursorReleased.current = false;
    setCursorFree(false);
    if (props.enabled)
      host.current?.focus({ preventScroll: true });
    else {
      controls.current.clear();
      analogWalk.current = {};
      analogDrive.current = {};
      if (document.pointerLockElement === host.current)
        document.exitPointerLock();
    }
  }, [props.enabled]);
  useEffect(() => {
    let cancelled = false;
    let dispose = () => { };
    const backgroundTimer = 0;
    async function mount() {
      const loadStarted = performance.now();
      const [T, { createMarsWorld }] = await Promise.all([
        import("three"),
        import("./world/createMarsWorld"),
      ]);
      if (cancelled || !host.current)
        return;
      setLoadingStage("Preparing Mars terrain…");
      setLoadingProgress(35);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (cancelled || !host.current)
        return;
      const element = host.current;
      const mobileMars = cameraSettings.current.touchControlsActive;
      const tierFor = (name: string) => mobileMars ? mobileGraphicsTier(name, cameraSettings.current.quality === 'auto') : graphicsTier(name);
      const wantsEffects = () => !mobileMars || effectiveQuality() === "ultra";
      const lightRendering = () => effectiveQuality() === "performance" || (mobileMars && cameraSettings.current.quality === "auto");
      // Bound mobile fill cost; ordinary frame samples choose optional detail.
      const displayRatio = Math.max(.55, Math.min(devicePixelRatio, mobileMars ? 1.5 : 2));
      const renderer = new T.WebGLRenderer({
        antialias: !mobileMars && props.initialQuality !== "performance",
        powerPreference: "high-performance",
      });
      const gl = renderer.getContext();
      const gpuInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const gpuName = gpuInfo ? String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)) : "";
      // The background probe's first candidate is Performance. Starting at a
      // different tier makes every sample ineligible and leaves Auto stalled.
      let autoProfile: AutoProfile = 'performance';
      const terrainBudget = streamingBudget(gpuName, navigator.hardwareConcurrency, (navigator as Navigator & {
        deviceMemory?: number;
      }).deviceMemory, mobileMars, props.initialQuality ?? "auto");
      const autoPixelCap = mobileMars ? mobileAutoPixelCap(navigator.hardwareConcurrency, (navigator as Navigator & {deviceMemory?: number}).deviceMemory, gpuName, Boolean((navigator as Navigator & {connection?: {saveData?: boolean}}).connection?.saveData)) : displayRatio;
      const qualityCap = (name: string) => Math.min(displayRatio, tierFor(name).resolutionCap, cameraSettings.current.quality === 'auto' ? autoPixelCap : displayRatio);
      const effectiveQuality = () => cameraSettings.current.quality === "auto" ? autoProfile : cameraSettings.current.quality;
      const profileLabel = () => profileName(autoProfile);
      setAutoLabel(profileLabel());
      const initialPreset = tierFor(effectiveQuality());
      renderer.setPixelRatio(qualityCap(effectiveQuality()));
      renderer.shadowMap.enabled = initialPreset.shadows;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.info.autoReset = false;
      renderer.domElement.setAttribute("aria-hidden", "true");
      element.insertBefore(renderer.domElement, element.firstChild);
      const scene = new T.Scene();
      // Start model and texture downloads together, before terrain construction.
      const bigRover = createBigRover();
      const curiosityRover = createCuriosityRover();
      const perseverance = createPerseveranceRover((x, z) => streamedHeight(x, z, marsExpeditionHeight));
      const marsAstronaut = createRiggedAstronaut(assetUrl("/models/astronaut.glb"));
      const surfacePromise = loadMarsSurfaceTextures();
      if (bigRover)
        scene.add(bigRover.root, bigRover.dust);
      if (curiosityRover)
        scene.add(curiosityRover.root);
      if (perseverance)
        scene.add(perseverance.root);
      // Covers leaving the world while imports/downloads are still pending.
      dispose = () => {
        bigRover?.dispose();
        curiosityRover?.dispose();
        perseverance?.dispose();
        marsAstronaut?.dispose();
        void surfacePromise.then(disposeMarsSurfaceTextures);
        renderer.dispose();
        renderer.domElement.remove();
        environment?.dispose();
      };
      let environment: import("three").WebGLRenderTarget | null = null;
      {
        environment = createMarsEnvironment(renderer);
        scene.environment = environment.texture;
        scene.environmentIntensity = .85;
      }
      scene.background = new T.Color(0xe3b6a1);
      scene.fog = new T.FogExp2(0xb3866b, 0.0022);
      const camera = new T.PerspectiveCamera(58, 1, 0.08, 1100);
      camera.rotation.order = "YXZ";
      const light = new T.DirectionalLight(0xffe5c7, 3.5);
      light.position.set(-55, 28, -80);
      light.castShadow = true;
      const shadowSize = tierFor(effectiveQuality()).shadowSize;
      light.shadow.mapSize.set(shadowSize, shadowSize);
      Object.assign(light.shadow.camera, {
        left: -34,
        right: 34,
        top: 34,
        bottom: -34,
        near: 1,
        far: 220,
      });
      light.shadow.bias = -0.00015;
      light.shadow.normalBias = 0.022;
      scene.add(light);
      scene.add(light.target);
      const ambient = new T.HemisphereLight(0xbccfe1, 0x55504c, 1.65);
      scene.add(ambient);
      const regolithSurface = await surfacePromise;
      if (cancelled) {
        bigRover?.dispose();
        curiosityRover?.dispose();
        perseverance?.dispose();
        marsAstronaut?.dispose();
        disposeMarsSurfaceTextures(regolithSurface);
        renderer.dispose();
        renderer.domElement.remove();
        environment?.dispose();
        return;
      }
      // The temporary lightweight calibration start must not permanently shrink a desktop's track atlas.
      const model = createMarsWorld(scene, regolithSurface, mobileMars || props.initialQuality === 'performance');
      if (perseverance) {
        model.targets.push(perseverance.root);
        model.obstacles.push(perseveranceFootprint());
      }
      let streaming: ReturnType<typeof createStreamedMars> | null = null;
      let storyMarkers: ReturnType<typeof import('./world/elysiumMarkers').createElysiumMarkers> | null = null;
      let storySites: typeof import('../game/elysiumSites').ELYSIUM_SITES = [];
      let storyRevision = -1;
      let storySession = '';
      let storyWasNight = false, storyDawn = false;
      let endingElapsed = 0, endingFinished = false;
      const endingAt = new T.Vector3(-10,0,-65);
      const endingWindow = new T.Vector3(-39,3,-34), endingAbove = new T.Vector3(-88,70,55);
      const regionalLandscape = createMarsRegionalLandscape(model.root);
      let detailCulling: ReturnType<typeof createDetailDistanceCulling> | null = null;
      const previousSceneRender = scene.onBeforeRender;
      let viewFrame = 0, culledFrame = -1;
      const streamOptions = { worldLimit: STREAM_LIMIT };
      const baseHeight = model.heightAt;
      const baseRoverHeight = model.roverHeightAt;
      setLoadingStage("Preparing the outpost, garage and greenhouses…");
      const outpost = createMarsOutpost(scene, OUTPOST_GROUND_HEIGHT, model.obstacles);
      const catchSite = createMarsCatchSite(scene,model.obstacles,mobileMars||props.initialQuality==='performance');
      const greenhouses = createGreenhouseFarm(scene, model.obstacles);
      const garageState = createGarageState();
      const garage = createRoverGarage(scene, garageState, OUTPOST_GROUND_HEIGHT, model.obstacles);
      const disposeBeforeOutpost = dispose;
      let preparationDisposed = false;
      dispose = () => {
        if (preparationDisposed) return;
        preparationDisposed = true;
        storyMarkers?.dispose();
        catchSite.dispose();outpost.dispose(); greenhouses.dispose(); garage.dispose(); model.disposeTracks?.();
        model.root.traverse(object => {
          if (object instanceof T.Mesh) {
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
          }
          if (object instanceof T.InstancedMesh) object.dispose();
        });
        model.root.removeFromParent(); light.shadow.dispose(); disposeBeforeOutpost();
      };
      try { await Promise.all([outpost.ready, greenhouses.ready, garage.ready, catchSite.ready]); }
      catch (error) { dispose(); throw error; }
      if (cancelled) return;
      element.dataset.outpostLoaded = "true";
      element.dataset.rocketModel = catchSite.modelStatus;
      element.dataset.greenhouses = String(GREENHOUSE_SITES.length);
      element.dataset.garageLoaded = String(garage.loaded);
      element.dataset.drivableRovers = String(scene.children.filter(object => object.name === "BigRover").length);
      // Stable callbacks also keep footprints and suspension aligned after streaming activates.
      model.heightAt = (x, z) => garage.floorAt(x, z, greenhouses.floorAt(x, z, outpost.floorAt(x, z, streaming ? streaming.heightAt(x, z) : baseHeight(x, z))));
      model.roverHeightAt = (x, z) => garage.floorAt(x, z, greenhouses.floorAt(x, z, outpost.floorAt(x, z, streaming && (Math.abs(x) > 210 || Math.abs(z) > 210) ? streaming.roverHeightAt(x, z) : baseRoverHeight(x, z))));
      if (current.current.story) {
        const [{createElysiumMarkers},{ELYSIUM_SITES}] = await Promise.all([import('./world/elysiumMarkers'),import('../game/elysiumSites')]);
        if (cancelled) return;
        storySites = ELYSIUM_SITES;
        storyMarkers = createElysiumMarkers(scene, model.heightAt);
      }
      const smallRocks = model.root.getObjectByName("mars-small-rocks") as import("three").InstancedMesh | undefined;
      const previewParams = new URLSearchParams(window.location.search);
      const previewPerseverance = debug && true && previewParams.get('sitePreview') === 'perseverance';
      const previewOutpostLights = debug && previewParams.get('sitePreview') === 'outpost-lights';
      const airlockCheckpoints: Record<string, {x:number;z:number;yaw:number}> = {
        west:{x:-8.645,z:-65,yaw:Math.PI/2}, east:{x:8.885,z:-65,yaw:-Math.PI/2},
        north:{x:0,z:-73.275,yaw:0}, botany:{x:-11,z:-80.895,yaw:0},
        observatory:{x:12,z:-81.17,yaw:0}, 'observatory-room':{x:12,z:-83.8,yaw:Math.PI},
      };
      const previewAirlock = debug && previewParams.get('sitePreview') === 'airlock'
        ? airlockCheckpoints[previewParams.get('airlock') ?? 'observatory'] : undefined;
      const previewOutpost = debug && (previewParams.get('sitePreview') === 'outpost' || previewOutpostLights || Boolean(previewAirlock));
      const previewGreenhouse = debug && previewParams.get('sitePreview') === 'greenhouse';
      const previewBoundary = debug && previewParams.get('sitePreview') === 'boundary';
      const previewGarage = debug && previewParams.get('sitePreview') === 'garage';
      // Helmet light follows the astronaut during the day/night cycle
      const helmetLamp = new T.SpotLight(0xdbeafe, 0, 32, 0.58, 0.55, 1.3);
      const helmetTarget = helmetLamp ? new T.Object3D() : null;
      if (helmetLamp && helmetTarget) {
        helmetLamp.castShadow = initialPreset.shadows;
        helmetLamp.shadow.mapSize.set(512, 512);
        helmetLamp.shadow.bias = -0.0006;
        helmetLamp.target = helmetTarget;
        scene.add(helmetLamp, helmetTarget);
      }
      setLoadingStage("Preparing explorers and equipment…");
      setLoadingProgress(70);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      const footprints = createMarsFootprints(scene, model.heightAt);
      const marsSky = createMarsSky(scene);
      const skyMesh = scene.getObjectByName("mars-sky");
      const windDust = createMarsWindDust();
      const dust = windDust?.points ?? null;
      if (dust)
        scene.add(dust);
      const astronaut = new T.Group();
      const astronautShadow = createSoftContactShadow({ width: 1.15, depth: 1.15, y: 0.024, opacity: 0.46 });
      if (astronautShadow)
        scene.add(astronautShadow.mesh);
      const suit = new T.MeshStandardMaterial({
        color: 0xe7e2d5,
        roughness: 0.7,
      });
      const visor = new T.MeshStandardMaterial({
        color: 0x263e50,
        metalness: 0.7,
        roughness: 0.25,
      });
      const part = (geometry: import("three").BufferGeometry, material: import("three").Material, x: number, y: number, z: number) => {
        const m = new T.Mesh(geometry, material);
        m.position.set(x, y, z);
        m.castShadow = true;
        astronaut.add(m);
        return m;
      };
      part(new T.CapsuleGeometry(0.34, 0.25, 6, 16), suit, 0, 1.12, 0).scale.z = 0.68;
      part(new T.BoxGeometry(0.62, 0.7, 0.22), suit, 0, 1.12, 0.28);
      const accent = new T.MeshStandardMaterial({
        color: 0xdb8a47,
        roughness: 0.6,
      });
      const trim = new T.MeshStandardMaterial({
        color: 0x566b72,
        roughness: 0.6,
      });
      part(new T.BoxGeometry(0.66, 0.08, 0.42), accent, 0, 1.36, 0.02);
      part(new T.BoxGeometry(0.48, 0.25, 0.04), trim, 0, 1.12, -0.21);
      part(new T.BoxGeometry(0.18, 0.06, 0.05), accent, -0.1, 1.16, -0.24);
      part(new T.BoxGeometry(0.15, 0.06, 0.05), visor, 0.12, 1.16, -0.24);
      part(new T.BoxGeometry(0.54, 0.1, 0.25), accent, 0, 1.43, 0.29);
      part(new T.BoxGeometry(0.08, 0.45, 0.08), trim, 0.23, 1.66, 0.31);
      part(new T.SphereGeometry(0.34, 20, 14), suit, 0, 1.78, 0);
      part(new T.SphereGeometry(0.27, 20, 14), visor, 0, 1.79, -0.16).scale.set(1, 0.75, 0.5);
      const leftLeg = part(new T.CapsuleGeometry(0.125, 0.4, 6, 12), suit, -0.2, 0.35, 0);
      const rightLeg = part(new T.CapsuleGeometry(0.125, 0.4, 6, 12), suit, 0.2, 0.35, 0);
      const leftArm = part(new T.CapsuleGeometry(0.11, 0.46, 6, 12), suit, -0.5, 1.1, 0);
      const rightArm = part(new T.CapsuleGeometry(0.11, 0.46, 6, 12), suit, 0.5, 1.1, 0);
      part(new T.BoxGeometry(0.3, 0.12, 0.43), trim, -0.2, 0.08, -0.06);
      part(new T.BoxGeometry(0.3, 0.12, 0.43), trim, 0.2, 0.08, -0.06);
      part(new T.BoxGeometry(0.24, 0.1, 0.26), accent, -0.5, 1.23, 0);
      part(new T.BoxGeometry(0.24, 0.1, 0.26), accent, 0.5, 1.23, 0);
      scene.add(astronaut);
      if (marsAstronaut) {
        astronaut.clear();
        astronaut.add(marsAstronaut.root);
      }
      const sun = new T.Mesh(new T.SphereGeometry(4, 24, 16), new T.MeshBasicMaterial({ color: new T.Color(7, 5, 2.8), fog: false, toneMapped: true }));
      sun.position.set(-80, 46, -160);
      sun.position.copy(MARS_SUN_DIRECTION).multiplyScalar(185);
      scene.add(sun);
      const earth = new T.Mesh(new T.SphereGeometry(5, 28, 20), new T.MeshStandardMaterial({ color: 0x5b9fba, roughness: 1 }));
      earth.position.set(65, 40, -170);
      {
        earth.scale.setScalar(.16);
        (earth.material as import("three").MeshStandardMaterial).emissive.setHex(0x286c9a);
      }
      scene.add(earth);
      const stars = new Float32Array(600 * 3);
      for (let i = 0; i < 600; i++) {
        const a = i * 2.399;
        const r = 180 + (i % 19) * 4;
        stars[i * 3] = Math.sin(a) * r;
        stars[i * 3 + 1] = 25 + (i % 33) * 5;
        stars[i * 3 + 2] = Math.cos(a) * r;
      }
      const sg = new T.BufferGeometry();
      sg.setAttribute("position", new T.BufferAttribute(stars, 3));
      const starField = new T.Points(sg, new T.PointsMaterial({ size: 0.3, color: 0xdbe7ed }));
      scene.add(starField);
      let daylightElapsed = 0;
      const daySky = new T.Color(0xe3b6a1);
      const nightSky = new T.Color(0x111824);
      const dayFog = new T.Color(0xb3866b);
      const nightFog = new T.Color(0x232638);
      const dayAmbient = new T.Color(0xc5ccd5);
      const nightAmbient = new T.Color(0x7f9dca);
      const dayGround = new T.Color(0x77543e);
      const nightGround = new T.Color(0x312a36);
      const dayLight = new T.Color(0xffe5c7);
      const nightLight = new T.Color(0x9ab4dc);
      const sunsetLight = new T.Color(0xf2b18a);
      const sunDirection = MARS_SUN_DIRECTION.clone();
      {
        sun.material.transparent = true;
        sun.material.depthWrite = false;
        earth.material.transparent = true;
        earth.material.depthWrite = false;
        starField.material.transparent = true;
        starField.material.depthWrite = false;
        // Celestial bodies sit behind real ridges, without changing angular size.
        for (const material of [sun.material, earth.material, starField.material]) {
          material.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
              '#include <project_vertex>\ngl_Position.z = gl_Position.w * (1.0 - 0.0000001);');
          };
          material.customProgramCacheKey = () => 'mars-celestial-depth-v1';
        }
      }
      let composer: import("three/examples/jsm/postprocessing/EffectComposer.js").EffectComposer | null = null;
      let occlusion: import("./world/BoundedGTAOPass").BoundedGTAOPass | null = null;
      let bloom: import("three/examples/jsm/postprocessing/UnrealBloomPass.js").UnrealBloomPass | null = null;
      let fxaaPass: import("three/examples/jsm/postprocessing/ShaderPass.js").ShaderPass | null = null;
      let effectsLoading: Promise<void> | null = null;
      const outpostRendering = createOutpostRendering();
      const graphicsSampling = createGraphicsSamplingGate();
      const effectsSupported = Boolean(gl.getExtension('EXT_color_buffer_float'));
      const desiredCamera = new T.Vector3();
      const orbitCamera = new T.Vector3(), eyeCamera = new T.Vector3();
      const eyeRotation = new T.Quaternion(), eyeAngles = new T.Euler(0,0,0,"YXZ");
      const interiorCamera = createInteriorCamera();
      const viewBlend = createCameraBlend(cameraSettings.current.thirdPerson);
      let orbitInitialized = false;
      let lastLidarScan = -Infinity;
      let lidar: LidarScan | undefined;
      function disposeEffects() {
        if (composer) {
          for (const pass of composer.passes)
            pass.dispose();
          composer.dispose();
        }
        composer = null;
        occlusion = null;
        bloom = null;
        fxaaPass = null;
      }
      function renderEffects() {
        if (!composer || (!outpostRendering.active && !occlusion?.enabled && !bloom?.enabled))
          return false;
        try {
          // Ultra keeps its room effects; other tiers retain output/FXAA only.
          composer.render();
          return true;
        }
        catch {
          // Optional effects must not prevent exploration on unsupported GPUs.
          scene.overrideMaterial = null;
          renderer.setRenderTarget(null);
          disposeEffects();
          return false;
        }
      }
      const prepareEffects = () => effectsLoading ??= (async () => {
        const [{ EffectComposer }, { RenderPass }, { BoundedBloomPass }, { OutputPass }, { BoundedGTAOPass }, { ResolutionFXAAPass }] = await Promise.all([
          import("three/examples/jsm/postprocessing/EffectComposer.js"),
          import("three/examples/jsm/postprocessing/RenderPass.js"),
          import("./world/BoundedBloomPass"),
          import("three/examples/jsm/postprocessing/OutputPass.js"),
          import("./world/BoundedGTAOPass"),
          import("./world/ResolutionFXAAPass"),
        ]);
        if (cancelled)
          return;
        if (mobileMars && !wantsEffects()) { effectsLoading = null; return; }
        // HDR resolves with HalfFloatType
        const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 0 });
        // Ultra's contact shading reuses the scene depth instead of drawing
        // the detailed world again. The composer clones this attachment.
        target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
        composer = new EffectComposer(renderer, target);
        composer.addPass(new RenderPass(scene, camera));
        occlusion = new BoundedGTAOPass(scene, camera, 256, 256);
        occlusion.setDetailDistance(tierFor(effectiveQuality()).viewDistance);
        occlusion.updateGtaoMaterial({ radius: .52, thickness: .55, distanceFallOff: 1.2, samples: 10 });
        occlusion.updatePdMaterial({ samples: 8, radius: 4, rings: 2 });
        occlusion.blendIntensity = .52;
        occlusion.enabled = false;
        composer.addPass(occlusion);
        bloom = new BoundedBloomPass(new T.Vector2(512, 512), .28, .55, .88);
        composer.addPass(bloom);
        // Detect edges after tone mapping, using display-space contrast.
        composer.addPass(new OutputPass());
        fxaaPass = new ResolutionFXAAPass();
        composer.addPass(fxaaPass);
      })().catch(() => { disposeEffects(); });
      function configureEffects(render = false) {
        const effects = graphicsEffects(effectiveQuality(),outpostRendering.active,reduced.matches);
        outpost.setUltraLighting(effects.roomHighlights);
        if (occlusion) {
          occlusion.enabled = wantsEffects() && effects.occlusion;
          occlusion.setReuseSceneDepth(effects.reuseSceneDepth);
          occlusion.setDetailDistance(tierFor(effectiveQuality()).viewDistance);
        }
        if (bloom)
          bloom.enabled = wantsEffects() && effects.bloom;
        if (render && effectiveQuality() !== "performance")
          renderEffects();
      }
      if (effectsSupported && wantsEffects() && effectiveQuality() !== "performance")
        await prepareEffects();
      const keys = controls.current;
      const ray = new T.Raycaster();
      const spawnAtArrival = () => {
        if (previewPerseverance) return {...spawnWalker(), x: PERSEVERANCE_LANDING.x+2, z: PERSEVERANCE_LANDING.z+4};
        if (previewAirlock) return {...spawnWalker(), x:previewAirlock.x, z:previewAirlock.z};
        if (previewOutpostLights) return {...spawnWalker(), x:OUTPOST_SITE.x-9.5, z:OUTPOST_SITE.z+3};
        if (previewOutpost) return {...spawnWalker(), x: OUTPOST_SITE.x, z: OUTPOST_SITE.z+15};
        if (previewBoundary) return {...spawnWalker(), x:PLAYABLE_BOUNDS.east-8, z:0};
        if (previewGreenhouse) return {...spawnWalker(), ...greenhousePoint(GREENHOUSE_SITES[0],0,10/GREENHOUSE_SCALE)};
        if (previewGarage) return {...spawnWalker(), x:GARAGE_SITE.x-5.5, z:GARAGE_SITE.z+11};
        return {...spawnWalker(), ...ARRIVAL_SPAWN};
      };
      let walker = spawnAtArrival();
      let jump = { height: 0, velocity: 0 };
      let rover = spawnRoverVehicle(GARAGE_SITE.x, GARAGE_SITE.z+GARAGE_SITE.parkedZ, Math.PI, model.roverHeightAt);
      let savedCuriosity = null;
      if (curiosityRover) {
        try {
          savedCuriosity = parseCuriositySave(window.localStorage.getItem(CURIOSITY_SAVE_KEY));
        }
        catch {
          savedCuriosity = null;
        }
      }
      const curiositySeed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
      const curiosityInitialObstacles = [
        ...model.obstacles,
        ...(bigRover ? [roverFootprint(rover.x, rover.z, rover.yaw)] : []),
        { x: walker.x, z: walker.z, radius: WALKER_RADIUS, id: "walker" },
      ];
      let curiosity: CuriosityRoverState | null = curiosityRover
        ? spawnCuriosityRover(curiosityInitialObstacles, model.roverHeightAt, {
          seed: curiositySeed,
          allowColonyTargets: false,
          saved: savedCuriosity,
        })
        : null;
      let lastRoverNear = false;
      let wasCockpit = false;
      let lastRoverSpeed = 0;
      let cameraYaw = previewAirlock ? previewAirlock.yaw : previewBoundary ? -Math.PI/2 : previewGarage ? -.55 : previewGreenhouse ? GREENHOUSE_SITES[0].yaw : !previewPerseverance && !previewOutpost ? ARRIVAL_YAW : 0;
      let characterYaw = cameraYaw;
      let lastRoverGear: RoverGear = "N";
      let lastRoverBoost = false;
      let lastRoverBattery = 100;
      let lastRoverSolarCharging = false;
      let lastRoverGarageCharging = false;
      let lastGaragePopupVisible = false;
      let lastGaragePopupSource = "none";
      let lastGaragePopupRepair = false;
      let garageDockEnteredAt = 0;
      let lastRoverRange = "85.0 KM";
      let lastRoverMud = false;
      let lastRoverHandbrake = false;
      let lastRoverDamage: RoverDamageState = { ...INITIAL_ROVER_DAMAGE };
      let lastRepairTarget: { id: RoverPartId; name: string; health: number } | null = null;
      let pitch = -0.04;
      let dragging = false;
      let lookPointer: number | null = null;
      let px = 0;
      let py = 0;
      let frame = 0;
      const renderPacer = createRenderPacer();
      let last = 0;
      let lastReport = 0;
      let hover: string | null = null;
      let range = Infinity;
      let firstFrame = true;
      let captureUnsupported = false;
      let captureFailureCount = 0;
      let lockInFlight = false;
      let lastLockReleaseAt = 0;
      let lastMouseMoveTime = 0;
      toggleRoverAction.current = () => {
        if (!current.current.enabled || phoneOpenRef.current)
          return;
        if (garageControlsRover(garageState)) return;
        if (!rover.driving && current.current.story?.command.roverAllowed === false) {
          setMessage('Mission Notes: choose a route and finish its charging plan at the garage terminal.');
          return;
        }
        if (!rover.driving) {
          if (canEnterRover(walker, rover)) {
            rover = enterRover(rover);
            // Boarding takes over from any pending building-camera restoration.
            interiorCamera.inside = false;
            interiorCamera.outsideSeconds = 0;
            cameraSettings.current.thirdPerson = false;
            setThirdPerson(false);
            keys.clear();
            setRoverDriving(true);
            setRoverNear(false);
            cameraYaw = rover.yaw;
            characterYaw = rover.yaw;
            lastMouseMoveTime = performance.now();
          }
        }
        else {
          const exitObstacles = curiosity
            ? [...model.obstacles, curiosityFootprint(curiosity.x, curiosity.z, curiosity.yaw)]
            : model.obstacles;
          const { rover: nextRover, exitPosition } = exitRover(rover, exitObstacles, streaming ? STREAM_LIMIT : undefined);
          if (!exitPosition) {
            setMessage("There isn't room to exit here. Move the rover to an open area.");
            return;
          }
          rover = nextRover;
          walker.x = exitPosition.x;
          walker.z = exitPosition.z;
          walker.yaw = cameraYaw;
          cameraYaw = rover.yaw;
          characterYaw = rover.yaw;
          walker.vx = 0;
          walker.vz = 0;
          keys.clear();
          setRoverDriving(false);
        }
      };
      let lastQuality = "";
      let lastSelection = cameraSettings.current.quality;
      let metricStart = 0;
      let metricFrames = 0;
      let autoState = createAutoGraphics(autoProfile, qualityCap(autoProfile));
      const backgroundProbe = cameraSettings.current.quality === 'auto'
        ? createBackgroundGraphics(Math.min(displayRatio, autoPixelCap), name => tierFor(name).resolutionCap, {mobile: mobileMars}) : null;
      let backgroundPrepared = !backgroundProbe;
      let backgroundStarted = 0;
      let lastResolutionChange = 0;
      let metricActive = false;
      let lastMapReport = 0;
      let mapRocks: {
        x: number;
        z: number;
        radius: number;
      }[] = [];
      let lastAimCheck = 0;
      let lastCanInspect = false;
      let lastOutpostPrompt = "";
      let resolutionScale = Math.min(devicePixelRatio, 1.25);
      let gaitPhase = 0;
      let gaitBlend = 0;
      let cameraGround = model.heightAt(walker.x, walker.z);
      const center = new T.Vector2(0, 0);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const resize = () => {
        camera.aspect = element.clientWidth / element.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(element.clientWidth, element.clientHeight);
        if (composer) {
          composer.setPixelRatio(renderer.getPixelRatio());
          composer.setSize(element.clientWidth, element.clientHeight);
        }
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      function applyQuality(name: string, scale: number) {
        lastQuality = name;
        const tier = tierFor(name);
        if (mobileMars && !wantsEffects() && composer) { disposeEffects(); effectsLoading = null; }
        garage.setPerformance(lightRendering());
        model.setLightSurfaces?.(lightRendering());
        {
          // Only the low-detail regional surface uses the full horizon range.
          // Equipment and detailed terrain retain the tier's nearer draw budget.
          camera.far = MARS_HORIZON_DISTANCE;
          camera.updateProjectionMatrix();
          skyMesh?.scale.setScalar(1);
          streaming?.setPerformance(name === 'performance');
        }
        resolutionScale = scale;
        renderer.setPixelRatio(scale);
        renderer.shadowMap.enabled = tier.shadows;
        helmetLamp.castShadow = tier.shadows;
        if (light.shadow.mapSize.x !== tier.shadowSize) {
          light.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
          light.shadow.map?.dispose();
          light.shadow.map = null;
        }
        if (bigRover) {
          bigRover.headlightL.castShadow = false;
          bigRover.headlightR.castShadow = false;
        }
        if (smallRocks)
          smallRocks.count = tier.smallRocks;
        if (dust)
          dust.geometry.setDrawRange(0, tier.particles);
        configureEffects();
        resize();
      }
      const inspect = () => {
        if (phoneOpenRef.current) return;
        const garageAction = garagePrompt(garageState, walker.x, walker.z, rover);
        if (current.current.enabled && garageAction?.enabled && requestGarageCycle(garageState, rover)) {
          keys.clear();
          return;
        }
        if (current.current.enabled && !rover.driving && greenhouses.interact(walker.x, model.heightAt(walker.x, walker.z) + jump.height, walker.z, cameraYaw)) return;
        if (current.current.enabled && !rover.driving && outpost.interact(walker.x, model.heightAt(walker.x, walker.z) + jump.height, walker.z, cameraYaw)) return;
        const station = storyMarkers?.nearest(walker.x, walker.z);
        if (current.current.enabled && station && Math.abs(rover.speed) < .5) {
          keys.clear(); current.current.story?.onInteract(station.id); return;
        }
        if (current.current.enabled && !rover.driving && hover && range <= 5.5)
          current.current.onInspect(hover);
      };
      inspectAction.current = inspect;
      let discardCapturedMove = false;
      let wasCaptured = document.pointerLockElement === element;
      let releaseMsgTimer: number | null = null;
      const UI_CONTROL_SELECTOR = "button, input, select, summary, details, a, dialog, [role='dialog'], .flight-pad, .sv-look-controls, .sv-rover-hud, .sv-rover-prompt";
      const isUiControlTarget = (el: HTMLElement | null) => Boolean(el?.closest?.(UI_CONTROL_SELECTOR));
      const isSceneTarget = (el: HTMLElement | null) => el !== null && !isUiControlTarget(el) && (el === renderer.domElement || element.contains(el));
      const clearNoticeTimer = () => {
        if (releaseMsgTimer !== null) {
          window.clearTimeout(releaseMsgTimer);
          releaseMsgTimer = null;
        }
      };
      const showTransientNotice = (text: string, prefix: string, ms = 2600) => {
        clearNoticeTimer();
        setMessage(text);
        releaseMsgTimer = window.setTimeout(() => {
          setMessage((prev) => (prev.startsWith(prefix) ? "" : prev));
          releaseMsgTimer = null;
        }, ms);
      };
      repairAction.current = () => {
        if (!current.current.enabled || phoneOpenRef.current || rover.driving) return;
        const target = getNearestRoverPart(walker, rover);
        if (target && target.distance <= 2.8 && target.health < 100) {
          if (playerScrapRef.current > 0) {
            rover = repairRoverPart(rover, target.id);
            setPlayerScrap((s) => Math.max(0, s - 1));
            lastRoverDamage = { ...(rover.damage ?? INITIAL_ROVER_DAMAGE) };
            setRoverDamage({ ...(rover.damage ?? INITIAL_ROVER_DAMAGE) });
            showTransientNotice(`Field repaired ${target.name} to 100% nominal!`, "Field repaired");
          } else {
            showTransientNotice("Insufficient Titanium Scrap for field repairs!", "Insufficient");
          }
        }
      };
      const setCursorMode = (free: boolean, notify = false) => {
        cursorReleased.current = free;
        setCursorFree(free);
        clearNoticeTimer();
        if (free) {
          // Exiting via Esc or releasing cursor resets prior capture blocks so the next scene click retries.
          captureFailureCount = 0;
          if (notify) {
            showTransientNotice("Cursor free for UI — click the 3D view to resume mouse look.", "Cursor free for UI");
          }
        }
        else {
          setMessage((prev) => prev.startsWith("Cursor free for UI") || prev.startsWith("Click the 3D view once more")
            ? ""
            : prev);
        }
      };
      const requestLockCapture = (options?: {
        silent?: boolean;
        forceRetry?: boolean;
      }) => {
        if (phoneOpenRef.current) return;
        element.focus({ preventScroll: true });
        if (document.pointerLockElement === element || captureUnsupported)
          return;
        if (options?.forceRetry)
          captureFailureCount = 0;
        if (lockInFlight)
          return;
        if (!element.requestPointerLock) {
          captureUnsupported = true;
          if (!options?.silent) {
            showTransientNotice("Drag the view to look around. WASD still works.", "Drag the view");
          }
          return;
        }
        lockInFlight = true;
        const onLockRejected = (err?: unknown) => {
          lockInFlight = false;
          const errName = err instanceof DOMException ? err.name : "";
          if (errName === "NotSupportedError") {
            captureUnsupported = true;
            if (!options?.silent) {
              showTransientNotice("Drag the view to look around. WASD still works.", "Drag the view");
            }
            return;
          }
          const duringCooldown = lastLockReleaseAt > 0 && performance.now() - lastLockReleaseAt < 1550;
          if (duringCooldown) {
            // Browsers enforce a ~1.3s cooldown after Esc releases Pointer Lock; keep look active and invite one more click.
            if (!options?.silent) {
              showTransientNotice("Click the 3D view once more to lock the cursor — mouse look active.", "Click the 3D view once more");
            }
            return;
          }
          captureFailureCount += 1;
          if (!options?.silent && captureFailureCount === 1) {
            showTransientNotice("Mouse capture is unavailable here. Drag to look; WASD walks.", "Mouse capture is unavailable");
          }
        };
        try {
          const request = element.requestPointerLock();
          if (request && typeof request.then === "function") {
            void request.then(() => { lockInFlight = false; }, (err) => { onLockRejected(err); });
          }
          else {
            lockInFlight = false;
          }
        }
        catch (err) {
          onLockRejected(err);
        }
      };
      const down = (e: PointerEvent) => {
        if (phoneOpenRef.current) return;
        const targetEl = e.target as HTMLElement | null;
        if (isUiControlTarget(targetEl)) {
          return;
        }
        element.focus({ preventScroll: true });
        if (!current.current.enabled)
          return;
        const onScene = isSceneTarget(targetEl);
        const resuming = cursorReleased.current;
        if (e.pointerType === "mouse" && onScene) {
          setCursorMode(false);
        }
        if (dragging)
          return;
        dragging = true;
        lookPointer = e.pointerId;
        px = e.clientX;
        py = e.clientY;
        if (e.pointerType === "mouse" &&
          !cameraSettings.current.touchControlsActive &&
          onScene &&
          document.pointerLockElement !== element) {
          requestLockCapture({ forceRetry: resuming });
        }
      };
      const sceneClick = (e: MouseEvent) => {
        if (!current.current.enabled || phoneOpenRef.current || cameraSettings.current.touchControlsActive)
          return;
        // Ignore synthetic Enter/Space clicks while still handling real pointer clicks after Esc or cooldown.
        if (e.detail === 0)
          return;
        const targetEl = e.target as HTMLElement | null;
        if (!isSceneTarget(targetEl))
          return;
        const resuming = cursorReleased.current;
        setCursorMode(false);
        if (document.pointerLockElement !== element) {
          requestLockCapture({ forceRetry: resuming, silent: true });
        }
      };
      const move = (e: PointerEvent) => {
        if (dragging || document.pointerLockElement === element) {
          lastMouseMoveTime = performance.now();
        }
        if (!current.current.enabled || phoneOpenRef.current || current.current.story?.ending) {
          return;
        }
        const isThird = cameraSettings.current.thirdPerson;
        const minPitch = isThird ? -1.1 : -1.35;
        const maxPitch = isThird ? 0.85 : 1.35;
        if (document.pointerLockElement === element) {
          if (discardCapturedMove) {
            discardCapturedMove = false;
            return;
          }
          cameraYaw -=
            safeLookDelta(e.movementX) * 0.0023 * cameraSettings.current.sensitivity;
          pitch = Math.max(minPitch, Math.min(maxPitch, pitch - safeLookDelta(e.movementY) * 0.0023 * cameraSettings.current.sensitivity));
        }
        else if (current.current.enabled &&
          dragging && e.pointerId === lookPointer) {
          cameraYaw -=
            safeLookDelta(e.clientX - px) * 0.0023 * cameraSettings.current.sensitivity;
          pitch = Math.max(minPitch, Math.min(maxPitch, pitch - safeLookDelta(e.clientY - py) * 0.0023 * cameraSettings.current.sensitivity));
          px = e.clientX;
          py = e.clientY;
        }
        else if (e.pointerType === "mouse") {
        }
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId === lookPointer) {
          dragging = false;
          lookPointer = null;
        }
      };
      releasePhoneInput.current = () => {
        dragging = false;
        lookPointer = null;
        keys.clear();
        walker.vx = 0;
        walker.vz = 0;
        rover.speed = 0;
        setCursorMode(true);
      };
      const keydown = (e: KeyboardEvent) => {
        if (current.current.story?.ending) {
          if (e.code==='Space'||e.key==='Escape') { e.preventDefault(); current.current.story.onEndingComplete?.(); }
          return;
        }
        if (e.defaultPrevented || !current.current.enabled || phoneOpenRef.current)
          return;
        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName;
        if (active?.closest?.("dialog, [role='dialog']"))
          return;
        if (e.key === "Escape" && !e.repeat) {
          e.preventDefault();
          if (document.pointerLockElement === element) {
            document.exitPointerLock();
          }
          else {
            setCursorMode(true, true);
          }
          keys.clear();
          return;
        }
        if (tag === "TEXTAREA" || tag === "SELECT" || active?.isContentEditable)
          return;
        if (tag === "INPUT" &&
          !["range", "checkbox", "radio", "button"].includes((active as HTMLInputElement).type))
          return;
        const onInteractive = tag === "BUTTON" || tag === "SUMMARY" || tag === "A";
        const k = e.key.toLowerCase();
        geigerAudio.current?.resume();
        if (radiationPhoneCommand(e.key, {
          open: false, enabled: current.current.enabled, repeat: e.repeat,
          modified: e.altKey || e.ctrlKey || e.metaKey,
          editable: tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(active?.isContentEditable),
          interactive: onInteractive, otherDialog: false,
        }) === 'open') {
          e.preventDefault();
          openPhone();
          return;
        }
        if (!current.current.story && k === "y" && !e.repeat && !onInteractive) {
          e.preventDefault();
          toggleSpaceWeatherAction.current();
          return;
        }
        const isMapKey = (e.code === "KeyM" || k === "m" || e.code === "CapsLock");
        if (isMapKey && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && tag !== "INPUT" && current.current.onOpenMap) {
          e.preventDefault();
          current.current.onOpenMap();
          return;
        }
        if ([
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)) {
          e.preventDefault();
          keys.add(k);
        }
        if (k === "e" || (k === "enter" && !onInteractive)) {
          e.preventDefault();
          if (!rover.driving && repairTargetRef.current && !garagePrompt(garageState, walker.x, walker.z, rover)?.enabled) {
            repairAction.current();
          } else {
            inspect();
          }
        }
        if (k === "q")
          keys.add("look-left");
        if (k === "shift")
          keys.add("shift");
        if (k === "r")
          keys.add("look-right");
        if (k === "v" && !e.repeat) {
          e.preventDefault();
          setThirdPerson((v) => !v);
        }
        if (k === "f" && !e.repeat && true) {
          e.preventDefault();
          toggleRoverAction.current();
        }
        if (e.code === "Space" && !e.repeat && !onInteractive) {
          e.preventDefault();
          keys.add("jump");
          keys.add("handbrake");
        }
      };
      const keyup = (e: KeyboardEvent) => {
        keys.delete(e.key.toLowerCase());
        if (e.code === "Space") {
          keys.delete("jump");
          keys.delete("handbrake");
        }
        if (e.key.toLowerCase() === "q")
          keys.delete("look-left");
        if (e.key.toLowerCase() === "r")
          keys.delete("look-right");
      };
      const blur = () => {
        lockInFlight = false;
        keys.clear();
        dragging = false;
        lookPointer = null;
      };
      const lockChange = () => {
        lockInFlight = false;
        dragging = false;
        lookPointer = null;
        const captured = document.pointerLockElement === element;
        const releasedFromLock = wasCaptured && !captured;
        wasCaptured = captured;
        discardCapturedMove = captured;
        if (captured) {
          captureFailureCount = 0;
          setCursorMode(false);
          setMessage("");
        }
        else if (releasedFromLock) {
          lastLockReleaseAt = performance.now();
          if (current.current.enabled)
            setCursorMode(true, true);
        }
        keys.clear();
      };
      const lockError = () => {
        lockInFlight = false;
      };
      lockAction.current = () => {
        element.focus({ preventScroll: true });
        if (document.pointerLockElement === element) {
          lastLockReleaseAt = performance.now();
          setCursorMode(true, true);
          document.exitPointerLock();
          return;
        }
        setCursorMode(false);
        requestLockCapture({ forceRetry: true });
      };
      const lost = (e: Event) => {
        e.preventDefault();
        current.current.onUnavailable();
      };
      let lastCuriositySave = 0, pendingSave = 0;
      const hasIdleSave = typeof window.requestIdleCallback === 'function';
      const saveCuriosityNow = () => {
        if(pendingSave){if(hasIdleSave)window.cancelIdleCallback(pendingSave);else window.clearTimeout(pendingSave);pendingSave=0;}
        if (!curiosity || false)
          return;
        try {
          window.localStorage.setItem(CURIOSITY_SAVE_KEY, JSON.stringify(exportCuriositySave(curiosity)));
        }
        catch {
          // Ignore storage quota or private browsing errors.
        }
      };
      const saveOnHide = () => {
        // Browsers may suspend rAF entirely in a background tab.
        metricStart = 0;
        metricFrames = 0;
        autoState.slow = 0;
        autoState.fast = 0;
        backgroundProbe?.reset();
        last = 0; renderPacer.next = 0;
        keys.clear(); analogWalk.current = {}; analogDrive.current = {};
        dragging = false; lookPointer = null;
        if (document.hidden) {
          cancelAnimationFrame(frame); frame = 0;
          saveCuriosityNow();
        } else if (!cancelled && element.dataset.catchSite === "ready" && !frame) frame = requestAnimationFrame(animate);
      };
      element.addEventListener("pointerdown", down);
      element.addEventListener("click", sceneClick);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      window.addEventListener("keydown", keydown);
      window.addEventListener("keyup", keyup);
      window.addEventListener("blur", blur);
      element.addEventListener("blur", blur);
      document.addEventListener("pointerlockchange", lockChange);
      document.addEventListener("pointerlockerror", lockError);
      window.addEventListener("pagehide", saveCuriosityNow);
      window.addEventListener("beforeunload", saveCuriosityNow);
      document.addEventListener("visibilitychange", saveOnHide);
      renderer.domElement.addEventListener("webglcontextlost", lost);
      let lastReportedExposure = 0;
      let lastReportedHp = 100;
      let lastSpaceWeatherUpdate = 0;
      let deathCollapse = 0;
      const sevObstacles: CollisionObstacle[] = [], dynamicObstacles: CollisionObstacle[] = [], curiosityObstacles: CollisionObstacle[] = [];
      const lidarObstacles: CollisionObstacle[] = [];
      const crewObstacle = roverFootprint(0, 0, 0), scoutObstacle = curiosityFootprint(0, 0, 0);
      const playerObstacle = {x:0,z:0,radius:WALKER_RADIUS,id:'walker'};
      const garagePlayerObstacle = {x:0,z:0,radius:WALKER_RADIUS+.1,id:'walker'};
      const crewFootprint = () => { crewObstacle.x=rover.x;crewObstacle.z=rover.z;crewObstacle.yaw=rover.yaw;return crewObstacle; };
      const scoutFootprint = () => { if(curiosity){scoutObstacle.x=curiosity.x;scoutObstacle.z=curiosity.z;scoutObstacle.yaw=curiosity.yaw;}return scoutObstacle; };
      const physicsOptions = {...streamOptions,daylightElapsed};
      let previousArrivalTime=0;
      function animate(time: number) {
        const frameStarted = performance.now();
        frame = 0;
        if (cancelled || document.hidden) { last = 0; return; }
        frame = requestAnimationFrame(animate);
        if (current.current.coveredByArrival) {
          const arrival=current.current.arrivalPlayback;
          if(!document.hidden&&arrival?.active&&arrival.time>=STARSHIP_RETURN_CUT){
            const step=Math.max(0,Math.min(.1,arrival.time-previousArrivalTime));
            previousArrivalTime=arrival.time;
            catchSite.cinematic(arrival.time,step,camera,reduced.matches);
            // Use the daylight environment immediately; the normal gameplay loop has not run yet.
            light.intensity=3.4;ambient.intensity=.65;scene.environmentIntensity=.85;
            ambient.color.copy(dayAmbient);ambient.groundColor.copy(dayGround);light.color.copy(dayLight);
            (scene.fog as import('three').FogExp2).density=.0018;
            (scene.fog as import('three').FogExp2).color.copy(dayFog);
            (scene.background as import('three').Color).copy(daySky);
            if(marsSky)marsSky.uniforms.night.value=0;
            starField.visible=false;earth.visible=false;
            if(dust)dust.visible=false;
            outpost.update(0,OUTPOST_SITE.x,OUTPOST_GROUND_HEIGHT+45,OUTPOST_SITE.z,true,false);
            outpost.updateVisibility(camera);
            greenhouses.updateVisibility(camera,OUTPOST_SITE.x,OUTPOST_SITE.z,lastQuality==='performance');
            viewFrame++;renderer.info.reset();renderer.render(scene,camera);
            arrival.marsRendered=true;
            element.dataset.arrivalScene='mars';
            element.dataset.arrivalTime=arrival.time.toFixed(2);
          }
          last = time;
          metricStart = 0;
          metricFrames = 0;
          keys.clear();
          return;
        }
        catchSite.settle();
        if (document.hidden) {
          last = time;
          metricStart = 0;
          metricFrames = 0;
          autoState.slow = autoState.fast = 0;
          backgroundProbe?.reset();
          keys.clear();
          return;
        }
        // A stationary view behind a dialog needs only occasional refreshes.
        if (!renderFrameDue(time, mobileMars, (!current.current.enabled || phoneOpenRef.current) && !current.current.story?.ending, renderPacer)) return;
        const frameInterval = last ? time - last : 0;
        const dt = last ? Math.min(frameInterval / 1000, 0.1) : 1 / 60;
        last = time;
        const p = current.current;
        const worldActive = p.enabled && !phoneOpenRef.current;
        if (p.story && (storySession !== p.story.sessionId || storyRevision !== p.story.command.revision)) {
          storySession = p.story.sessionId; storyRevision = p.story.command.revision;
          rover.battery = Math.max(0,Math.min(100,p.story.command.roverCharge));
          rover.estimatedRangeKm = rover.battery / 100 * ROVER_NOMINAL_RANGE_KM;
          setRoverBattery(rover.battery);
        }
        perseverance?.updateVisibility(walker.x, walker.z, lastQuality === 'performance');
        if (streaming) {
          streaming.update(walker.x, walker.z, lastQuality === "performance" ? .7 : terrainBudget.generationMs);
          const coverage = streaming.coverage();
          regionalLandscape?.setCoverage(coverage.x, coverage.y, coverage.z, coverage.w);
          skyMesh?.position.set(walker.x, 0, walker.z);
          starField.position.set(walker.x, 0, walker.z);
        }
        const cameraChanged = (rover.driving && !cameraSettings.current.thirdPerson) !== wasCockpit;
        const programsBefore = renderer.info.programs?.length ?? 0;
        if (effectiveQuality() !== lastQuality || lastSelection !== cameraSettings.current.quality) {
          const selectionChanged = lastSelection !== cameraSettings.current.quality;
          lastSelection = cameraSettings.current.quality;
          const name = effectiveQuality();
          const cap = qualityCap(name);
          // A live Auto tier change also eases toward its new pixel cap; manual choices apply immediately.
          applyQuality(name, cameraSettings.current.quality === 'auto' && !selectionChanged ? resolutionScale : cap);
          if (effectsSupported && wantsEffects() && lastQuality !== "performance" && !composer && (!backgroundProbe || backgroundPrepared)) {
            void prepareEffects().then(() => {
              if (!cancelled) {
                configureEffects();
                resize();
              }
            });
          }
          metricStart = 0;
          metricFrames = 0;
        }
        if (cameraSettings.current.quality === 'auto' && graphicsSampling.eligible && time - lastResolutionChange >= 400 && Math.abs(resolutionScale - autoState.scale) > .005) {
          resolutionScale = approachRenderScale(resolutionScale, autoState.scale);
          renderer.setPixelRatio(resolutionScale);
          resize();
          lastResolutionChange = time;
        }
        const activeHeightAt = model.heightAt;
        const activeTier = tierFor(lastQuality);
        outpost.update(dt, walker.x, activeHeightAt(walker.x, walker.z) + jump.height, walker.z, lastQuality === "performance", worldActive);
        greenhouses.update(dt, walker.x, activeHeightAt(walker.x, walker.z) + jump.height, walker.z, worldActive);
        model.updateTracks?.(renderer, walker.x, walker.z, mobileMars || lastQuality === "performance");
        if (isDeadRef.current) {
          keys.clear();
          walker.vx = 0;
          walker.vz = 0;
          if (rover.driving) {
            rover.speed = 0;
            rover.handbrake = true;
          }
        }
        if (worldActive && !p.story?.ending) {
          const previousCharge = rover.battery;
          const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
          const step = dt / steps;
          {
            nearbyObstacles(model.obstacles,rover.x,rover.z,40,sevObstacles);
            if(curiosity)sevObstacles.push(scoutFootprint());
            garagePlayerObstacle.x=walker.x;garagePlayerObstacle.z=walker.z;
            stepGarage(garageState, rover, dt, !isDeadRef.current,
              garagePlayerObstacle,
              sevObstacles, model.roverHeightAt, 1-nightAmount(daylightElapsed), reduced.matches, p.story?.command.chargingAllowed ?? true);
            if (rover.driving) {
              const prevRoverYaw = rover.yaw;
              physicsOptions.daylightElapsed = daylightElapsed;
              for (let i = 0; i < steps; i++) {
                rover = stepRoverVehicle(rover, keys, step, sevObstacles, model.roverHeightAt, model.mudAt, analogDrive.current, physicsOptions);
              }
              walker.x = rover.x;
              walker.z = rover.z;
              walker.yaw = rover.yaw;
              const yawDelta = rover.yaw - prevRoverYaw;
              cameraYaw += yawDelta;
              characterYaw = rover.yaw;
              const isCruising = Math.abs(rover.speed) > 1.2;
              const timeSinceMouse = (performance.now() - lastMouseMoveTime) / 1000;
              if (isCruising && !dragging && timeSinceMouse > 0.8 && document.pointerLockElement !== element) {
                const targetYaw = rover.speed < 0 && cameraSettings.current.thirdPerson
                  ? rover.yaw + Math.PI : rover.yaw;
                const diff = shortestAngleDiff(cameraYaw, targetYaw);
                cameraYaw += diff * (1 - Math.exp(-2.2 * dt));
              }
            }
            else {
              if (bigRover && !garageControlsRover(garageState) && Math.abs(rover.speed) > 0.01) {
                rover = stepRoverVehicle(rover, keys, dt, sevObstacles, model.roverHeightAt, model.mudAt, undefined, {
                  ...(streaming ? streamOptions : undefined),
                  daylightElapsed,
                });
              }
              nearbyObstacles(model.obstacles,walker.x,walker.z,3,dynamicObstacles);
              if(bigRover)dynamicObstacles.push(crewFootprint());
              if(curiosity)dynamicObstacles.push(scoutFootprint());
              walker.yaw = cameraYaw;
              const speedMultiplier = radiationExposureRef.current >= 70 ? 0.70 : 1.0;
              for (let i = 0; i < steps; i++) {
                {
                  const next = stepMarsLocomotion(walker, jump, keys, step, model.heightAt, dynamicObstacles, analogWalk.current, streaming ? STREAM_LIMIT : undefined, speedMultiplier);
                  walker = next.walker;
                  jump = next.jump;
                  const headroom = Math.max(0, Math.min(outpost.ceilingAt(walker.x, walker.z), greenhouses.ceilingAt(walker.x, walker.z), garage.ceilingAt(walker.x, walker.z)) - model.heightAt(walker.x, walker.z) - 1.78);
                  if (jump.height > headroom) jump = { height: headroom, velocity: Math.min(0, jump.velocity) };
                  keys.delete("jump");
                }
              }
              keys.delete("jump");
            }
          }
          if (p.story) {
            rover.battery = allocatedRoverCharge(previousCharge, rover.battery, p.story.command);
            rover.estimatedRangeKm = rover.battery / 100 * ROVER_NOMINAL_RANGE_KM;
          }
          if (curiosity && true) {
            curiosityObstacles.length=0;
            for(const obstacle of model.obstacles)curiosityObstacles.push(obstacle);
            if(bigRover)curiosityObstacles.push(crewFootprint());
            playerObstacle.x=walker.x;playerObstacle.z=walker.z;
            curiosityObstacles.push(playerObstacle);
            curiosity = stepCuriosityRover(curiosity, dt, curiosityObstacles, model.roverHeightAt);
          }
          if (keys.has("look-left")) {
            cameraYaw += dt * 1.3;
            lastMouseMoveTime = performance.now();
          }
          if (keys.has("look-right")) {
            cameraYaw -= dt * 1.3;
            lastMouseMoveTime = performance.now();
          }
        }
        if (rover.driving && true && time - lastLidarScan >= 125) {
          nearbyObstacles(model.obstacles,rover.x,rover.z,35,lidarObstacles);
          if(curiosity)lidarObstacles.push(scoutFootprint());
          lidar = scanRoverLidar(rover, lidarObstacles);
          lastLidarScan = time;
        }
        if (p.story?.command.night) {
          daylightElapsed = approachStoryDaylight(daylightElapsed,true,dt); storyWasNight = true;
        } else if (storyWasNight || storyDawn) {
          storyWasNight = false; storyDawn = true;
          daylightElapsed = approachStoryDaylight(daylightElapsed,false,dt);
          if (daylightElapsed%600 > 599.8) { daylightElapsed=0;storyDawn=false; }
        } else if(worldActive) daylightElapsed += dt;
        const nightBlend = nightAmount(daylightElapsed);
        {
          model.root.visible = true;
          if (bigRover) {
            const hidden = roverHiddenByGarage(garageState.phase, garageState.doorAmount, garageIndoors(walker.x,walker.z), rover.driving);
            bigRover.root.visible = !hidden;
            bigRover.dust.visible = !hidden;
          }
          if (curiosityRover)
            curiosityRover.root.visible = true;
          if (dust)
            dust.visible = true;
        }
        if (bigRover && true) {
          const roverGround = rover.chassisY ?? model.heightAt(rover.x, rover.z);
          bigRover.update(rover, roverGround, dt, false, model.heightAt, lidar, activeTier.shadows, curiosity);
          if (rover.driving || Math.abs(rover.speed) > 0.1) {
            model.stampRoverTracks?.(renderer, rover);
          }
        }
        if (curiosityRover && curiosity && true) {
          curiosityRover.update(curiosity, dt, false, reduced.matches, activeTier.shadows);
          if (Math.abs(curiosity.speed) > 0.05) {
            model.stampCuriosityTracks?.(renderer, curiosity);
          }
        }
        {
          const nearNow = !rover.driving && !garageControlsRover(garageState) && canEnterRover(walker, rover);
          if (nearNow !== lastRoverNear) {
            lastRoverNear = nearNow;
            setRoverNear(nearNow);
          }
          if (!rover.driving) {
            const nearestPart = garageControlsRover(garageState) ? null : getNearestRoverPart(walker, rover);
            if (nearestPart && nearestPart.distance <= 2.8 && nearestPart.health < 100) {
              const roundedHp = Math.round(nearestPart.health);
              if (lastRepairTarget?.id !== nearestPart.id || lastRepairTarget?.health !== roundedHp) {
                lastRepairTarget = { id: nearestPart.id, name: nearestPart.name, health: roundedHp };
                setRepairTarget({ id: nearestPart.id, name: nearestPart.name, health: roundedHp });
              }
            } else if (lastRepairTarget !== null) {
              lastRepairTarget = null;
              setRepairTarget(null);
            }
          } else if (lastRepairTarget !== null) {
            lastRepairTarget = null;
            setRepairTarget(null);
          }

          if (rover.damage) {
            let dmgChanged = false;
            const dmgKeys: RoverPartId[] = [
              "wheel_fl", "wheel_fr", "wheel_ml", "wheel_mr", "wheel_rl", "wheel_rr", "cabin_roof"
            ];
            for (const dk of dmgKeys) {
              if (Math.round(rover.damage[dk]) !== Math.round(lastRoverDamage[dk])) {
                dmgChanged = true;
                break;
              }
            }
            if (dmgChanged) {
              lastRoverDamage = { ...rover.damage };
              setRoverDamage({ ...rover.damage });
            }
          }

          const battNow = Math.round(rover.battery);
          if (battNow !== lastRoverBattery) {
            lastRoverBattery = battNow;
            setRoverBattery(rover.battery);
          }
          const solarNow = Boolean(rover.solarCharging);
          if (solarNow !== lastRoverSolarCharging) {
            lastRoverSolarCharging = solarNow;
            setRoverSolarCharging(solarNow);
          }
          const garageChargeNow = Boolean(rover.garageCharging);
          if (garageChargeNow !== lastRoverGarageCharging) {
            lastRoverGarageCharging = garageChargeNow;
            setRoverGarageCharging(garageChargeNow);
          }
          const rangeStr = rover.estimatedRangeKm >= 1.0
            ? `${rover.estimatedRangeKm.toFixed(1)} KM`
            : `${Math.round(rover.estimatedRangeKm * 1000)} M`;
          if (rangeStr !== lastRoverRange) {
            lastRoverRange = rangeStr;
            setRoverRangeDisplay(rangeStr);
          }

          // Garage Dock & Maintenance Bay Popup synchronization (5-second display window):
          const isParkedInGarage = garageState.phase === "parked";
          if (isParkedInGarage && lastGaragePhaseRef.current !== "parked") {
            setGarageDockDismissed(false);
            garageDockDismissedRef.current = false;
            garageDockEnteredAt = time;
          } else if (!isParkedInGarage) {
            garageDockEnteredAt = 0;
            if (garageDockDismissedRef.current) {
              garageDockDismissedRef.current = false;
              setGarageDockDismissed(false);
            }
          } else if (garageDockEnteredAt === 0 && !current.current.coveredByArrival) {
            garageDockEnteredAt = time;
          }
          lastGaragePhaseRef.current = garageState.phase;

          const popupTimeRemaining = garageDockEnteredAt > 0 && time - garageDockEnteredAt < 5000;
          const popupShouldShow = isParkedInGarage && !garageDockDismissedRef.current && popupTimeRemaining;
          const popupSource = garageState.chargingSource ?? "none";
          const popupRepair = Boolean(garageState.repairActive);

          if (
            popupShouldShow !== lastGaragePopupVisible ||
            popupSource !== lastGaragePopupSource ||
            popupRepair !== lastGaragePopupRepair
          ) {
            lastGaragePopupVisible = popupShouldShow;
            lastGaragePopupSource = popupSource;
            lastGaragePopupRepair = popupRepair;
            setGarageDockPopup({
              visible: popupShouldShow,
              chargingSource: popupSource,
              repairActive: popupRepair,
            });
          }

          if (rover.driving) {
            const spd = Math.round(Math.abs(rover.speed) * 3.6);
            if (spd !== lastRoverSpeed) {
              lastRoverSpeed = spd;
              setRoverSpeed(spd);
            }
            const isBoost = Boolean(rover.boostActive);
            const gearNow = getRoverGear(rover.speed, isBoost);
            if (gearNow !== lastRoverGear) {
              lastRoverGear = gearNow;
              setRoverGear(gearNow);
            }
            if (isBoost !== lastRoverBoost) {
              lastRoverBoost = isBoost;
              setRoverBoost(isBoost);
            }
            const mudNow = rover.mudDepth > 0.32;
            if (mudNow !== lastRoverMud) {
              lastRoverMud = mudNow;
              setRoverMud(mudNow);
            }
            if (rover.handbrake !== lastRoverHandbrake) {
              lastRoverHandbrake = rover.handbrake;
              setRoverHandbrake(rover.handbrake);
            }
          }
        }
        // The phone can replay observations while world simulation is paused.
        // Story never converts this near-Earth feed into mission dose or penalties.
        if (phoneOpenRef.current && spaceWeatherService.current) {
          const telemetry = spaceWeatherService.current.update(dt);
          if (time - lastSpaceWeatherUpdate > 250) {
            lastSpaceWeatherUpdate = time;
            setSpaceWeather(telemetry);
          }
          geigerAudio.current?.update(dt, telemetry.sepFluxPFU, false);
        }
        // Free Exploration retains its existing, explicitly fictional exposure rules.
        if (worldActive && !p.story) {
          const inRover = Boolean(rover.driving);
          const playerPosX = inRover ? rover.x : walker.x;
          const playerPosZ = inRover ? rover.z : walker.z;

          const inBase = !inRover && isBaseShelter(
            outpost.indoors(playerPosX, playerPosZ),
            greenhouses.indoors(playerPosX, playerPosZ),
            garageIndoors(playerPosX, playerPosZ)
          );

          // Handle Base Shielding Transition & 5s Popup
          if (inBase && !prevInBaseRef.current) {
            triggerBaseShieldRef.current();
          } else if (!inBase && prevInBaseRef.current) {
            if (baseShieldTimeoutRef.current) window.clearTimeout(baseShieldTimeoutRef.current);
            if (baseShieldFadeTimeoutRef.current) window.clearTimeout(baseShieldFadeTimeoutRef.current);
            setBaseShieldPopup({ visible: false, fading: false });
          }
          prevInBaseRef.current = inBase;

          // Handle Rover Boarding Transition & 5s Popup
          if (inRover && !prevInRoverRef.current) {
            triggerRoverShieldRef.current();
          } else if (!inRover && prevInRoverRef.current) {
            clearRoverShieldRef.current();
          }
          prevInRoverRef.current = inRover;

          const { mitigationMultiplier } = getEnvironmentalShielding(inBase, inRover);
          const shieldedNow = inBase;

          if (shieldedNow !== isShieldedRef.current) {
            isShieldedRef.current = shieldedNow;
            setIsShielded(shieldedNow);
          }

          if (spaceWeatherService.current) {
            const telemetry = spaceWeatherService.current.update(dt);
            const expDelta = calculateExposureDelta(telemetry.sepFluxPFU, shieldedNow, dt, mitigationMultiplier);
            const updatedExp = Math.max(0, Math.min(100, radiationExposureRef.current + expDelta));
            radiationExposureRef.current = updatedExp;

            let currentHp = astronautHealthRef.current;
            const damageDrain = calculateRadiationDrain(updatedExp, shieldedNow, mitigationMultiplier, dt);
            if (damageDrain > 0) {
              currentHp = Math.max(0, currentHp - damageDrain);
            } else if (shieldedNow && currentHp < 100 && !isDeadRef.current) {
              currentHp = Math.min(100, currentHp + 2.5 * dt);
            }
            if (currentHp <= 0 && !isDeadRef.current) {
              currentHp = 0;
              isDeadRef.current = true;
              setIsDead(true);
            }
            astronautHealthRef.current = currentHp;

            if (!isDeadRef.current) {
              geigerAudio.current?.update(dt, telemetry.sepFluxPFU * (inRover ? 0.5 : 1.0), shieldedNow);
            }

            if (time - lastSpaceWeatherUpdate > 100 || Math.abs(updatedExp - lastReportedExposure) > 0.08 || Math.abs(currentHp - lastReportedHp) > 0.5) {
              lastSpaceWeatherUpdate = time;
              lastReportedExposure = updatedExp;
              lastReportedHp = currentHp;
              setRadiationExposure(updatedExp);
              setAstronautHealth(currentHp);
              setSpaceWeather(telemetry);
              if (telemetry.sepFluxPFU >= 10 && !prevStormActive.current) {
                prevStormActive.current = true;
                openPhone();
              } else if (telemetry.sepFluxPFU < 10 && prevStormActive.current) {
                prevStormActive.current = false;
              }
            }
          }
        }
        const insideOutpost = !p.story?.ending && !rover.driving && outpost.indoors(walker.x,walker.z);
        const insideFacility = insideOutpost || (!rover.driving && greenhouses.indoors(walker.x,walker.z));
        if(updateOutpostRendering(outpostRendering,insideOutpost,worldActive||p.story?.ending?dt:0)){
          outpost.setInteriorActive(outpostRendering.active);
          configureEffects();
          // Retain the cached shadow maps and shader variants while indoors.
          renderer.shadowMap.needsUpdate = !outpostRendering.active;
          metricStart = 0;
          metricFrames = 0;
          autoState.slow = autoState.fast = 0;
          backgroundProbe?.reset();
        }
        updateGraphicsSamplingGate(graphicsSampling,outpostRendering.active,time);
        const cameraDt = worldActive ? dt : 0;
        const third = updateInteriorCamera(interiorCamera,insideFacility,cameraSettings.current.thirdPerson,rover.driving?.25:cameraDt);
        if(third!==cameraSettings.current.thirdPerson){
          cameraSettings.current.thirdPerson=third;
          setThirdPerson(third);
        }
        const thirdBlend = updateCameraBlend(viewBlend,third,cameraDt,reduced.matches || rover.driving);
        const cockpitView = rover.driving && !third;
        if (cockpitView && !wasCockpit) {
          cameraYaw = rover.yaw;
          pitch = -.14;
        }
        wasCockpit = cockpitView;
        bigRover?.setCockpitView(cockpitView);
        if (astronautShadow)
          astronautShadow.mesh.visible = !rover.driving && thirdBlend>.24;
        if (rover.driving) {
          orbitInitialized = false;
          astronaut.visible = true;
          bigRover?.positionDriver(astronaut);
          marsAstronaut?.setSeated(true, cockpitView);
          marsAstronaut?.update(0, 0, false, 0);
          const roverGround = rover.chassisY ?? model.heightAt(rover.x, rover.z);
          cameraGround += (roverGround - cameraGround) * (1 - Math.exp(-14 * dt));
          if (third) {
            // Orbit the vehicle centre while preserving mouse-look control.
            const vehicleBack = 7.4;
            const roverTargetY = cameraGround + 1.95;
            const horizBack = Math.cos(pitch) * vehicleBack;
            const vertBack = -Math.sin(pitch) * vehicleBack;
            camera.position.set(rover.x + Math.sin(cameraYaw) * horizBack, roverTargetY + vertBack, rover.z + Math.cos(cameraYaw) * horizBack);
            const groundUnderCam = model.heightAt(camera.position.x, camera.position.z);
            camera.position.y = Math.max(camera.position.y, groundUnderCam + 0.6);
            camera.rotation.set(pitch, cameraYaw, 0, "YXZ");
          }
          else {
            bigRover?.positionCockpitCamera(camera, cameraYaw - rover.yaw, pitch);
          }
        }
        else {
          marsAstronaut?.setSeated(false);
          marsAstronaut?.setFirstPersonView(thirdBlend < .999);
          astronaut.rotation.x = 0;
          if (!isDeadRef.current) astronaut.rotation.z = 0;
          if (isDeadRef.current) {
            deathCollapse = Math.min(1, deathCollapse + dt * 1.5);
          }
          astronaut.visible = !isDeadRef.current || thirdBlend>.24;
          const groundHeight = activeHeightAt(walker.x, walker.z);
          const collapseY = isDeadRef.current ? -deathCollapse * 0.5 : 0;
          astronaut.position.set(walker.x, groundHeight + jump.height + collapseY, walker.z);
          if (astronautShadow) {
            astronautShadow.mesh.position.set(walker.x, groundHeight + 0.024, walker.z);
            astronautShadow.material.opacity = Math.max(0.12, (activeTier.shadows ? 0.18 : 0.46) - jump.height * 0.16) * (1);
          }
          const speed = Math.hypot(walker.vx, walker.vz);
          const airborne = (jump.height > 0 || jump.velocity > 0);
          if (!airborne && !third) {
            characterYaw = cameraYaw;
          }
          else if (!airborne && speed > 0.15) {
            const moveHeading = Math.atan2(-walker.vx, -walker.vz);
            const diff = shortestAngleDiff(characterYaw, moveHeading);
            characterYaw += diff * (1 - Math.exp(-14 * dt));
          }
          astronaut.rotation.y = characterYaw;
          if (isDeadRef.current) {
            astronaut.rotation.z = Math.min(1.4, astronaut.rotation.z + deathCollapse * 1.4);
          }
          if (worldActive && true && !rover.driving)
            footprints?.(walker.x, walker.z, characterYaw, jump.height < .04);
          gaitPhase += speed * dt * 2.4;
          gaitBlend += ((speed > .3 && jump.height < .1 ? 1 : 0) - gaitBlend) * (1 - Math.exp(-12 * dt));
          const stride = reduced.matches ? 0 : Math.sin(gaitPhase) * .38 * gaitBlend;
          if (marsAstronaut) {
            marsAstronaut.update(dt, speed, jump.height > 0 || jump.velocity > 0, jump.height, jump.velocity);
          }
          else {
            leftLeg.rotation.x = stride;
            rightLeg.rotation.x = -stride;
            leftArm.rotation.x = -stride * 0.65;
            rightArm.rotation.x = stride * 0.65;
          }
          const back = (5.2);
          const shoulder = 0.28;
          if (airborne)
            cameraGround = groundHeight;
          else
            cameraGround += (groundHeight - cameraGround) * (1 - Math.exp(-14 * dt));
          const astronautEyeHeight = marsAstronaut?.getEyeHeight() ?? 1.7;
          const eyeHeight = isDeadRef.current ? Math.max(.35,astronautEyeHeight-deathCollapse*1.35) : astronautEyeHeight;
          const fpvForward = 0.28;
          eyeCamera.set(walker.x - Math.sin(cameraYaw) * fpvForward,cameraGround+eyeHeight+jump.height,walker.z - Math.cos(cameraYaw) * fpvForward);
          const eyeRoll = isDeadRef.current ? camera.rotation.z+(.35-camera.rotation.z)*(1-Math.exp(-4*dt)) : 0;
          eyeRotation.setFromEuler(eyeAngles.set(pitch,cameraYaw,eyeRoll,"YXZ"));
          if (thirdBlend>0) {
            const targetY = cameraGround + jump.height + (1.45);
            const horizBack = Math.cos(pitch) * back;
            const vertBack = -Math.sin(pitch) * back;
            desiredCamera.set(walker.x + Math.sin(cameraYaw) * horizBack + Math.cos(cameraYaw) * shoulder, targetY + vertBack, walker.z + Math.cos(cameraYaw) * horizBack - Math.sin(cameraYaw) * shoulder);
            const groundUnderCam = activeHeightAt(desiredCamera.x, desiredCamera.z);
            desiredCamera.y = Math.max(desiredCamera.y, groundUnderCam + 0.45);
            if (!orbitInitialized)
              orbitCamera.copy(desiredCamera);
            orbitCamera.lerp(desiredCamera, 1 - Math.exp(-18 * dt));
            orbitInitialized = true;
            outpost.constrainCamera(walker.x, cameraGround + jump.height + 1.45, walker.z, orbitCamera);
            greenhouses.constrainCamera(walker.x, cameraGround + jump.height + 1.45, walker.z, orbitCamera);
            garage.constrainCamera(walker.x, cameraGround + jump.height + 1.45, walker.z, orbitCamera);
            camera.position.copy(orbitCamera);
            camera.lookAt(walker.x + Math.cos(cameraYaw) * shoulder, cameraGround + jump.height + (1.45), walker.z - Math.sin(cameraYaw) * shoulder);
            camera.position.lerp(eyeCamera,1-thirdBlend);
            camera.quaternion.slerp(eyeRotation,1-thirdBlend);
          }
          else {
            orbitInitialized = false;
            camera.position.copy(eyeCamera);
            camera.quaternion.copy(eyeRotation);
          }
        }
        if(debug){
          element.dataset.cameraView=third?'third':'first';
          element.dataset.cameraBlend=thirdBlend.toFixed(4);
          element.dataset.indoorCamera=String(interiorCamera.inside);
          element.dataset.cameraPosition=`${camera.position.x.toFixed(3)},${camera.position.y.toFixed(3)},${camera.position.z.toFixed(3)}`;
        }
        if (helmetLamp && helmetTarget) {
          const lampActive = true;
          helmetLamp.intensity = 0;
          if (lampActive) {
            const hy = activeHeightAt(walker.x, walker.z) + 1.75 + jump.height;
            helmetLamp.position.set(walker.x, hy, walker.z);
            helmetTarget.position.set(walker.x - Math.sin(cameraYaw) * 12, hy + Math.sin(pitch) * 6 - 0.8, walker.z - Math.cos(cameraYaw) * 12);
          }
        }
        if (p.story?.ending) {
          // The supplied greenhouse has opaque walls: start beside its entrance.
          // Travelling here from the terminal would pass through solid rooms.
          endingWindow.y = model.heightAt(-39,-34) + 2.1;
          endingElapsed += dt;
          const duration = reduced.matches ? 2 : 12;
          const t = Math.min(1,endingElapsed/duration), smooth=t*t*(3-2*t);
          if (reduced.matches) camera.position.copy(endingAbove);
          else camera.position.lerpVectors(endingWindow,endingAbove,smooth);
          endingAt.set(-10,model.heightAt(0,-65)+2,-65);
          camera.lookAt(endingAt);
          outpost.update(0,camera.position.x,camera.position.y-1.5,camera.position.z,lastQuality==='performance',false);
          if (t===1&&!endingFinished) {endingFinished=true;p.story.onEndingComplete?.();}
        } else {endingElapsed=0;endingFinished=false;}
        outpost.updateVisibility(camera);
        greenhouses.updateVisibility(camera, p.story?.ending?camera.position.x:walker.x, p.story?.ending?camera.position.z:walker.z, lastQuality === "performance");
        garage.update(walker.x, walker.z, lightRendering());
        windDust?.update(dt, walker.x, walker.z, model.heightAt, reduced.matches, activeTier.particles);
        if (dust) dust.visible = !insideFacility && !garageIndoors(walker.x, walker.z);
        if (aim.current) {
          aim.current.style.left = "50%";
          aim.current.style.top = "50%";
        }
        light.intensity = 3.4;
        ambient.intensity = .65;
        {
          ambient.color.setHex(0xc5ccd5);
          ambient.groundColor.setHex(0x77543e);
          light.color.setHex(0xffe5c7);
          scene.environmentIntensity = .85;
          const shadowStep = 68 / light.shadow.mapSize.x;
          const sx = Math.round((walker.x - Math.sin(cameraYaw) * 15) / shadowStep) * shadowStep;
          const sz = Math.round((walker.z - Math.cos(cameraYaw) * 15) / shadowStep) * shadowStep;
          light.target.position.set(sx, 0, sz);
          light.position.copy(MARS_SUN_DIRECTION).multiplyScalar(100).add(light.target.position);
          starField.visible = false;
          earth.visible = false;
        }
        sun.visible = (true);
        earth.visible = earth.visible;
        earth.position.set(65, 40, -170);
        {
          const n = nightBlend;
          const twilight = 4 * n * (1 - n);
          light.intensity = T.MathUtils.lerp(3.4, .22, n);
          ambient.intensity = T.MathUtils.lerp(.65, .60, n);
          ambient.color.copy(dayAmbient).lerp(nightAmbient, n);
          ambient.groundColor.copy(dayGround).lerp(nightGround, n);
          light.color.copy(dayLight).lerp(sunsetLight, twilight * .55).lerp(nightLight, n);
          scene.environmentIntensity = T.MathUtils.lerp(.85, .15, n);
          const sunAngle = daylightAngle(daylightElapsed);
          const sunSin = Math.sin(sunAngle);
          const sunCos = Math.cos(sunAngle);
          sunDirection.set(MARS_SUN_DIRECTION.x * sunCos + MARS_SUN_DIRECTION.z * sunSin, .25 * sunCos, MARS_SUN_DIRECTION.z * sunCos - MARS_SUN_DIRECTION.x * sunSin).normalize();
          if (marsSky) {
            marsSky.uniforms.night.value = n;
            marsSky.uniforms.sunDirection.value.copy(sunDirection);
          }
          light.position.set(sunDirection.x * 100 + light.target.position.x, Math.max(.18, sunDirection.y) * 100, sunDirection.z * 100 + light.target.position.z);
          sun.visible = true;
          sun.position.copy(sunDirection).multiplyScalar(185);
          sun.position.x += walker.x;
          sun.position.z += walker.z;
          sun.material.opacity = 1 - n;
          starField.visible = true;
          starField.material.opacity = n * n;
          earth.visible = true;
          earth.material.opacity = n * n;
          earth.position.set(walker.x - 70, 65, walker.z - 179);
          (scene.background as import("three").Color).copy(daySky).lerp(nightSky, n);
          const fog = scene.fog as import("three").FogExp2;
          fog.color.copy(dayFog).lerp(nightFog, n);
          fog.density = activeTier.fogDensity;
          if (dust)
            (dust.material as import("three").ShaderMaterial).uniforms.opacity.value = reduced.matches ? .025 : T.MathUtils.lerp(.09, .045, n);
          if (helmetLamp)
            helmetLamp.intensity = rover.driving || outpostRendering.active ? 0 : 2.6 * helmetLightAmount(n);
          if (astronautShadow)
            astronautShadow.material.opacity = Math.max(.12, (activeTier.shadows ? .18 : .44) - jump.height * .16) * T.MathUtils.lerp(1, .45, n);
          if (bigRover) {
            const intensity = T.MathUtils.lerp(rover.driving ? 1.4 : 0, 8.5, n);
            bigRover.headlightL.intensity = intensity;
            bigRover.headlightR.intensity = intensity;
          }
        }
        if (time - lastAimCheck >= 80) {
          lastAimCheck = time;
          if (debug) {
            element.dataset.worldX = walker.x.toFixed(2);
            element.dataset.worldZ = walker.z.toFixed(2);
            element.dataset.cameraYaw = cameraYaw.toFixed(4);
          }
          ray.setFromCamera(center, camera);
          const rayTargets = curiosityRover ? [...model.targets, curiosityRover.hitTarget] : model.targets;
          const hit = ray.intersectObjects(rayTargets, true)[0];
          hover = null;
          range = Infinity;
          if (hit && hit.distance < 65) {
            let o: Object3D | null = hit.object;
            while (o && !o.userData.station)
              o = o.parent;
            if (o) {
              hover = o.userData.station;
              if (hover === "curiosity" && curiosity) {
                range = Math.hypot(walker.x - curiosity.x, walker.z - curiosity.z);
              }
              else if (hover === "perseverance") {
                range = Math.hypot(walker.x - PERSEVERANCE_LANDING.x, walker.z - PERSEVERANCE_LANDING.z);
              }
            }
          }
          // Keep nearby equipment operable even when the crosshair falls just beside a narrow object.
          if (!hover || range > 5.5) {
            ;
            if (curiosity && true) {
              const cDist = Math.hypot(walker.x - curiosity.x, walker.z - curiosity.z);
              if (cDist <= 5.5 && cDist < range) {
                hover = "curiosity";
                range = cDist;
              }
            }
            if (perseverance) {
              const distance = Math.hypot(walker.x - PERSEVERANCE_LANDING.x, walker.z - PERSEVERANCE_LANDING.z);
              if (distance <= 5.5 && distance < range) {
                hover = 'perseverance';
                range = distance;
              }
            }
          }
          const gate = !rover.driving ? greenhouses.nearby(walker.x, model.heightAt(walker.x, walker.z) + jump.height, walker.z, cameraYaw)
            ?? outpost.nearby(walker.x, model.heightAt(walker.x, walker.z) + jump.height, walker.z, cameraYaw) : null;
          const garageAction = garagePrompt(garageState, walker.x, walker.z, rover);
          const station = storyMarkers?.nearest(walker.x, walker.z);
          const gatePrompt = gate ? (gate.waiting ? `Cycling airlock · ${gate.label} — Cancel` : gate.blocked ? "Step clear of the doorway to close" : `${gate.target ? "Close" : "Open"} · ${gate.label}`) : "";
          const prompt = !worldActive ? "" : !p.story ? garageAction?.text ?? gatePrompt
            : garageAction?.enabled ? garageAction.text : gatePrompt || (station ? `Open · ${station.label}` : garageAction?.text ?? "");
          if (prompt !== lastOutpostPrompt) {
            lastOutpostPrompt = prompt; setOutpostPrompt(prompt);
            setOutpostPromptDisabled(Boolean(garageAction && !garageAction.enabled && (!p.story || !station && !gate)));
          }
          const inspectReady = Boolean(worldActive && (station && Math.abs(rover.speed)<.5 || !rover.driving && (garageAction?.enabled || gate || hover && range <= 5.5)));
          if (inspectReady !== lastCanInspect) {
            lastCanInspect = inspectReady;
            setCanInspect(inspectReady);
          }
        }
        if (firstFrame) {
          firstFrame = false;
          keys.clear();
        }
        if (curiosity && !pendingSave && time - lastCuriositySave >= 1500) {
          lastCuriositySave = time;
          const save=()=>{pendingSave=0;if(!cancelled)saveCuriosityNow();};
          pendingSave=hasIdleSave?window.requestIdleCallback(save,{timeout:5000}):window.setTimeout(save,250);
        }
        if (time - lastReport > 125) {
          lastReport = time;
          if (time - lastMapReport > 500) {
            lastMapReport = time;
            mapRocks = model.obstacles.filter(o => o.topY !== undefined && Math.hypot(o.x - walker.x, o.z - walker.z) < 80)
              .sort((a, b) => Math.hypot(a.x - walker.x, a.z - walker.z) - Math.hypot(b.x - walker.x, b.z - walker.z))
              .slice(0, 48).map(o => ({ x: o.x, z: o.z, radius: o.radius }));
          }
          current.current.onView({
            storySite: storyMarkers?.nearest(walker.x,walker.z)?.id ?? null,
            storyRevision,
            phoneOpen: phoneOpenRef.current,
            storyTarget: storySites.find(site=>site.id===p.story?.targetSiteId),
            roverBattery: rover.battery,
            roverHealth: rover.damage.cabin_roof,
            garagePhase: garageState.phase,
            mapRocks: mapRocks,
            x: walker.x,
            z: walker.z,
            lightPhase: daylightPhase(daylightElapsed),
            yaw: cameraYaw,
            target: hover,
            distance: range,
            locked: document.pointerLockElement === element,
            jumpHeight: jump.height,
            radiationExposure: radiationExposureRef.current,
            sepFluxPFU: spaceWeatherService.current?.update(0).sepFluxPFU,
            isShielded: isShieldedRef.current,
            roverX: rover.x,
            roverZ: rover.z,
            roverYaw: rover.yaw,
            roverDriving: rover.driving,
            cockpitView: rover.driving && !cameraSettings.current.thirdPerson,
            roverSpeed: Math.round(Math.abs(rover.speed) * 3.6),
            roverGear: getRoverGear(rover.speed, rover.boostActive),
            mudDepth: rover.mudDepth,
            curiosityX: curiosity?.x,
            curiosityZ: curiosity?.z,
            curiosityYaw: curiosity?.yaw,
            curiosityPhase: curiosity?.phase,
            curiosityScanStage: curiosity?.scanStage,
            curiosityScans: curiosity?.scanCount,
            curiositySample: curiosity?.lastScanSample,
            lidar: rover.driving ? lidar : undefined,
          });
        }
        // Keep the light/shader configuration stable, but do not redraw an unlit
        // spotlight's depth map. Its first map is still prepared before use.
        helmetLamp.shadow.autoUpdate = helmetLamp.intensity > 0 || helmetLamp.shadow.map === null;
        renderer.shadowMap.autoUpdate = !outpostRendering.active;
        if(outpostRendering.active)renderer.shadowMap.needsUpdate = false;
        renderer.info.reset();
        storyMarkers?.update(camera,p.story?.targetSiteId);
        viewFrame++;
        if (lastQuality === "performance" || !renderEffects())
          renderer.render(scene, camera);
        if (cameraChanged) {
          element.dataset.cameraSwitchMs = (performance.now() - frameStarted).toFixed(1);
          element.dataset.cameraSwitchPrograms = String((renderer.info.programs?.length ?? 0) - programsBefore);
        }
        // A visible but occluded webview may deliver only one callback per second.
        // If scene work was quick, that cadence is not evidence of a weak GPU.
        if (browserThrottledFrame(frameInterval, performance.now() - frameStarted)) {
          metricStart = 0;
          metricFrames = 0;
          autoState.slow = autoState.fast = 0;
          backgroundProbe?.reset();
          element.dataset.measurementStatus = 'browser-throttled';
          element.dataset.fps = '';
          if (debugPanel.current)
            debugPanel.current.textContent = 'Waiting for active frames…';
          return;
        }
        if (element.dataset.measurementStatus !== 'active')
          element.dataset.measurementStatus = 'active';
        if (backgroundProbe && !backgroundProbe.done()) {
          const candidate = backgroundProbe.candidate();
          const eligible = worldActive && graphicsSampling.eligible && cameraSettings.current.quality === 'auto' && backgroundPrepared && lastQuality === candidate.profile && Math.abs(resolutionScale - candidate.scale) < .02;
          const decision = backgroundProbe.frame(frameInterval, performance.now() - frameStarted, eligible);
          if (decision) {
            autoProfile = decision.next.profile;
            autoState = createAutoGraphics(autoProfile, decision.next.scale);
            setAutoLabel(profileLabel());
            const measured = decision.selected ?? decision.trial;
            const report = decision.complete ? `${profileName(measured.profile)} · ${Math.round(measured.fps)} FPS measured.${measured.meetsTarget ? '' : ' Using the lightest settings; this device was below target.'}`
              : `${profileName(decision.trial.profile)} · ${Math.round(decision.trial.fps)} FPS. Checking ${profileName(decision.next.profile)} in the background…`;
            setAutoReport(report);
            current.current.onGraphicsCalibration?.(report);
            element.dataset.calibration = JSON.stringify(backgroundProbe.trials());
            element.dataset.calibrationFps = measured.fps.toFixed(1);
            element.dataset.calibrationProfile = measured.profile;
            element.dataset.calibrationState = decision.complete ? 'complete' : 'checking';
            element.dataset.calibrationMetTarget = String(measured.meetsTarget);
            if (decision.complete) {
              element.dataset.calibrationMs = (performance.now() - backgroundStarted).toFixed(0);
              // A slow device should not keep unused HDR buffers after the trial.
              if (decision.next.profile === 'performance') {
                disposeEffects();
                effectsLoading = null;
              }
            }
          }
        }
        // The ongoing governor excludes paused/landing frames after initial profiling.
        const activeSample = worldActive && graphicsSampling.eligible;
        if (metricActive !== activeSample) {
          metricActive = activeSample;
          metricStart = 0;
          metricFrames = 0;
          autoState = { ...autoState, slow: 0, fast: 0 };
        }
        if (!metricStart) {
          metricStart = time;
          metricFrames = 0;
        }
        else
          metricFrames++;
        if (time - metricStart > 1000) {
          element.dataset.cameraFov = String(camera.fov);
          element.dataset.daylightPhase = daylightPhase(daylightElapsed);
          element.dataset.nightBlend = nightBlend.toFixed(4);
          element.dataset.worldX = walker.x.toFixed(2);
          element.dataset.worldZ = walker.z.toFixed(2);
          element.dataset.outpostDoors = outpost.doors.map(door => `${door.id}:${door.amount.toFixed(2)}`).join(",");
          if (debug) element.dataset.outpostDoorStates = JSON.stringify(outpost.doors.map(door => ({id:door.id,amount:door.amount,target:door.target,waiting:door.waiting,blocked:door.blocked,clearSeconds:door.clearSeconds})));
          element.dataset.greenhouseDoors = greenhouses.doors.map(door => `${door.id}:${door.amount.toFixed(2)}`).join(",");
          element.dataset.garagePhase = garageState.phase;
          element.dataset.garageDoor = garageState.doorAmount.toFixed(3);
          element.dataset.garageBlocked = garageState.blocked;
          element.dataset.garageInverterWatts = String(garageState.inverterWatts ?? 0);
          element.dataset.garageInverterStatus = garageState.inverterStatus ?? "STANDBY";
          element.dataset.garageBatteryWh = garageState.batteryWh.toFixed(1);
          element.dataset.garageRepairActive = garageState.repairActive ? "true" : "false";
          element.dataset.garageChargingSource = garageState.chargingSource ?? "none";
          element.dataset.garageDockPopup = (garageState.phase === "parked" && !garageDockDismissedRef.current && (garageDockEnteredAt > 0 && time - garageDockEnteredAt < 5000)) ? "true" : "false";
          element.dataset.crewRoverX = rover.x.toFixed(3);
          element.dataset.roverCockpitScreens = String(bigRover?.cockpitScreens ?? 0);
          element.dataset.roverOccupant = rover.driving ? 'seated' : 'on-foot';
          element.dataset.crewRoverZ = rover.z.toFixed(3);
          element.dataset.crewRoverYaw = rover.yaw.toFixed(4);
          element.dataset.crewWheelRoll = rover.wheelRoll.toFixed(3);
          element.dataset.crewRoverBattery = rover.battery.toFixed(3);
          element.dataset.crewRoverSolarCharging = rover.solarCharging ? "true" : "false";
          element.dataset.crewRoverGarageCharging = rover.garageCharging ? "true" : "false";
          element.dataset.crewRoverSolarRate = rover.solarRate ? rover.solarRate.toFixed(4) : "0.0000";
          element.dataset.walkerY = (model.heightAt(walker.x, walker.z) + jump.height).toFixed(3);
          element.dataset.cameraYaw = cameraYaw.toFixed(4);
          element.dataset.trackTextureSize = String(model.trackTextureSize ?? 0);
          element.dataset.terrainChunks = String(streaming?.count() ?? 0);
          element.dataset.visibleTerrainChunks = String(streaming?.visibleCount() ?? 0);
          element.dataset.viewDistance = String(activeTier.viewDistance);
          if (debug) {
            element.dataset.textureCount = String(renderer.info.memory.textures);
            element.dataset.geometryCount = String(renderer.info.memory.geometries);
            element.dataset.triangles = String(renderer.info.render.triangles);
            element.dataset.renderedFrames = String(viewFrame);
            element.dataset.horizonDistance = String(camera.far);
            element.dataset.visibleHorizonPatches = String(regionalLandscape.visibleCount());
            element.dataset.horizonPatches = String(regionalLandscape.count);
            element.dataset.culledDetailObjects = String(detailCulling?.culled ?? 0);
          }
          element.dataset.fps = (metricFrames * 1000 / (time - metricStart)).toFixed(1);
          element.dataset.renderCalls = String(renderer.info.render.calls);
          element.dataset.shaderPrograms = String(renderer.info.programs?.length ?? 0);
          element.dataset.staticDrawCallsSaved = String(model.root.userData.staticDrawCallsSaved ?? 0);
          element.dataset.curiosityX = curiosity?.x.toFixed(2) ?? "";
          element.dataset.curiosityZ = curiosity?.z.toFixed(2) ?? "";
          element.dataset.curiosityPhase = curiosity?.phase ?? "";
          element.dataset.curiosityScans = String(curiosity?.scanCount ?? 0);
          element.dataset.resolutionScale = resolutionScale.toFixed(2);
          element.dataset.contactShading = String(occlusion?.enabled ?? false);
          element.dataset.bloom = String(bloom?.enabled ?? false);
          element.dataset.occlusionDepthSource = !occlusion?.enabled ? 'off' : occlusion.reusingSceneDepth ? 'scene' : 'normals';
          element.dataset.indoorRendering = outpostRendering.active ? (lastQuality === 'ultra' ? 'ultra' : 'simple') : 'outdoor';
          element.dataset.antialiasing = lastQuality !== 'performance' && composer && (outpostRendering.active || occlusion?.enabled || bloom?.enabled) ? "fxaa" : renderer.getContext().getContextAttributes()?.antialias ? "native" : "off";
          element.dataset.aaTexel = fxaaPass ? `${fxaaPass.uniforms.resolution.value.x},${fxaaPass.uniforms.resolution.value.y}` : "";
          const fps = metricFrames * 1000 / (time - metricStart);
          if (debugPanel.current)
            debugPanel.current.textContent = performanceReadout(cameraSettings.current.performanceMeter, {
              fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
              textures: renderer.info.memory.textures, scale: resolutionScale, tier: lastQuality,
            });
          element.dataset.graphicsProfile = lastQuality;
          if (cameraSettings.current.quality === 'auto' && true && (!backgroundProbe || backgroundProbe.done())) {
            autoState = adaptAutoGraphics(autoState, fps, activeSample, time, qualityCap, mobileMars ? 60 : AUTO_TARGET_FPS);
            if (autoProfile !== autoState.profile) {
              autoProfile = autoState.profile;
              setAutoLabel(profileLabel());
            }
          }
          metricStart = time;
          metricFrames = 0;
        }
      }
      dispose = () => {
        storyMarkers?.dispose();
        catchSite.dispose();
        scene.onBeforeRender = previousSceneRender;
        detailCulling?.dispose();
        outpost.dispose();
        greenhouses.dispose();
        garage.dispose();
        saveCuriosityNow();
        clearNoticeTimer();
        cancelAnimationFrame(frame);
        observer.disconnect();
        element.removeEventListener("pointerdown", down);
        element.removeEventListener("click", sceneClick);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        window.removeEventListener("keydown", keydown);
        window.removeEventListener("keyup", keyup);
        window.removeEventListener("blur", blur);
        element.removeEventListener("blur", blur);
        document.removeEventListener("pointerlockchange", lockChange);
        document.removeEventListener("pointerlockerror", lockError);
        window.removeEventListener("pagehide", saveCuriosityNow);
        window.removeEventListener("beforeunload", saveCuriosityNow);
        document.removeEventListener("visibilitychange", saveOnHide);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        if (document.pointerLockElement === element)
          document.exitPointerLock();
        renderer.dispose();
        disposeEffects();
        environment?.dispose();
        bigRover?.dispose();
        curiosityRover?.dispose();
        perseverance?.dispose();
        marsAstronaut?.dispose();
        streaming?.dispose();
        model.disposeTracks?.();
        disposeMarsSurfaceTextures(regolithSurface);
        scene.traverse((o) => {
          const m = o as Mesh;
          m.geometry?.dispose();
          if (m.material) {
            for (const material of Array.isArray(m.material)
              ? m.material
              : [m.material]) {
              const mapped = material as import("three").MeshStandardMaterial;
              mapped.map?.dispose();
              mapped.bumpMap?.dispose();
              mapped.normalMap?.dispose();
              mapped.roughnessMap?.dispose();
              mapped.metalnessMap?.dispose();
              mapped.emissiveMap?.dispose();
              mapped.alphaMap?.dispose();
              material.dispose();
            }
          }
        });
        renderer.domElement.remove();
      };
      {
        setLoadingStage("Preparing rover and explorer…");
        setLoadingProgress(80);
        await Promise.all([bigRover?.ready, curiosityRover?.ready, marsAstronaut?.ready]);
        if (cancelled)
          return;
        setLoadingStage("Preparing materials and light…");
        setLoadingProgress(88);
        camera.position.set(.22, 2.8, 17.8);
        camera.rotation.set(pitch, 0, 0, "YXZ");
        astronaut.position.set(0, 0, 12);
        try {
          const preset = tierFor(effectiveQuality());
          lastQuality = effectiveQuality();
          garage.setPerformance(lightRendering());
          model.setLightSurfaces?.(lightRendering());
          resolutionScale = qualityCap(effectiveQuality());
          renderer.setPixelRatio(resolutionScale);
          resize();
          renderer.shadowMap.enabled = preset.shadows;
          const nightShadow = preset.shadows && (false);
          if (bigRover) {
            bigRover.headlightL.castShadow = nightShadow;
            bigRover.headlightR.castShadow = false;
            bigRover.update(rover, rover.chassisY, 0, false, model.roverHeightAt, undefined, preset.shadows);
          }
          if (curiosityRover && curiosity) {
            curiosityRover.update(curiosity, 0, false, reduced.matches, preset.shadows);
          }
          if (smallRocks)
            smallRocks.count = preset.smallRocks;
          if (dust)
            dust.geometry.setDrawRange(0, preset.particles);
          // Upload maps not yet visible (cockpit, rear surfaces and custom soil uniforms).
          const textures = new Set<import("three").Texture>();
          scene.traverse(o => {
            if (o instanceof T.Mesh)
              for (const m of Array.isArray(o.material) ? o.material : [o.material])
                for (const value of Object.values(m))
                  if (value instanceof T.Texture)
                    textures.add(value);
          });
          if (regolithSurface)
            for (const surface of Object.values(regolithSurface)) {
              textures.add(surface.color);
              textures.add(surface.relief);
            }
          for (const texture of textures)
            renderer.initTexture(texture);
          await renderer.compileAsync(scene, camera);
          if (cancelled)
            return;
          // Upload the small historical-site model before it is approached during play.
          if (perseverance) {
            camera.position.copy(perseverance.root.position).add(new T.Vector3(4, 3, 5));
            camera.lookAt(perseverance.root.position);
            renderer.render(scene, camera);
          }
          // Upload both camera views while the loading screen is still covering them.
          if (lastQuality !== "performance") {
            bigRover?.setCockpitView(true);
            bigRover?.update(rover, rover.chassisY, 0, false, model.roverHeightAt);
            bigRover?.positionCockpitCamera(camera, 0, -.04);
            renderer.render(scene, camera);
            configureEffects(true);
            bigRover?.setCockpitView(false);
            camera.position.set(rover.x, rover.chassisY + 4, rover.z + 8);
            camera.lookAt(rover.x, rover.chassisY + 1.8, rover.z);
            renderer.render(scene, camera);
            configureEffects(true);
          }
          camera.position.set(.22, 2.8, 17.8);
          camera.rotation.set(pitch, 0, 0, "YXZ");
          renderer.render(scene, camera);
          configureEffects(true);
        }
        catch { /* A missing optional GPU feature must not prevent the basic scene from rendering. */ }
        finally {
          scene.overrideMaterial = null;
          renderer.setRenderTarget(null);
        }
      }
      if (cancelled)
        return;
      {
        setLoadingStage("Fully rendering Mars landscape & terrain…");
        setLoadingProgress(92);
        const ground = model.root.getObjectByName("mars-ground") as import("three").Mesh;
        model.obstacles.push(...createExplorationBoundaryObstacles());
        streaming = createStreamedMars(model.root, ground, baseHeight, { ...terrainBudget, obstacles: model.obstacles, sampleHeight: marsOutpostHeight, clearings: [PERSEVERANCE_CLEARING] });
        streaming.setPerformance(lastQuality === 'performance');
        // Fully generate all terrain chunks and rock instances within radius during loading
        streaming.update(walker.x, walker.z, 50);
        while (streaming.pending()) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          if (cancelled)
            return;
          streaming.update(walker.x, walker.z, 50);
        }
        const coverage = streaming.coverage();
        regionalLandscape?.setCoverage(coverage.x, coverage.y, coverage.z, coverage.w);
        (scene.fog as import("three").FogExp2).density = tierFor(lastQuality).fogDensity;
      }
      if (cancelled)
        return;
      {
        setLoadingStage("Compiling visual shaders & touchdown sequence…");
        setLoadingProgress(96);
        try {
          // Prepare post-processing effects during loading so no compilation stalls touchdown
          if (effectsSupported && wantsEffects() && lastQuality !== "performance") {
            await prepareEffects();
            if (cancelled)
              return;
          }

          configureEffects(true);

          // Warm up the ground exploration view
          camera.position.set(.22, 2.8, 17.8);
          camera.rotation.set(pitch, 0, 0, "YXZ");
          // Auto starts in Performance but may upgrade later. Prepare the
          // shadowed output path the device will use before exposing the world.
          if (cameraSettings.current.quality !== "performance" && (!mobileMars || cameraSettings.current.quality !== "auto")) {
            garage.setPerformance(false);
            model.setLightSurfaces?.(false);
            renderer.shadowMap.enabled = true;
            helmetLamp.castShadow = true;
            if (effectsSupported && wantsEffects()) {
              await prepareEffects();
              if (cancelled) return;
            }
            const warmComposer = composer as import("three/examples/jsm/postprocessing/EffectComposer.js").EffectComposer | null;
            if (warmComposer) {
              await prepareWorldMaterials(renderer,scene,camera,warmComposer.readBuffer,true);
              if (cancelled) return;
              const renderToScreen = warmComposer.renderToScreen;
              const warmOcclusion = occlusion as import("./world/BoundedGTAOPass").BoundedGTAOPass | null;
              const warmBloom = bloom as import("three/examples/jsm/postprocessing/UnrealBloomPass.js").UnrealBloomPass | null;
              warmComposer.renderToScreen = false;
              if (warmOcclusion) warmOcclusion.enabled = true;
              if (warmBloom) warmBloom.enabled = !reduced.matches;
              try {
                warmComposer.render();
                // Both depth sources are prepared before a later Auto upgrade
                // or manual tier change can expose a new fullscreen shader.
                if (warmOcclusion) {
                  warmOcclusion.setReuseSceneDepth(true);
                  warmComposer.render();
                  warmOcclusion.setReuseSceneDepth(false);
                }
              } finally {
                warmComposer.renderToScreen = renderToScreen;
              }
            } else {
              await prepareWorldMaterials(renderer,scene,camera,null,true);
              if (cancelled) return;
            }
          }
          garage.setPerformance(lightRendering());
          model.setLightSurfaces?.(lightRendering());
          renderer.shadowMap.enabled = tierFor(lastQuality).shadows;
          helmetLamp.castShadow = tierFor(lastQuality).shadows;
          await prepareWorldMaterials(renderer,scene,camera);
          if (cancelled) return;
          resize();
          renderer.render(scene, camera);
          configureEffects(true);
        }
        catch { /* Keep direct renderer if optional effects are unavailable */ }
        finally {
          if (!cancelled) {
            scene.overrideMaterial = null;
            renderer.setRenderTarget(null);
            garage.setPerformance(lightRendering());
            model.setLightSurfaces?.(lightRendering());
            renderer.shadowMap.enabled = tierFor(effectiveQuality()).shadows;
            helmetLamp.castShadow = tierFor(effectiveQuality()).shadows;
            resize();
            configureEffects();
            backgroundPrepared = true;
            backgroundProbe?.reset();
            metricStart = 0;
            metricFrames = 0;
          }
        }
      }
      if (cancelled)
        return;
      applyQuality(effectiveQuality(), resolutionScale);
      detailCulling = createDetailDistanceCulling(scene, object =>
        !object.frustumCulled || object.userData.marsHorizon === true || object === skyMesh || object === sun || object === earth || object === starField);
      scene.onBeforeRender = function (render, renderScene, viewCamera, geometry, material, group) {
        previousSceneRender.call(this, render, renderScene, viewCamera, geometry, material, group);
        if (viewCamera !== camera || culledFrame === viewFrame) return;
        // The renderer has updated world matrices; reuse these results for AO passes.
        culledFrame = viewFrame;
        regionalLandscape.updateVisibility(camera);
        detailCulling?.update(camera, tierFor(lastQuality).viewDistance);
      };
      if (backgroundProbe) {
        backgroundStarted = performance.now();
        const report = 'Checking FPS in the background…';
        setAutoReport(report);
        current.current.onGraphicsCalibration?.(report);
        element.dataset.calibrationState = 'checking';
        element.dataset.calibrationTarget = String(mobileMars ? 60 : AUTO_TARGET_FPS);
      }
      current.current.onTerrainMode?.(!!streaming);
      catchSite.settle();
      element.dataset.catchSite='ready';
      element.dataset.terrainMode = "bounded-mola";
      frame = requestAnimationFrame(animate);
      setLoadingStage("Launching exploration…");
      setLoadingProgress(100);
      setLoaded(true);
      current.current.onReady?.();
      element.dataset.loadMs = (performance.now() - loadStarted).toFixed(0);
    }
    mount().catch((error) => {
      if (cancelled) return;
      dispose();
      dispose = () => {};
      if (debug)
        console.error('Mars scene initialization failed', error);
      setMessage("3D is unavailable. Retry with Performance graphics.");
      current.current.onUnavailable();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(backgroundTimer);
      if (baseShieldTimeoutRef.current) window.clearTimeout(baseShieldTimeoutRef.current);
      if (baseShieldFadeTimeoutRef.current) window.clearTimeout(baseShieldFadeTimeoutRef.current);
      if (roverShieldTimeoutRef.current) window.clearTimeout(roverShieldTimeoutRef.current);
      if (roverShieldFadeTimeoutRef.current) window.clearTimeout(roverShieldFadeTimeoutRef.current);
      dispose();
    };
  }, [openPhone]);
  const touch = useCallback((key: string, on: boolean) => {
    if (key === "f") {
      if (on)
        toggleRoverAction.current();
      return;
    }
    if (on) {
      host.current?.focus();
      controls.current.add(key);
    }
    else
      controls.current.delete(key);
  }, []);
  const handleWalkAxes = useCallback((axes: MoveAxes) => {
    analogWalk.current = axes;
  }, []);
  const handleDriveAxes = useCallback((axes: RoverAnalogInput) => {
    analogDrive.current = axes;
  }, []);
  const handleToggleView = useCallback(() => setThirdPerson((v) => !v), []);
  const handleToggleRover = useCallback(() => toggleRoverAction.current(), []);
  const handleInspectNearby = useCallback(() => inspectAction.current(), []);
  const phoneDose = props.story ? props.story.simulatedDose ?? 0 : radiationExposure;
  const exposureClass = radiationExposure >= 70 ? "critical" : radiationExposure >= 30 ? "caution" : "nominal";
  const healthClass = astronautHealth < 30 ? "critical" : astronautHealth < 60 ? "warning" : "nominal";
  const blurAmount = radiationExposure >= 35 ? Math.min(8, ((radiationExposure - 35) / 65) * 8) : 0;
  const vignetteAlpha = radiationExposure >= 35 ? Math.min(0.75, ((radiationExposure - 35) / 65) * 0.75) : 0;

  const healthDamage = Math.max(0, Math.min(1, (100 - astronautHealth) / 100));
  const centerRedAlpha = (healthDamage * 0.72).toFixed(3);
  const midRadius = Math.max(20, Math.round(75 - healthDamage * 50));
  const midRedAlpha = Math.min(0.90, healthDamage * 0.85 + 0.10).toFixed(3);
  const edgeRedAlpha = Math.min(0.96, healthDamage * 0.90 + 0.18).toFixed(3);
  const healthGradient = healthDamage > 0
    ? `radial-gradient(circle at center, rgba(220, 38, 38, ${centerRedAlpha}) 0%, rgba(185, 28, 28, ${midRedAlpha}) ${midRadius}%, rgba(127, 29, 29, ${edgeRedAlpha}) 100%)`
    : undefined;

  const currentRadiationHourly = (
    0.21 +
    (spaceWeather.sepFluxPFU >= 10
      ? (0.6 + Math.log10(spaceWeather.sepFluxPFU) * 1.4) * 3.6
      : spaceWeather.sepFluxPFU * 0.04)
  ).toFixed(2);

  return (<div ref={host} className="sv-world" data-touch={touchControlsActive ? "true" : "false"} data-phone-open={phoneOpen} data-arrival-covered={Boolean(props.coveredByArrival)} inert={props.coveredByArrival} aria-hidden={props.coveredByArrival||undefined} data-cursor-free={cursorFree ? "true" : "false"} role="application" aria-label={`Mars open world. ${touchControlsActive ? "Use the left thumbstick to move, drag the screen to look around, and tap the right buttons to jump or inspect." : `WASD to walk. Drag to look or capture the mouse; Q and R also turn. Space jumps. V switches view. E inspects. P or Up Arrow opens the radiation phone.${props.story ? "" : " Y toggles space weather mode."} M opens map.`}`} tabIndex={0} onClick={() => geigerAudio.current?.resume()} onKeyDown={() => geigerAudio.current?.resume()}>
    {/* Fullscreen Radiation Vision Effects (Vision Blur & Vignette) */}
    <div
      className={`mars-radiation-overlay ${radiationExposure >= 70 ? "critical-ars" : ""}`}
      style={{
        backdropFilter: blurAmount > 0 ? `blur(${blurAmount.toFixed(1)}px)` : undefined,
        WebkitBackdropFilter: blurAmount > 0 ? `blur(${blurAmount.toFixed(1)}px)` : undefined,
        boxShadow: vignetteAlpha > 0 ? `inset 0 0 ${Math.round(60 + (radiationExposure - 35) * 1.5)}px rgba(220, 38, 38, ${vignetteAlpha.toFixed(2)})` : undefined,
      }}
      aria-hidden="true"
    />
    {/* Dynamic Health Damage Red Vignette Expanding Toward Screen Center */}
    <div
      className={`mars-health-damage-overlay ${astronautHealth > 0 && astronautHealth < 35 ? "critical-pulse" : ""}`}
      style={{
        opacity: healthDamage > 0 ? 1 : 0,
        background: healthGradient,
      }}
      aria-hidden="true"
    />
   {performanceMeter !== "off" && true && (debug || props.enabled) &&
      <pre key={performanceMeter} ref={debugPanel} className="mars-debug" data-mode={performanceMeter} aria-label="Graphics performance diagnostics">Measuring FPS…</pre>}
   {!loaded && (<div className="sv-loading" role="status">
     <div className="sv-loading-title">{loadingStage}</div>
     <div className="sv-loading-progress-wrap">
       <progress aria-label="Scene preparation progress" max={100} value={loadingProgress}/>
       <span> {loadingProgress}%</span>
     </div>
     <div className="sv-loading-hints" aria-label="Rover controls">
       <span className="sv-loading-hints-title">ROVER CONTROLS</span>
       {touchControlsActive ? <div className="sv-loading-hints-list"><span>Left stick moves</span><span>Swipe to look</span><span>Tap the action buttons</span></div> : <div className="sv-loading-hints-list">
         <span><b>Shift</b> Boost (High Torque)</span>
         <span><b>W / S</b> Drive / Rev</span>
         <span><b>A / D</b> Steer</span>
         <span><b>Space</b> Handbrake</span>
         <span><b>V</b> Camera</span>
       </div>}
     </div>
    </div>)}
   {props.enabled && (<>
     <div ref={aim} className="sv-aim" aria-hidden="true">
      <i />
      <i />
     </div>
     <div className="sv-look-controls" data-ui-zone="settings">
       <button className="flight-menu-trigger" type="button" aria-label="Camera and graphics" aria-haspopup="dialog" onClick={props.onOpenMenu}>
         <Settings2 size={19} aria-hidden="true" />{!touchControlsActive && "Flight console"}
       </button>
     </div>
     {roverNear && !roverDriving && !touchControlsActive && (<div className="sv-rover-prompt">
       <button type="button" className="sv-rover-prompt-btn" onClick={() => toggleRoverAction.current()}>
        <span className="sv-key-badge">F</span> Drive Exploration Rover
       </button>
      </div>)}
     {repairTarget && !roverDriving && (
      <div className="sv-rover-prompt sv-eva-prompt" role="region" aria-label="EVA Component Maintenance">
       <button
         type="button"
         className="sv-rover-prompt-btn sv-eva-repair-btn"
         onClick={() => repairAction.current()}
         disabled={playerScrap <= 0}
       >
        <span className="sv-key-badge">E</span> Repair {repairTarget.name} ({repairTarget.health}%) · 1 Scrap
       </button>
       <span className="sv-eva-scrap-pill">
         Scrap: <b>{playerScrap}</b>
       </span>
      </div>
     )}
     {roverDriving && (<div className={`sv-rover-hud${!thirdPerson ? " sv-rover-hud-cockpit" : ""}`} role="region" aria-label="Rover Vehicle HUD">
       <div className="sv-rover-schematic" role="img" aria-label="Rover Component Diagnostics Schematic">
        <svg viewBox="0 0 100 120" className="sv-schematic-svg" aria-hidden="true">
         <rect x="24" y="18" width="52" height="84" rx="8" className="sv-schematic-chassis" />
         <line x1="24" y1="46" x2="76" y2="46" className="sv-schematic-grid" />
         <line x1="24" y1="74" x2="76" y2="74" className="sv-schematic-grid" />
         <rect
           x="33" y="26" width="34" height="42" rx="3"
           className={`sv-schematic-part ${getPartDamageClass(roverDamage.cabin_roof ?? roverDamage.solar_array ?? 100)}`}
         >
          <title>{`Cabin Roof & Solar Array: ${Math.round(roverDamage.cabin_roof ?? roverDamage.solar_array ?? 100)}%`}</title>
         </rect>
         <rect
           x="8" y="22" width="13" height="24" rx="3"
           className={`sv-schematic-part ${getPartDamageClass(roverDamage.wheel_fl)}`}
         >
          <title>{`Front-Left Wheel: ${Math.round(roverDamage.wheel_fl)}%`}</title>
         </rect>
         <rect
           x="79" y="22" width="13" height="24" rx="3"
           className={`sv-schematic-part ${getPartDamageClass(roverDamage.wheel_fr)}`}
         >
          <title>{`Front-Right Wheel: ${Math.round(roverDamage.wheel_fr)}%`}</title>
         </rect>
         <rect
           x="8" y="52" width="13" height="24" rx="3"
           className={`sv-schematic-part ${getPartDamageClass(roverDamage.wheel_ml)}`}
         >
          <title>{`Mid-Left Wheel: ${Math.round(roverDamage.wheel_ml)}%`}</title>
         </rect>
         <rect
           x="79" y="52" width="13" height="24" rx="3"
           className={`sv-schematic-part ${getPartDamageClass(roverDamage.wheel_mr)}`}
         >
          <title>{`Mid-Right Wheel: ${Math.round(roverDamage.wheel_mr)}%`}</title>
         </rect>
         <rect
           x="8" y="82" width="13" height="24" rx="3"
           className={`sv-schematic-part ${getPartDamageClass(roverDamage.wheel_rl)}`}
         >
          <title>{`Rear-Left Wheel: ${Math.round(roverDamage.wheel_rl)}%`}</title>
         </rect>
         <rect
           x="79" y="82" width="13" height="24" rx="3"
           className={`sv-schematic-part ${getPartDamageClass(roverDamage.wheel_rr)}`}
         >
          <title>{`Rear-Right Wheel: ${Math.round(roverDamage.wheel_rr)}%`}</title>
         </rect>
        </svg>
        <span className="sv-schematic-title">DAMAGE</span>
        {garageDockPopup.repairActive && <span className="sv-schematic-auto-repair">🔧 AUTO-REPAIRING IN GARAGE</span>}
       </div>
       <div className="sv-rover-gearbox" data-gear={roverGear} aria-label={`Transmission gear ${roverGear === "B" ? "BOOST" : roverGear}`}>
        <div className="sv-gear-rail" aria-hidden="true">
         {(["R", "N", "D", "B"] as const).map((g) => (
           <span key={g} className={`${roverGear === g ? "active" : ""} ${g === "B" ? "gear-boost" : ""}`}>
             {g === "B" ? "BST" : g}
           </span>
         ))}
        </div>
        <strong className="sv-gear-active">{roverGear === "B" ? "BOOST" : roverGear}</strong>
        <small className={roverGear === "B" ? "sv-boost-alert" : ""}>
          {roverGear === "B" ? "HIGH TORQUE · 3X DRAIN" : roverGear === "D" ? "DRIVE" : roverGear === "R" ? "REVERSE" : "NEUTRAL"}
        </small>
       </div>
       <div className="sv-rover-speedometer">
        <strong className={roverBoost ? "boost-speed" : ""}>{roverSpeed}</strong>
        <span>KM/H</span>
        <small className={roverBoost ? "boost-alert" : roverMud ? "mud-alert" : ""}>
         {roverHandbrake ? "PARK BRAKE" : roverBoost ? "BOOST OVERDRIVE · HIGH TORQUE" : roverMud ? "SOFT MUD · TRACKS" : "6x6 INDEPENDENT"}
        </small>
       </div>
       <div className="sv-rover-power-grid" aria-label="Rover onboard power grid">
        <div className="sv-rover-battery-header">
         <span className="sv-battery-title">⚡ BATTERY</span>
         <span className={`sv-battery-value ${roverBattery < 20 ? "low" : roverBattery < 40 ? "warning" : "nominal"}`}>
          {roverGarageCharging ? (
            <span style={{ color: "#38bdf8", marginRight: 4, fontWeight: 800 }}>
              {garageDockPopup.chargingSource === "base-solar" ? "☀️BASE SOLAR" : "⚡BASE"}
            </span>
          ) : roverSolarCharging ? (
            <span style={{ color: "#4ade80", marginRight: 4, fontWeight: 800 }}>+⚡</span>
          ) : null}
          {Math.round(roverBattery)}%
         </span>
        </div>
        <div className="sv-rover-battery-bar" role="progressbar" aria-valuenow={Math.round(roverBattery)} aria-valuemin={0} aria-valuemax={100}>
         <div
           className={`sv-rover-battery-fill ${roverBattery < 20 ? "critical" : roverBattery < 40 ? "warning" : "nominal"}`}
           style={{ width: `${Math.max(0, Math.min(100, roverBattery))}%` }}
         />
        </div>
        <div className="sv-rover-range">
         <span className="sv-range-label">RANGE</span>
         <strong className={`sv-range-val ${roverBoost ? "boost-drain" : ""}`}>{roverRangeDisplay}</strong>
        </div>
       </div>
       <div
         className={`sv-rover-solar-status ${roverGarageCharging ? "garage-charging" : roverSolarCharging ? "charging" : "dormant"}`}
         title={
           roverGarageCharging
             ? garageDockPopup.chargingSource === "base-solar"
               ? "Base Solar Array Active: charging rover battery from base solar panels (1,200W)"
               : "Base Inverter Dock Active: charging rover battery from base energy storage"
             : roverSolarCharging
               ? "Solar arrays active: regenerating onboard battery"
               : "Solar arrays dormant"
         }
         aria-label={
           roverGarageCharging
             ? garageDockPopup.chargingSource === "base-solar"
               ? "Charging via base solar panels"
               : "Base inverter charging rover"
             : roverSolarCharging
               ? "Solar panels generating charge"
               : "Solar panels dormant"
         }
       >
        <span className="sv-solar-icon" aria-hidden="true">
          {roverGarageCharging ? (garageDockPopup.chargingSource === "base-solar" ? "☀️" : "⚡") : "☀️"}
        </span>
        <div className="sv-solar-meta">
         <span className="sv-solar-title">
           {roverGarageCharging ? (garageDockPopup.chargingSource === "base-solar" ? "BASE SOLAR" : "BASE INVERTER") : "SOLAR"}
         </span>
         <small className="sv-solar-state">
           {roverGarageCharging ? (garageDockPopup.chargingSource === "base-solar" ? "+BASE SOLAR" : "+BASE CHARGE") : roverSolarCharging ? "+CHARGING" : "STANDBY"}
         </small>
        </div>
       </div>
       {roverShieldHudActive && (
         <div
           className="sv-rover-shield-status"
           role="status"
           aria-label="Rover radiation shield 50%"
           title="Rover Pressurized Chassis Shielding: 50% mitigation (0.5x radiation damage)"
         >
           <span className="sv-shield-icon" aria-hidden="true">
             <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
               <path d="M12 7v10" strokeDasharray="2 2" />
             </svg>
           </span>
           <div className="sv-shield-meta">
             <span className="sv-shield-title">SHIELD</span>
             <strong className="sv-shield-val">50% ROVER</strong>
             <small className="sv-shield-sub">0.5x DRAIN</small>
           </div>
         </div>
       )}
       <button type="button" className="sv-rover-exit-btn" onClick={() => toggleRoverAction.current()}>
        <span className="sv-key-badge">F</span> Exit Rover
       </button>
      </div>)}
      {/* Garage Docking & Maintenance Bay Popup Banner */}
      {garageDockPopup.visible && (
        <aside className="mars-garage-dock-popup" role="status" aria-live="polite">
          <div className={`mars-garage-dock-pulse ${garageDockPopup.chargingSource === "base-solar" ? "solar" : "inverter"}`} aria-hidden="true" />
          <div className="mars-garage-dock-content">
            <div className="mars-garage-dock-header">
              <span className="mars-garage-dock-badge">GARAGE DOCK & MAINTENANCE BAY</span>
              <button
                type="button"
                className="mars-garage-dock-close"
                onClick={() => setGarageDockDismissed(true)}
                title="Dismiss notification"
                aria-label="Dismiss garage notification"
              >
                ✕
              </button>
            </div>
            <div className="mars-garage-dock-body">
              <strong>
                {garageDockPopup.chargingSource === "base-solar"
                  ? "☀️ Charging via Base Solar Panels (1,200W Array)"
                  : garageDockPopup.chargingSource === "base-inverter"
                    ? "⚡ Charging via Base Battery Inverter"
                    : "⚡ Base Dock Connected"}
              </strong>
              <span>
                {garageDockPopup.repairActive
                  ? `🔧 Auto-repairing damaged rover components · Battery: ${Math.round(roverBattery)}%`
                  : props.story && !props.story.command.chargingAllowed
                    ? `Rover battery: ${Math.round(roverBattery)}% · Charging paused by your power plan`
                  : roverBattery < 99.9
                    ? `⚡ Recharging rover battery: ${Math.round(roverBattery)}% (+0.35%/s) · All systems nominal`
                    : "✓ Rover 100% Charged & Fully Repaired"}
              </span>
            </div>
          </div>
        </aside>
      )}
      {/* Solar Energetic Particle Alert Banner */}
      {!props.story && spaceWeather.sepFluxPFU >= 10 && !isShielded && (Date.now() - sepAlertDismissedTime > 60000) && (
        <aside className="mars-sep-alert-banner" role="alert" aria-live="assertive">
          <div className="mars-sep-alert-pulse" aria-hidden="true" />
          <div className="mars-sep-alert-text">
            <strong>
              ALERT: SOLAR ENERGETIC PARTICLE STORM (SEP: {spaceWeather.sepFluxPFU < 10 ? spaceWeather.sepFluxPFU.toFixed(1) : Math.round(spaceWeather.sepFluxPFU).toLocaleString()} PFU · {spaceWeather.stormScale})
            </strong>
            <span>
              {spaceWeather.activeEvent ? `${spaceWeather.activeEvent.name} [${spaceWeather.activeEvent.flareClass}] — ` : ""}
              SEEK OUTPOST OR HABITAT SHELTER IMMEDIATELY
            </span>
          </div>
          <button
            type="button"
            className="mars-popup-close-btn"
            onClick={() => setSepAlertDismissedTime(Date.now())}
            aria-label="Dismiss storm alert"
            title="Dismiss alert"
          >
            ✕
          </button>
        </aside>
      )}


      {/* Environmental Radiation Shielding Notifications (Base 100% / Rover 50%) */}
      {baseShieldPopup.visible && (
        <aside
          className={`mars-shield-popup base ${baseShieldPopup.fading ? "fading" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Habitat Base Shield Active: 100%"
        >
          <div className="mars-shield-popup-pulse base" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="mars-shield-popup-content">
            <div className="mars-shield-popup-header">
              <span className="mars-shield-popup-badge base">ENVIRONMENTAL PROTECTION</span>
              <span className="mars-shield-popup-metric base">0x DAMAGE · 100% MITIGATION</span>
            </div>
            <div className="mars-shield-popup-body">
              <strong>SHIELD ACTIVE: 100% (HABITAT)</strong>
              <span>Habitat radiation deflection engaged · Complete environmental isolation</span>
            </div>
          </div>
          <button
            type="button"
            className="mars-popup-close-btn"
            onClick={dismissBaseShieldPopup}
            aria-label="Dismiss habitat shield notification"
            title="Dismiss notification"
          >
            ✕
          </button>
        </aside>
      )}

      {roverShieldPopup.visible && (
        <aside
          className={`mars-shield-popup rover ${roverShieldPopup.fading ? "fade-minimize" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Rover Shield Active: 50%"
        >
          <div className="mars-shield-popup-pulse rover" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 7v10" strokeDasharray="2 2" />
            </svg>
          </div>
          <div className="mars-shield-popup-content">
            <div className="mars-shield-popup-header">
              <span className="mars-shield-popup-badge rover">VEHICLE PROTECTION</span>
              <span className="mars-shield-popup-metric rover">0.5x DAMAGE · 50% MITIGATION</span>
            </div>
            <div className="mars-shield-popup-body">
              <strong>SHIELD ACTIVE: 50% (ROVER)</strong>
              <span>Pressurized chassis deflection engaged · Minimizing to cockpit HUD</span>
              <span className="rover-camera-hint">{touchControlsActive ? "Tap the camera button to switch camera view." : "Press V to switch camera view."}</span>
            </div>
          </div>
          <button
            type="button"
            className="mars-popup-close-btn"
            onClick={dismissRoverShieldPopup}
            aria-label="Dismiss rover shield notification"
            title="Dismiss notification"
          >
            ✕
          </button>
        </aside>
      )}

        {/* Mobile Top Pill Button (When Phone is Closed on Mobile Touch) */}
        {touchControlsActive && !phoneOpen && (
          <button
            type="button"
            className="mars-phone-mobile-pill"
            onClick={openPhone}
            aria-label="Open Mars Telemetry Communicator"
            title="Open Mars Communicator"
          >
            <span className="mars-mobile-pill-icon">📱</span>
            <span className="mars-mobile-pill-rad">{currentRadiationHourly} <small>mSv/h</small></span>
            <span className={`mars-mobile-pill-dose ${exposureClass}`}>{radiationExposure.toFixed(1)} <small>mSv</small></span>
          </button>
        )}

        {/* Desktop Launcher button */}
        {!touchControlsActive && !phoneOpen && (
          <button type="button" className="mars-phone-launcher" data-ui-zone="phone" aria-label="Open radiation phone" onClick={openPhone}>
            <Smartphone size={19} aria-hidden="true"/> <span>Field phone</span> <kbd>P / ↑</kbd>
          </button>
        )}
    </>)}

          <dialog ref={phoneDialog} className="mars-phone-modal" aria-label="Radiation phone"
        onCancel={event => { event.preventDefault(); closePhone(); }}
        onClose={event => {
          if (!event.currentTarget.open) { closePhone(); setSepInfoOpen(false); }
        }}>
      <div className={`mars-radiation-hud gta-phone phone-open${touchControlsActive ? " touch-mode" : ""}${roverDriving ? " driving" : ""}`} data-app={activePhoneTab}>
        <div className="mars-phone-top-bar">
          {/* Pages and Sites serve this local asset directly, without a Next image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mars-phone-brand-logo" src={assetUrl('/branding/tarukh-phone-logo.webp')} alt="TARUKH" width="90" height="46" loading="eager" decoding="async" draggable={false} />
          <div className="handset-hardware" aria-hidden="true"><i className="handset-camera"/><i className="handset-speaker"/></div>
          <button type="button" className="mars-bezel-btn" onClick={closePhone} aria-label="Minimize phone" title="Put phone away · P / Esc">
            <ChevronDown size={20} aria-hidden="true"/>
          </button>
        </div>
        <div className="mars-phone-screen">
          <div className="mars-phone-status-bar">
            <button type="button" className="mars-sat-link-btn" onClick={toggleSpaceWeatherMode} title="Switch live observations / archive replay · Y">
              <span className="sat-title">SAT-LINK</span>
              <span className={`sat-badge ${spaceWeather.mode}`}>
                {spaceWeather.mode === "live" ? (spaceWeather.isLiveConnected ? "LIVE" : "OFFLINE") : "REPLAY"}
              </span>
            </button>
            <span className="handset-unit">EVA–01</span>
          </div>
          <h2 ref={phoneHeading} className="mars-phone-app-title" tabIndex={-1}>
            {{home:'Your field phone',telemetry:'Radiation',systems:'Systems',data:'Space weather archive',settings:'Settings'}[activePhoneTab]}
          </h2>
          <div ref={phoneContent} className="mars-phone-content">
          {/* Tab 1: Telemetry (Icon-Driven 3 - 2 - 3 Minimal Grid Layout) */}
          {activePhoneTab === "telemetry" && (
            <div className="mars-phone-tab-content">
              {/* Row 1: Top 3 Icon Cards */}
              <div className="mars-phone-grid-3">
                {/* Radiation level reports the source proton flux in PFU. */}
                <div className="mars-grid-card">
                  <div className="mars-card-icon rad-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <circle cx="12" cy="12" r="2.5" />
                      <path d="M12 2A10 10 0 0 0 3.34 7l3.46 6A6 6 0 0 1 12 8V2z" />
                      <path d="M20.66 7A10 10 0 0 0 12 2v6a6 6 0 0 1 5.2 5l3.46-6z" />
                      <path d="M12 16a6 6 0 0 1-5.2-3L3.34 19A10 10 0 0 0 20.66 19l-3.46-6A6 6 0 0 1 12 16z" />
                    </svg>
                  </div>
                  <span className="mars-card-label">Radiation level</span>
                  <span className="mars-card-val">
                    <b>{spaceWeather.sepFluxPFU < 10 ? spaceWeather.sepFluxPFU.toFixed(2) : Math.round(spaceWeather.sepFluxPFU).toLocaleString()}</b>
                    <small> PFU</small>
                  </span>
                  <div className="mars-card-mini-meter">
                    <i className={`m-seg ${spaceWeather.sepFluxPFU > 0.1 ? "active-green" : ""}`} />
                    <i className={`m-seg ${spaceWeather.sepFluxPFU >= 10 ? "active-amber" : ""}`} />
                    <i className={`m-seg ${spaceWeather.sepFluxPFU >= 100 ? "active-orange" : ""}`} />
                    <i className={`m-seg ${spaceWeather.sepFluxPFU >= 1000 ? "active-red" : ""}`} />
                    <i className={`m-seg ${spaceWeather.sepFluxPFU >= 10000 ? "active-crimson" : ""}`} />
                  </div>
                </div>

                {/* Box 2: ⚛️ Atom/Orbital Icon (Storm Scale) */}
                <div className="mars-grid-card">
                  <div className="mars-card-icon atom-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                      <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(30 12 12)" />
                      <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-30 12 12)" />
                    </svg>
                  </div>
                  <span className="mars-card-label">STORM SCALE</span>
                  <span className={`mars-card-val scale-${spaceWeather.stormScale.slice(0, 2).toLowerCase()}`}>
                    <b>{spaceWeather.stormScale.split(" ")[0]}</b>
                    <small> {spaceWeather.stormScale.split(" ")[1] ?? "NORM"}</small>
                  </span>
                </div>

                {/* Box 3: ⚡ Solar Flare / Lightning Icon */}
                <div
                  className="mars-grid-card clickable"
                  onClick={toggleSpaceWeatherMode}
                  title="Click to toggle Live Feed vs NASA Archive [Hotkey Y]"
                >
                  <div className="mars-card-icon flare-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <span className="mars-card-label">SOLAR FLARE</span>
                  <span className="mars-card-val flare-val">
                    <b>{spaceWeather.activeEvent?.flareClass ?? (spaceWeather.mode === "live" ? "NOAA" : "QUIET")}</b>
                  </span>
                </div>
              </div>

              {/* Row 2: Middle 2 Wide Horizontal Illustrated Progress Bars */}
              {/* Card 4: 🛡️ Shield Icon + Radiation Dose */}
              <div className="mars-phone-bar-card rad-bar-card">
                <div className="mars-bar-card-header">
                  <div className="mars-bar-card-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>{props.story ? "SIMULATED MARS DOSE" : "GAME DOSE"}</span>
                  </div>
                  <span className={`mars-bar-val ${exposureClass}`}>
                    <b>{phoneDose.toFixed(2)}</b> mSv {props.story ? "· simulation" : "· game meter / 100"}
                  </span>
                </div>
                <div className="mars-segmented-track" role="progressbar" aria-valuenow={Math.round(phoneDose)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`mars-segmented-fill ${exposureClass}`} style={{ width: `${Math.max(2, Math.min(100, phoneDose))}%` }} />
                </div>
                <div className="mars-bar-sub-status">
                  <span className="mars-sub-bar" />
                  {props.story ? <span className="mars-sub-text">Mission choices only · NOAA does not change this value</span> : isShielded ? (
                    <span className="mars-sub-text shielded">SHIELDED BASE · NOMINAL (−1.5 mSv/s)</span>
                  ) : (
                    <span className={`mars-sub-text ${spaceWeather.sepFluxPFU >= 10 ? "storm" : "nominal"}`}>
                      {spaceWeather.sepFluxPFU >= 10 ? "STORM ACTIVE · SEEK HABITAT" : "SURFACE EVA · (+0.05 mSv/s)"}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 5: 💓 Heartbeat ECG Icon + Health */}
              <div className="mars-phone-bar-card health-bar-card">
                <div className="mars-bar-card-header">
                  <div className="mars-bar-card-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      <path d="M3.22 12H9.5l1.5-3 2 6.5 1.5-3.5h4.28" />
                    </svg>
                    <span>HEALTH</span>
                  </div>
                  <span className={`mars-bar-val ${healthClass}`}>
                    <b>{Math.round(astronautHealth)}%</b>
                  </span>
                </div>
                <div className="mars-striped-health-track" role="progressbar" aria-valuenow={Math.round(astronautHealth)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`mars-striped-health-fill ${healthClass}`} style={{ width: `${Math.max(0, Math.min(100, astronautHealth))}%` }} />
                </div>
              </div>

              {/* Row 3: Bottom 3 Icon Cards */}
              <div className="mars-phone-grid-3">
                {/* Box 6: 🌡️ Thermometer Icon */}
                <div className="mars-grid-card">
                  <div className="mars-card-icon temp-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                    </svg>
                  </div>
                  <span className="mars-card-label">SURFACE TEMP</span>
                  <span className="mars-card-val temp-val">
                    <b>-62°C</b>
                  </span>
                </div>

                {/* Box 7: ⏱️ Speedometer / Pressure Gauge Icon */}
                <div className="mars-grid-card">
                  <div className="mars-card-icon gauge-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 14v-4" />
                      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
                    </svg>
                  </div>
                  <span className="mars-card-label">{roverDriving ? "ROVER SPEED" : "PRESSURE"}</span>
                  <span className="mars-card-val">
                    <b>{roverDriving ? `${Math.round(roverSpeed)}` : "6.1"}</b>
                    <small> {roverDriving ? "km/h" : "hPa"}</small>
                  </span>
                </div>

                {/* Box 8: 🫧 O₂ Molecule Icon */}
                <div className="mars-grid-card">
                  <div className="mars-card-icon o2-icon">
                    <span className="o2-symbol">O₂</span>
                  </div>
                  <span className="mars-card-label">SUIT O₂</span>
                  <span className="mars-card-val o2-val">
                    <b>100%</b>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Data (NASA Historical Superstorms with Visual Flare Icons) */}
          {activePhoneTab === "data" && (
            <div className="mars-phone-tab-content data-tab">
              <div className="mars-tab-heading">
                <h3>SPACE WEATHER ARCHIVE</h3>
                <p>NASA DONKI event references with authored replay curves:</p>
              </div>
              <div className="mars-events-list">
                <button
                  type="button"
                  className={`mars-event-item ${spaceWeather.mode === "live" ? "active" : ""}`}
                  onClick={() => {
                    if (spaceWeather.mode !== "live") toggleSpaceWeatherMode();
                  }}
                >
                  <div className="mars-event-icon-col">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                      <path d="M2 12h20" />
                    </svg>
                  </div>
                  <div className="mars-event-meta">
                    <b>NOAA SWPC GOES satellites</b>
                    <small>Near-Earth proton flux · not Mars dose</small>
                  </div>
                  <span className="mars-event-tag live">LIVE</span>
                </button>

                <button
                  type="button"
                  className={`mars-event-item ${spaceWeather.activeEvent?.id.startsWith("2024") ? "active" : ""}`}
                  onClick={() => selectHistoricalEvent(0)}
                >
                  <div className="mars-event-icon-col">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#f59e0b">
                      <polygon points="12 2 15 8 22 9 17 14 18 21 12 17 6 21 7 14 2 9 9 8 12 2" />
                    </svg>
                  </div>
                  <div className="mars-event-meta">
                    <b>May 2024 Superstorm (AR3664)</b>
                    <small>X8.7 flare · 240 PFU replay target</small>
                  </div>
                  <span className="mars-event-tag storm">S2/S3</span>
                </button>

                <button
                  type="button"
                  className={`mars-event-item ${spaceWeather.activeEvent?.id.startsWith("2017") ? "active" : ""}`}
                  onClick={() => selectHistoricalEvent(1)}
                >
                  <div className="mars-event-icon-col">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#f97316">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <div className="mars-event-meta">
                    <b>September 2017 Solar Event</b>
                    <small>X8.2 flare · 1,490 PFU replay target</small>
                  </div>
                  <span className="mars-event-tag storm">S3</span>
                </button>

                <button
                  type="button"
                  className={`mars-event-item ${spaceWeather.activeEvent?.id.startsWith("2003") ? "active" : ""}`}
                  onClick={() => selectHistoricalEvent(2)}
                >
                  <div className="mars-event-icon-col">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#ef4444">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" stroke="#ef4444" strokeWidth="2" />
                      <line x1="12" y1="21" x2="12" y2="23" stroke="#ef4444" strokeWidth="2" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="#ef4444" strokeWidth="2" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#ef4444" strokeWidth="2" />
                      <line x1="1" y1="12" x2="3" y2="12" stroke="#ef4444" strokeWidth="2" />
                      <line x1="21" y1="12" x2="23" y2="12" stroke="#ef4444" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="mars-event-meta">
                    <b>Halloween 2003 Extreme</b>
                    <small>Extreme Superstorm · 29,500 PFU Benchmark</small>
                  </div>
                  <span className="mars-event-tag extreme">S4</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Systems (Visual Illustrated Hardware Cards) */}
          {activePhoneTab === "systems" && (
            <div className="mars-phone-tab-content systems-tab">
              <div className="mars-tab-heading">
                <h3>EXPLORATION SYSTEMS</h3>
                <p>Surface shelter and vehicle status:</p>
              </div>
              <div className="mars-systems-list">
                <div className="mars-system-card">
                  <div className="mars-sys-icon-box">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#38bdf8" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className="mars-sys-info">
                    <b>Habitat Base Bunker</b>
                    <small>{isShielded ? "Inside shielded base (−1.5 mSv/s)" : "Outside on surface EVA (Unshielded)"}</small>
                  </div>
                  <span className={`mars-sys-status ${isShielded ? "ok" : "warn"}`}>
                    {isShielded ? "SHIELDED" : "UNSHIELDED"}
                  </span>
                </div>

                <div className="mars-system-card">
                  <div className="mars-sys-icon-box">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="10" rx="2" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="18" r="3" />
                    </svg>
                  </div>
                  <div className="mars-sys-info">
                    <b>MMSEV Exploration Rover</b>
                    <small>Battery: {Math.round(roverBattery)}% · Speed: {Math.round(roverSpeed)} km/h</small>
                  </div>
                  <span className="mars-sys-status ok">ONLINE</span>
                </div>

                <div className="mars-system-card">
                  <div className="mars-sys-icon-box">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="2">
                      <path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
                      <path d="M4 14v4a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4" />
                    </svg>
                  </div>
                  <div className="mars-sys-info">
                    <b>Astronaut EMU Space Suit</b>
                    <small>O₂ Life Support: 100% · Vitals: {Math.round(astronautHealth)}%</small>
                  </div>
                  <span className={`mars-sys-status ${astronautHealth > 70 ? "ok" : "warn"}`}>
                    {astronautHealth > 70 ? "NOMINAL" : "DAMAGED"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Settings / Audio */}
          {activePhoneTab === "settings" && (
            <div className="mars-phone-tab-content settings-tab">
              <div className="mars-tab-heading">
                <h3>COMMUNICATOR SETTINGS</h3>
                <p>Audio feedback and telemetry link:</p>
              </div>
              <div className="mars-settings-list">
                <div className="mars-setting-row">
                  <div className="mars-setting-label">
                    <b>Geiger Dosimetry Sound</b>
                    <small>Radiation counter clicks</small>
                  </div>
                  <button
                    type="button"
                    className={`mars-setting-toggle-btn ${geigerMuted ? "muted" : "active"}`}
                    onClick={handleToggleGeigerMute}
                  >
                    {geigerMuted ? "MUTED" : "ACTIVE"}
                  </button>
                </div>

                <div className="mars-setting-row">
                  <div className="mars-setting-label">
                    <b>Space Weather Feed</b>
                    <small>Toggle Live NOAA vs NASA DONKI</small>
                  </div>
                  <button
                    type="button"
                    className="mars-setting-toggle-btn active"
                    onClick={toggleSpaceWeatherMode}
                  >
                    {spaceWeather.mode === "live" ? "LIVE [Y]" : "ARCHIVE [Y]"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activePhoneTab === "home" && <RadiationPhoneHome
            logoSrc={assetUrl('/branding/tarukh-phone-logo.webp')}
            onOpenApp={setActivePhoneTab}
            onOpenMap={props.onOpenMap ? () => { closePhone(); props.onOpenMap?.(); } : undefined}
            onOpenGuide={() => setSepInfoOpen(true)}
            dose={phoneDose}
            health={astronautHealth}
            storm={spaceWeather.stormScale.split(" ")[0]}
            modeLabel={spaceWeather.mode === 'live' ? (spaceWeather.isLiveConnected ? 'Live observations' : 'Feed offline') : 'Archive replay'}
          />}
          {(activePhoneTab === "telemetry" || activePhoneTab === "data") && (
            <p className="mars-phone-source-note">
              {spaceWeather.mode === 'live'
                ? <>NOAA GOES measures proton flux near Earth, not radiation at this Mars base. {spaceWeather.isLiveConnected ? 'Live feed connected.' : 'Feed unavailable or connecting: the displayed baseline is simulated.'}</>
                : <>NASA DONKI supplies historical event references. These replay curves are authored demonstrations, not measured Mars dose.</>}
              {props.story && <> Your Story supplies, health and simulated dose are unaffected by this feed.</>}
            </p>
          )}
          </div>
          <nav className="mars-phone-nav-bar" aria-label="Phone navigation">
            <button type="button" className="mars-nav-btn" onClick={() => activePhoneTab === 'home' ? closePhone() : setActivePhoneTab('home')} aria-label="Back">
              <ChevronLeft size={21} aria-hidden="true"/><span>Back</span>
            </button>
            <button type="button" className={`mars-nav-btn ${activePhoneTab === 'home' ? 'active' : ''}`} onClick={() => setActivePhoneTab('home')} aria-label="Home" aria-current={activePhoneTab === 'home' ? 'page' : undefined}>
              <House size={21} aria-hidden="true"/><span>Home</span>
            </button>
            <button type="button" className="mars-nav-btn" onClick={closePhone} aria-label="Close phone">
              <Power size={20} aria-hidden="true"/><span>Close</span>
            </button>
          </nav>
        </div>
      </div>
      </dialog>
      {props.enabled && touchControlsActive && !phoneOpen && (<TouchDeck enabled={props.enabled} roverDriving={roverDriving} roverNear={roverNear} canInspect={canInspect} thirdPerson={thirdPerson} onWalkAxes={handleWalkAxes} onDriveAxes={handleDriveAxes} onHoldKey={touch} onToggleView={handleToggleView} onToggleRover={handleToggleRover} onInspectNearby={handleInspectNearby}/>)}
   {/* Astronaut Death Screen Overlay */}
   {isDead && (
     <div className="mars-death-overlay" role="alert" aria-live="assertive">
       <div className="mars-death-modal">
         <div className="mars-death-hazard-icon" aria-hidden="true">
           <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
             <line x1="12" y1="9" x2="12" y2="13" />
             <line x1="12" y1="17" x2="12.01" y2="17" />
           </svg>
         </div>
         <h1 className="mars-death-title">You could&apos;nt make it</h1>
         <p className="mars-death-desc">
           Vital signs terminated · Critical radiation sickness on Mars
         </p>
         <div className="mars-death-progress-wrap" aria-hidden="true">
           <div className="mars-death-progress-bar" />
         </div>
         <div className="mars-death-footer">
           <span className="mars-death-status">Restarting Mars exploration…</span>
           <button
             type="button"
             className="mars-death-restart-btn"
             onClick={handleRestartWorld}
             autoFocus
           >
             Restart Now
           </button>
         </div>
       </div>
     </div>
   )}
   {/* Solar Energetic Particles (SEP) Educational Briefing Modal */}
   {sepInfoOpen && (
     <dialog ref={sepDialog}
       className="mars-sep-modal-backdrop"
       onCancel={event => { event.preventDefault(); setSepInfoOpen(false); }}
       aria-modal="true"
       aria-labelledby="mars-sep-modal-title"
       onClick={(e) => {
         if (e.target === e.currentTarget) setSepInfoOpen(false);
       }}
     >
       <div className="mars-sep-modal">
         <div className="mars-sep-modal-header">
           <div className="mars-sep-header-text">
             <h2 id="mars-sep-modal-title" className="mars-sep-modal-title">
              Radiation Level (SEP)
              <span className="mars-sep-title-tag">LIVE NASA TELEMETRY</span>
             </h2>
            <p className="mars-sep-modal-sub">Earth observations and fictional Mars exploration</p>
           </div>
           <button
             type="button"
             className="mars-sep-modal-close"
             onClick={() => setSepInfoOpen(false)}
             aria-label="Close guide"
           >
             ✕
           </button>
         </div>

        {/* Section 1: Radiation Level = SEP in simple terms */}
        <div className="mars-sep-card">
          <div className="mars-sep-card-title">
            <span>☀️</span> What is SEP?
          </div>
          <p>
            <b>Solar Energetic Particles (SEPs)</b> are intense streams of high-energy protons (≥10 MeV) and heavy atomic nuclei blasted into interplanetary space by <b>solar flares</b> and <b>Coronal Mass Ejections (CMEs)</b> on the Sun.
          </p>
          <p>
            <b>PFU</b> measures particle flux. NOAA GOES satellites observe near Earth; they do not measure your astronaut&apos;s Mars dose. NASA DONKI provides event references; the archive curves here are authored replays.
          </p>
        </div>

        {/* Section 1B: Genuine Live Data Streamed from NASA & NOAA */}
        <div className="mars-sep-card live-stream">
          <div className="mars-sep-card-title live-stream">
            <span>🛰️</span> Live Data Streaming from NASA & NOAA
          </div>
          <p>
            The <b>RADIATION LEVEL</b> on your communicator displays <b>interplanetary space weather telemetry</b> referenced from <b>NOAA SWPC GOES satellites</b> and the <b>NASA DONKI (Space Weather Database)</b>.
          </p>
          <p>
            • Current Deep-Space Proton Flux: <b>{spaceWeather.sepFluxPFU < 10 ? spaceWeather.sepFluxPFU.toFixed(2) : Math.round(spaceWeather.sepFluxPFU).toLocaleString()} PFU</b> (≥10 MeV protons).<br />
            • Surface Equivalent Dose Rate: <b>{currentRadiationHourly} mSv/h</b> ({spaceWeather.stormScale}).<br />
            • Active Data Source: <b>{spaceWeather.mode === "live" ? "Orbital Satellites (NOAA SWPC GOES)" : `Historical NASA DONKI Replay: ${spaceWeather.activeEvent?.name ?? "Superstorm"}`}</b>.
          </p>
        </div>

         {/* Section 2: What does it do? */}
         <div className="mars-sep-card hazard">
           <div className="mars-sep-card-title hazard">
             <span>⚠️</span> What Does It Do on Mars?
           </div>
           <p>
             Earth has a global magnetic field and a thick atmosphere. Mars has much less natural shielding, so real mission planners study radiation and protective materials carefully.
           </p>
           <p>
              {props.story ? 'Story dose changes only through your simulated mission decisions. This phone never drains supplies, damages health or creates a real-time deadline.' : 'Free Exploration uses fictional dose, health, blur and movement effects as game rules. They are not medical predictions or a conversion from NOAA flux to actual Mars exposure. High-energy protons penetrate the suit and cause progressive vision blur and health degradation above 75 mSv.'}
           </p>
         </div>

         {/* Section 3: How to stay safe (Enter Shielded Base) */}
         <div className="mars-sep-card safe">
           <div className="mars-sep-card-title safe">
             <span>🛡️</span> How to Stay Safe: Enter a Shielded Base
           </div>
           <p>
             More material can reduce exposure, but protection depends on the particles and the shielding. A real habitat is not an absolute radiation barrier.
           </p>
           <div className="mars-sep-shelters-list">
             <div className="mars-sep-shelter-item">
               <span>🏛️</span>
               <div><b>Outpost Campus</b> — Enter through the main airlock</div>
               <span className="mars-sep-shelter-coord">(0, −65) m</span>
             </div>
           </div>
           <p style={{ marginTop: "4px" }}>
             {props.story ? 'Use the shelter activities to compare explicitly simulated shielding plans. Previously accumulated mission dose is not erased by entering a room.' : 'In Free Exploration only, shelters stop the game exposure meter and let it recover. The displayed recovery is a game mechanic: real accumulated radiation dose is not removed by sheltering.'}
           </p>
         </div>

         {/* Interactive Tip */}
         <div className="mars-sep-tip-box">
           <b>Explore the evidence:</b> Switch between near-Earth NOAA observations and NASA DONKI event replays using the phone&apos;s Data tab. The two are separate from simulated Mars dose.
         </div>

         {/* Footer */}
         <div className="mars-sep-modal-footer">
           <button
             type="button"
             className="mars-sep-confirm-btn"
             onClick={() => setSepInfoOpen(false)}
             autoFocus
           >
             Understood · Return to phone
           </button>
         </div>
       </div>
     </dialog>
   )}
   {loaded && props.enabled && outpostPrompt && <div className="sv-outpost-prompt" data-ui-zone="interaction" aria-live="polite">
     <button disabled={outpostPromptDisabled} onClick={() => { handleInspectNearby(); host.current?.focus({ preventScroll: true }); }} aria-label={outpostPrompt}>{!outpostPromptDisabled && <kbd>E</kbd>} {outpostPrompt}</button>
   </div>}
   {props.menuOpen && props.onCloseMenu && props.onMainMenu && <FlightMenu
     mobile={touchControlsActive} story={Boolean(props.story)} thirdPerson={thirdPerson}
     sensitivity={sensitivity} quality={quality} autoLabel={autoLabel} autoReport={autoReport}
     performanceMeter={performanceMeter} onCamera={setThirdPerson} onSensitivity={setSensitivity}
     onQuality={setQuality} onPerformanceMeter={setPerformanceMeter}
     onResume={() => { closePhone(); setSepInfoOpen(false); props.onCloseMenu?.(); }}
     onCaptureMouse={() => lockAction.current()} onFullscreen={props.onMenuFullscreen}
     onMainMenu={props.onMainMenu}
   />}
   {message && <p className="sv-world-message" role="status">{message}</p>}
  </div>);
}
export default memo(MarsWorld);
