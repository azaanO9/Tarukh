"use client";
import { createStreamedMars } from "./world/streamedMars";
import { createMarsRegionalLandscape } from "./world/marsRegionalLandscape";
import { marsExpeditionHeight } from "../game/marsExpeditionTerrain";
import { ARRIVAL_SPAWN, ARRIVAL_YAW } from "../game/shuttleLanding";
import { streamingBudget, STREAM_LIMIT, streamedHeight } from "../game/terrainStreaming";
import { PERSEVERANCE_LANDING } from '../content/marsLandingSites';
import { createPerseveranceRover, perseveranceFootprint, PERSEVERANCE_CLEARING } from './world/createPerseveranceRover';
import { nightAmount, daylightPhase, daylightAngle } from "../game/daylightCycle";
import { safeLookDelta } from "../game/mouseLook";
import { performanceReadout, type PerformanceMeterMode } from "../game/performanceMeter";
import { assetUrl } from "../lib/assetUrl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Mesh, Object3D } from "three";
import { scanRoverLidar, type LidarScan } from "../game/roverLidar";
import { stepMarsLocomotion } from "../game/marsLocomotion";
import { spawnWalker, WALKER_RADIUS, type MoveAxes } from "../game/navigation";
import { boxObstacle } from "../game/collision";
import { isCoarsePointerDevice } from "./mobileDevice";
import { MarsTouchDeck } from "./world/MarsTouchDeck";
import { RoverTouchDeck } from "./world/RoverTouchDeck";
import { Settings2 } from "lucide-react";
import { createMarsSky, createMarsFootprints } from "./world/marsTerrain";
import { loadMarsSurfaceTextures, disposeMarsSurfaceTextures } from "./world/marsSurfaceTextures";
import { createRiggedAstronaut } from "./world/createRiggedAstronaut";
import { createBigRover } from "./world/createBigRover";
import { createCuriosityRover } from "./world/createCuriosityRover";
import { spawnCuriosityRover, stepCuriosityRover, curiosityFootprint, exportCuriositySave, type CuriosityRoverState, } from "../game/curiosityRover";
import { CURIOSITY_SAVE_KEY, parseCuriositySave } from "../game/curiositySave";
import { createMarsWindDust } from "./world/marsWindDust";
import { createSoftContactShadow } from "./world/contactShadow";
import { graphicsTier } from "./world/graphicsTiers";
import { AUTO_TARGET_FPS, browserThrottledFrame, createAutoGraphics, adaptAutoGraphics, approachRenderScale, profileName, type AutoProfile } from '../game/autoGraphics';
import { createBackgroundGraphics } from '../game/backgroundGraphics';
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
import { createShuttleLanding } from "./world/createShuttleLanding";
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
  onReady?: () => void;
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
  playLandingIntro?: boolean;
};
export default function MarsWorld(props: Props) {
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
  const skipIntroAction = useRef<() => void>(() => { });
  const inspectAction = useRef<() => void>(() => { });
  const repairAction = useRef<() => void>(() => { });
  const analogWalk = useRef<MoveAxes>({});
  const analogDrive = useRef<RoverAnalogInput>({});
  const [autoCoarse, setAutoCoarse] = useState(false);
  const [touchOverride, setTouchOverride] = useState<boolean | null>(null);
  const touchControlsActive = touchOverride ?? (props.showTouchControls || (props.autoDetectTouch !== false && autoCoarse));
  useEffect(() => {
    const syncCoarse = () => setAutoCoarse(isCoarsePointerDevice());
    syncCoarse();
    const media = window.matchMedia?.("(pointer: coarse)");
    media?.addEventListener?.("change", syncCoarse);
    return () => media?.removeEventListener?.("change", syncCoarse);
  }, []);
  useEffect(() => {
    props.onTouchControlsChange?.(touchControlsActive);
  }, [touchControlsActive, props.onTouchControlsChange]);
  const [roverDriving, setRoverDriving] = useState(false);
  const [roverNear, setRoverNear] = useState(false);
  const [canInspect, setCanInspect] = useState(false);
  const [roverSpeed, setRoverSpeed] = useState(0);
  const [roverGear, setRoverGear] = useState<RoverGear>("N");
  const [roverBoost, setRoverBoost] = useState(false);
  const [roverBattery, setRoverBattery] = useState(100);
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
  const [introActive, setIntroActive] = useState(Boolean(props.playLandingIntro));
  const [introTelemetry, setIntroTelemetry] = useState({ alt: 52, speed: 48, phase: "Powered descent" });
  const TouchDeck = (roverDriving ? RoverTouchDeck : MarsTouchDeck);
  const [loadingStage, setLoadingStage] = useState("Loading explorers and rovers…");
  const [loadingProgress, setLoadingProgress] = useState(10);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [cursorFree, setCursorFree] = useState(false);
  const [message, setMessage] = useState("");
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
    let backgroundTimer = 0;
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
      const mobileMars = isCoarsePointerDevice();
      // Measure up to the Ultra cap even on an iGPU/phone; never infer its ceiling from a name.
      const displayRatio = Math.max(.55, Math.min(devicePixelRatio, 2));
      const renderer = new T.WebGLRenderer({
        antialias: !mobileMars && props.initialQuality !== "performance",
        powerPreference: "high-performance",
      });
      const gl = renderer.getContext();
      const gpuInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const gpuName = gpuInfo ? String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)) : "";
      let autoProfile: AutoProfile = 'performance';
      const terrainBudget = streamingBudget(gpuName, navigator.hardwareConcurrency, (navigator as Navigator & {
        deviceMemory?: number;
      }).deviceMemory, mobileMars, props.initialQuality ?? "auto");
      const effectiveQuality = () => cameraSettings.current.quality === "auto" ? autoProfile : cameraSettings.current.quality;
      const profileLabel = () => profileName(autoProfile);
      setAutoLabel(profileLabel());
      const initialPreset = graphicsTier(effectiveQuality());
      renderer.setPixelRatio(Math.min(displayRatio, initialPreset.resolutionCap));
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
      const shadowSize = graphicsTier(effectiveQuality()).shadowSize;
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
      const regionalLandscape = createMarsRegionalLandscape(model.root);
      const streamOptions = { worldLimit: STREAM_LIMIT };
      const baseHeight = model.heightAt;
      const baseRoverHeight = model.roverHeightAt;
      // Stable callbacks also keep footprints and suspension aligned after streaming activates.
      model.heightAt = (x, z) => streaming ? streaming.heightAt(x, z) : baseHeight(x, z);
      model.roverHeightAt = (x, z) => streaming && (Math.abs(x) > 210 || Math.abs(z) > 210) ? streaming.roverHeightAt(x, z) : baseRoverHeight(x, z);
      const smallRocks = model.root.getObjectByName("mars-small-rocks") as import("three").InstancedMesh | undefined;
      const previewParams = new URLSearchParams(window.location.search);
      const previewValue = Number(previewParams.get('landingPreview'));
      const landingPreview = debug && previewParams.has('landingPreview') && Number.isFinite(previewValue) ? Math.max(0, Math.min(23.9, previewValue)) : undefined;
      const previewPerseverance = debug && true && previewParams.get('sitePreview') === 'perseverance';
      const landingIntro = (createShuttleLanding(model.heightAt, window.matchMedia("(prefers-reduced-motion: reduce)").matches, landingPreview));
      {
        model.obstacles.push(boxObstacle(0, 12, 4.5, 3.5, "arrival-shuttle"));
        model.obstacles.push(boxObstacle(0, 15.7, .7, .5, "arrival-steps"));
      }
      if (landingIntro) {
        scene.add(landingIntro.root);
        if (current.current.playLandingIntro) {
          landingIntro.start();
        }
        if (previewPerseverance) {
          landingIntro.skip();
          setIntroActive(false);
        }
      }
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
      }
      let composer: import("three/examples/jsm/postprocessing/EffectComposer.js").EffectComposer | null = null;
      let occlusion: import("three/examples/jsm/postprocessing/GTAOPass.js").GTAOPass | null = null;
      let bloom: import("three/examples/jsm/postprocessing/UnrealBloomPass.js").UnrealBloomPass | null = null;
      let fxaaPass: import("three/examples/jsm/postprocessing/ShaderPass.js").ShaderPass | null = null;
      let effectsLoading: Promise<void> | null = null;
      const effectsSupported = Boolean(gl.getExtension('EXT_color_buffer_float'));
      const desiredCamera = new T.Vector3();
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
        if (!composer || (!occlusion?.enabled && !bloom?.enabled))
          return false;
        try {
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
        const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { BoundedGTAOPass }, { ResolutionFXAAPass }] = await Promise.all([
          import("three/examples/jsm/postprocessing/EffectComposer.js"),
          import("three/examples/jsm/postprocessing/RenderPass.js"),
          import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
          import("three/examples/jsm/postprocessing/OutputPass.js"),
          import("./world/BoundedGTAOPass"),
          import("./world/ResolutionFXAAPass"),
        ]);
        if (cancelled)
          return;
        // HDR resolves with HalfFloatType
        const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 0 });
        composer = new EffectComposer(renderer, target);
        composer.addPass(new RenderPass(scene, camera));
        occlusion = new BoundedGTAOPass(scene, camera, 256, 256);
        occlusion.updateGtaoMaterial({ radius: .52, thickness: .55, distanceFallOff: 1.2, samples: 10 });
        occlusion.updatePdMaterial({ samples: 8, radius: 4, rings: 2 });
        occlusion.blendIntensity = .52;
        occlusion.enabled = false;
        composer.addPass(occlusion);
        bloom = new UnrealBloomPass(new T.Vector2(512, 512), .28, .55, .88);
        composer.addPass(bloom);
        // Detect edges after tone mapping, using display-space contrast.
        composer.addPass(new OutputPass());
        fxaaPass = new ResolutionFXAAPass();
        composer.addPass(fxaaPass);
      })().catch(() => { disposeEffects(); });
      function configureEffects(render = false) {
        const preset = graphicsTier(effectiveQuality());
        if (occlusion)
          occlusion.enabled = preset.ssao;
        if (bloom)
          bloom.enabled = preset.bloom && !reduced.matches;
        if (render && effectiveQuality() !== "performance")
          renderEffects();
      }
      if (effectsSupported && effectiveQuality() !== "performance")
        await prepareEffects();
      const keys = controls.current;
      const ray = new T.Raycaster();
      const spawnAtArrival = () => previewPerseverance ? { ...spawnWalker(), x: PERSEVERANCE_LANDING.x + 2, z: PERSEVERANCE_LANDING.z + 4 } : { ...spawnWalker(), x: ARRIVAL_SPAWN.x, z: ARRIVAL_SPAWN.z };
      let walker = spawnAtArrival();
      let jump = { height: 0, velocity: 0 };
      let rover = spawnRoverVehicle(17, 10, 0, model.roverHeightAt);
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
      let cameraYaw = 0;
      let characterYaw = 0;
      let lastRoverGear: RoverGear = "N";
      let lastRoverBoost = false;
      let lastRoverBattery = 100;
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
      let lastLandingUiUpdate = 0;
      skipIntroAction.current = () => {
        if (landingIntro?.isActive()) {
          landingIntro.skip();
          {
            cameraYaw = characterYaw = ARRIVAL_YAW;
            pitch = -.04;
            orbitInitialized = false;
            keys.clear();
          }
          setIntroActive(false);
        }
      };
      toggleRoverAction.current = () => {
        if (!current.current.enabled || landingIntro?.isActive() || false || false)
          return;
        if (!rover.driving) {
          if (canEnterRover(walker, rover)) {
            rover = enterRover(rover);
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
      let autoState = createAutoGraphics(autoProfile, Math.min(displayRatio, graphicsTier(autoProfile).resolutionCap));
      const backgroundProbe = cameraSettings.current.quality === 'auto'
        ? createBackgroundGraphics(displayRatio, name => graphicsTier(name).resolutionCap) : null;
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
      let resolutionScale = Math.min(devicePixelRatio, 1.25);
      let gaitPhase = 0;
      let gaitBlend = 0;
      let cameraGround = 0;
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
        const tier = graphicsTier(name);
        model.setLightSurfaces?.(name === 'performance');
        {
          camera.far = tier.viewDistance;
          camera.updateProjectionMatrix();
          // Keep the sky dome inside the shorter frustum without changing its angular appearance.
          skyMesh?.scale.setScalar(Math.min(1, tier.viewDistance / 1000));
          streaming?.setPerformance(name === 'performance');
        }
        resolutionScale = scale;
        renderer.setPixelRatio(scale);
        renderer.shadowMap.enabled = tier.shadows;
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
        if (!current.current.enabled || rover.driving) return;
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
        if (!current.current.enabled || cameraSettings.current.touchControlsActive)
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
        if (!current.current.enabled || landingIntro?.isActive()) {
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
      const keydown = (e: KeyboardEvent) => {
        if (e.defaultPrevented || !current.current.enabled)
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
        if (landingIntro?.isActive()) {
          if (e.code === "Space" && !onInteractive) {
            e.preventDefault();
            skipIntroAction.current();
          }
          return;
        }
        if (e.code === "CapsLock" && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && tag !== "INPUT" && current.current.onOpenMap) {
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
          if (!rover.driving && repairTargetRef.current) {
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
          if (landingIntro?.isActive()) {
            skipIntroAction.current();
            return;
          }
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
        setLocked(captured);
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
      let lastCuriositySave = 0;
      const saveCuriosityNow = () => {
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
        if (document.hidden)
          saveCuriosityNow();
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
      function animate(time: number) {
        const frameStarted = performance.now();
        frame = requestAnimationFrame(animate);
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
        if (!current.current.enabled && time - last < 100)
          return;
        const frameInterval = last ? time - last : 0;
        const dt = last ? Math.min(frameInterval / 1000, 0.1) : 1 / 60;
        last = time;
        const p = current.current;
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
          const cap = Math.min(displayRatio, graphicsTier(name).resolutionCap);
          // A live Auto tier change also eases toward its new pixel cap; manual choices apply immediately.
          applyQuality(name, cameraSettings.current.quality === 'auto' && !selectionChanged ? resolutionScale : cap);
          if (effectsSupported && lastQuality !== "performance" && !composer && (!backgroundProbe || backgroundPrepared)) {
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
        if (cameraSettings.current.quality === 'auto' && time - lastResolutionChange >= 400 && Math.abs(resolutionScale - autoState.scale) > .005) {
          resolutionScale = approachRenderScale(resolutionScale, autoState.scale);
          renderer.setPixelRatio(resolutionScale);
          resize();
          lastResolutionChange = time;
        }
        const activeHeightAt = model.heightAt;
        const activeTier = graphicsTier(lastQuality);
        model.updateTracks?.(renderer, walker.x, walker.z, mobileMars || lastQuality === "performance");
        const dropRunning = Boolean(landingIntro?.isActive() && true && p.enabled);
        if (p.enabled && !dropRunning) {
          const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
          const step = dt / steps;
          {
            const sevObstacles = curiosity
              ? [...model.obstacles, curiosityFootprint(curiosity.x, curiosity.z, curiosity.yaw)]
              : model.obstacles;
            if (rover.driving) {
              const prevRoverYaw = rover.yaw;
              for (let i = 0; i < steps; i++) {
                rover = stepRoverVehicle(rover, keys, step, sevObstacles, model.roverHeightAt, model.mudAt, analogDrive.current, {
                  ...(streaming ? streamOptions : undefined),
                  daylightElapsed,
                });
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
              if (bigRover && Math.abs(rover.speed) > 0.01) {
                rover = stepRoverVehicle(rover, keys, dt, sevObstacles, model.roverHeightAt, model.mudAt, undefined, {
                  ...(streaming ? streamOptions : undefined),
                  daylightElapsed,
                });
              }
              const dynamicObstacles = [
                ...model.obstacles.filter(o => Math.abs(walker.x - o.x) < o.radius + 3 && Math.abs(walker.z - o.z) < o.radius + 3),
                ...(bigRover ? [roverFootprint(rover.x, rover.z, rover.yaw)] : []),
                ...(curiosity ? [curiosityFootprint(curiosity.x, curiosity.z, curiosity.yaw)] : []),
              ];
              walker.yaw = cameraYaw;
              for (let i = 0; i < steps; i++) {
                {
                  const next = stepMarsLocomotion(walker, jump, keys, step, model.heightAt, dynamicObstacles, analogWalk.current, streaming ? STREAM_LIMIT : undefined);
                  walker = next.walker;
                  jump = next.jump;
                  keys.delete("jump");
                }
              }
              keys.delete("jump");
            }
          }
          if (curiosity && true) {
            const curiosityObstacles = [
              ...model.obstacles,
              ...(bigRover ? [roverFootprint(rover.x, rover.z, rover.yaw)] : []),
              { x: walker.x, z: walker.z, radius: WALKER_RADIUS, id: "walker" },
            ];
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
          const lidarObstacles = curiosity
            ? [...model.obstacles, curiosityFootprint(curiosity.x, curiosity.z, curiosity.yaw)]
            : model.obstacles;
          lidar = scanRoverLidar(rover, lidarObstacles);
          lastLidarScan = time;
        }
        if (p.enabled && !dropRunning)
          daylightElapsed += dt;
        const nightBlend = nightAmount(daylightElapsed);
        {
          model.root.visible = true;
          if (bigRover) {
            bigRover.root.visible = true;
            bigRover.dust.visible = true;
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
          const nearNow = !rover.driving && canEnterRover(walker, rover);
          if (nearNow !== lastRoverNear) {
            lastRoverNear = nearNow;
            setRoverNear(nearNow);
          }
          if (!rover.driving) {
            const nearestPart = getNearestRoverPart(walker, rover);
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
            const battNow = Math.round(rover.battery);
            if (battNow !== lastRoverBattery) {
              lastRoverBattery = battNow;
              setRoverBattery(rover.battery);
            }
            const rangeStr = rover.estimatedRangeKm >= 1.0
              ? `${rover.estimatedRangeKm.toFixed(1)} KM`
              : `${Math.round(rover.estimatedRangeKm * 1000)} M`;
            if (rangeStr !== lastRoverRange) {
              lastRoverRange = rangeStr;
              setRoverRangeDisplay(rangeStr);
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
        const third = cameraSettings.current.thirdPerson;
        const cockpitView = rover.driving && !third;
        if (cockpitView && !wasCockpit) {
          cameraYaw = rover.yaw;
          pitch = -.14;
        }
        wasCockpit = cockpitView;
        bigRover?.setCockpitView(cockpitView);
        if (astronautShadow)
          astronautShadow.mesh.visible = !rover.driving && third;
        if (landingIntro?.isActive() && true) {
          astronaut.visible = true;
          const groundHeight = model.heightAt(walker.x, walker.z);
          astronaut.position.set(walker.x, groundHeight, walker.z);
          const podState = landingIntro.update(p.enabled ? dt : 0, camera, {
            x: walker.x,
            y: groundHeight,
            z: walker.z,
          });
          if (podState.astronaut) {
            const actor = podState.astronaut;
            astronaut.visible = actor.visible;
            astronaut.position.set(actor.x, actor.y, actor.z);
            astronaut.rotation.y = actor.yaw;
            marsAstronaut?.update(p.enabled ? dt : 0, actor.speed, actor.hopHeight > 0, actor.hopHeight, actor.verticalVelocity);
            if (astronautShadow) {
              astronautShadow.mesh.visible = actor.visible;
              astronautShadow.mesh.position.set(actor.x, model.heightAt(actor.x, actor.z) + .024, actor.z);
            }
          }
          if (time - lastLandingUiUpdate > 80) {
            lastLandingUiUpdate = time;
            setIntroTelemetry({ alt: podState.altitudeMeters, speed: podState.speedMs, phase: podState.phase ?? "Touchdown" });
          }
          if (!podState.active) {
            cameraYaw = characterYaw = ARRIVAL_YAW;
            pitch = -.04;
            cameraGround = groundHeight;
            keys.clear();
            setIntroActive(false);
          }
        }
        else if (rover.driving && true) {
          orbitInitialized = false;
          astronaut.visible = false;
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
          astronaut.visible = third;
          const groundHeight = activeHeightAt(walker.x, walker.z);
          astronaut.position.set(walker.x, groundHeight + jump.height, walker.z);
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
          if (p.enabled && true && !rover.driving)
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
          if (third) {
            const targetY = cameraGround + jump.height + (1.45);
            const horizBack = Math.cos(pitch) * back;
            const vertBack = -Math.sin(pitch) * back;
            desiredCamera.set(walker.x + Math.sin(cameraYaw) * horizBack + Math.cos(cameraYaw) * shoulder, targetY + vertBack, walker.z + Math.cos(cameraYaw) * horizBack - Math.sin(cameraYaw) * shoulder);
            const groundUnderCam = activeHeightAt(desiredCamera.x, desiredCamera.z);
            desiredCamera.y = Math.max(desiredCamera.y, groundUnderCam + 0.45);
            if (!orbitInitialized || false)
              camera.position.copy(desiredCamera);
            camera.position.lerp(desiredCamera, 1 - Math.exp(-18 * dt));
            orbitInitialized = true;
          }
          else {
            camera.position.set(walker.x, cameraGround + 1.7 + jump.height, walker.z);
          }
          if (third && true) {
            camera.lookAt(walker.x + Math.cos(cameraYaw) * shoulder, cameraGround + jump.height + (1.45), walker.z - Math.sin(cameraYaw) * shoulder);
          }
          else {
            orbitInitialized = false;
            camera.rotation.set(pitch, cameraYaw, 0, "YXZ");
          }
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
        windDust?.update(dt, walker.x, walker.z, model.heightAt, reduced.matches, activeTier.particles);
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
            helmetLamp.intensity = rover.driving ? 0 : 2.6 * n;
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
          const inspectReady = Boolean(p.enabled && !rover.driving && hover && range <= 5.5);
          if (inspectReady !== lastCanInspect) {
            lastCanInspect = inspectReady;
            setCanInspect(inspectReady);
          }
        }
        if (firstFrame) {
          firstFrame = false;
          keys.clear();
        }
        if (curiosity && time - lastCuriositySave >= 1500) {
          lastCuriositySave = time;
          saveCuriosityNow();
        }
        if (time - lastReport > 90) {
          lastReport = time;
          if (time - lastMapReport > 500) {
            lastMapReport = time;
            mapRocks = model.obstacles.filter(o => o.topY !== undefined && Math.hypot(o.x - walker.x, o.z - walker.z) < 80)
              .sort((a, b) => Math.hypot(a.x - walker.x, a.z - walker.z) - Math.hypot(b.x - walker.x, b.z - walker.z))
              .slice(0, 48).map(o => ({ x: o.x, z: o.z, radius: o.radius }));
          }
          current.current.onView({
            mapRocks: mapRocks,
            x: walker.x,
            z: walker.z,
            lightPhase: daylightPhase(daylightElapsed),
            yaw: cameraYaw,
            target: hover,
            distance: range,
            locked: document.pointerLockElement === element,
            jumpHeight: jump.height,
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
        renderer.info.reset();
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
          const eligible = p.enabled && cameraSettings.current.quality === 'auto' && backgroundPrepared && lastQuality === candidate.profile && Math.abs(resolutionScale - candidate.scale) < .02;
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
        const activeSample = p.enabled && !landingIntro?.isActive();
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
          element.dataset.trackTextureSize = String(model.trackTextureSize ?? 0);
          element.dataset.terrainChunks = String(streaming?.count() ?? 0);
          element.dataset.visibleTerrainChunks = String(streaming?.visibleCount() ?? 0);
          element.dataset.viewDistance = String(camera.far);
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
          element.dataset.antialiasing = composer && (occlusion?.enabled || bloom?.enabled) ? "fxaa" : renderer.getContext().getContextAttributes()?.antialias ? "native" : "off";
          element.dataset.aaTexel = fxaaPass ? `${fxaaPass.uniforms.resolution.value.x},${fxaaPass.uniforms.resolution.value.y}` : "";
          const fps = metricFrames * 1000 / (time - metricStart);
          if (debugPanel.current)
            debugPanel.current.textContent = performanceReadout(cameraSettings.current.performanceMeter, {
              fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
              textures: renderer.info.memory.textures, scale: resolutionScale, tier: lastQuality,
            });
          element.dataset.graphicsProfile = lastQuality;
          if (cameraSettings.current.quality === 'auto' && true && (!backgroundProbe || backgroundProbe.done())) {
            autoState = adaptAutoGraphics(autoState, fps, activeSample, time, name => Math.min(displayRatio, graphicsTier(name).resolutionCap));
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
        if (landingIntro) {
          landingIntro.root.traverse(o => {
            if (o instanceof T.Sprite) {
              o.material.map?.dispose();
              o.material.dispose();
            }
          });
        }
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
          const preset = graphicsTier(effectiveQuality());
          lastQuality = effectiveQuality();
          model.setLightSurfaces?.(lastQuality === "performance");
          resolutionScale = Math.min(displayRatio, preset.resolutionCap);
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
        setLoadingStage("Preparing the expanding Mars landscape…");
        const ground = model.root.getObjectByName("mars-ground") as import("three").Mesh;
        streaming = createStreamedMars(model.root, ground, baseHeight, { ...terrainBudget, obstacles: model.obstacles, sampleHeight: marsExpeditionHeight, clearings: [PERSEVERANCE_CLEARING] });
        streaming.setPerformance(lastQuality === 'performance');
        streaming.update(walker.x, walker.z, terrainBudget.generationMs);
        while (streaming.pending()) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          if (cancelled)
            return;
          streaming.update(walker.x, walker.z, terrainBudget.generationMs);
        }
        (scene.fog as import("three").FogExp2).density = graphicsTier(lastQuality).fogDensity;
        await renderer.compileAsync(scene, camera);
        renderer.render(scene, camera);
        configureEffects(true);
      }
      if (cancelled)
        return;
      // Optional high-quality work happens after entry. It never holds the shuttle cover.
      const prepareBackground = async () => {
        try {
          if (effectsSupported)
            await prepareEffects();
          if (cancelled)
            return;
          model.setLightSurfaces?.(false);
          renderer.shadowMap.enabled = true;
          // compileAsync submits shaders synchronously; restore the playable preset
          // while the driver links them. Neither the actor nor camera is moved.
          const compiling = renderer.compileAsync(scene, camera);
          model.setLightSurfaces?.(effectiveQuality() === 'performance');
          renderer.shadowMap.enabled = graphicsTier(effectiveQuality()).shadows;
          await compiling;
          if (cancelled)
            return;
          if (composer) {
            resize();
            const warmComposer = composer;
            const renderToScreen = warmComposer.renderToScreen;
            warmComposer.renderToScreen = false;
            if (occlusion)
              occlusion.enabled = true;
            if (bloom)
              bloom.enabled = !reduced.matches;
            // One offscreen warm-up, not a second benchmarking render loop.
            try {
              renderEffects();
            }
            finally {
              warmComposer.renderToScreen = renderToScreen;
            }
          }
        }
        catch { /* Keep the direct renderer when optional effects are unavailable. */ }
        finally {
          if (!cancelled) {
            scene.overrideMaterial = null;
            renderer.setRenderTarget(null);
            model.setLightSurfaces?.(effectiveQuality() === 'performance');
            renderer.shadowMap.enabled = graphicsTier(effectiveQuality()).shadows;
            configureEffects();
            backgroundPrepared = true;
            backgroundProbe?.reset();
            metricStart = 0;
            metricFrames = 0;
          }
        }
      };
      applyQuality(effectiveQuality(), resolutionScale);
      if (backgroundProbe) {
        backgroundStarted = performance.now();
        const report = 'Checking FPS in the background…';
        setAutoReport(report);
        current.current.onGraphicsCalibration?.(report);
        element.dataset.calibrationState = 'checking';
        element.dataset.calibrationTarget = String(AUTO_TARGET_FPS);
        // Let the first playable frame paint before optional shader preparation.
        backgroundTimer = window.setTimeout(() => { void prepareBackground(); }, 100);
      }
      current.current.onTerrainMode?.(!!streaming);
      element.dataset.terrainMode = streaming ? "streamed" : "finite";
      frame = requestAnimationFrame(animate);
      setLoadingStage("Launching exploration…");
      setLoadingProgress(100);
      setLoaded(true);
      current.current.onReady?.();
      element.dataset.loadMs = (performance.now() - loadStarted).toFixed(0);
    }
    mount().catch((error) => {
      if (debug)
        console.error('Mars scene initialization failed', error);
      setMessage("3D is unavailable. Retry with Performance graphics.");
      current.current.onUnavailable();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(backgroundTimer);
      dispose();
    };
  }, []);
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
  return (<div ref={host} className="sv-world" data-cursor-free={cursorFree ? "true" : "false"} role="application" aria-label={`${"Mars"} ${"open world"}. ${touchControlsActive ? "Use the left thumbstick to move, drag the screen to look around, and tap the right buttons to jump or inspect." : "WASD to walk. Drag to look or capture the mouse; Q and R also turn. Space jumps. V switches view. E inspects."}`} tabIndex={0}>
   {performanceMeter !== "off" && true && (debug || (props.enabled && !introActive)) &&
      <pre key={performanceMeter} ref={debugPanel} className="mars-debug" data-mode={performanceMeter} aria-label="Graphics performance diagnostics">Measuring FPS…</pre>}
   {!loaded && (<div className="sv-loading" role="status">{loadingStage}<br /><progress aria-label="Scene preparation progress" max={100} value={loadingProgress}/><span> {loadingProgress}%</span></div>)}
   {props.enabled && !introActive && (<>
     <div ref={aim} className="sv-aim" aria-hidden="true">
      <i />
      <i />
     </div>
     <div className="sv-look-controls">
      <details open={undefined}>
      <summary aria-label="Camera and graphics">{touchControlsActive && true ? <Settings2 size={19}/> : "Camera & graphics"}</summary>
      {!touchControlsActive && (<>
        <button onClick={() => lockAction.current()}>
         {locked ? "Release mouse · Esc" : cursorFree ? "Resume mouse look" : "Capture mouse for 360° look"}
        </button>
        <span>{cursorFree ? "Cursor free for UI · click the 3D view to resume look" : "Drag to look, or click view for 360° capture · Esc frees cursor · Q/R turn · V changes view"}</span>
       </>)}
      <label>
       {touchControlsActive ? "Look sensitivity" : "Mouse sensitivity"}{" "}
       <input aria-label="Look sensitivity" type="range" min="0.3" max="2.5" step="0.1" value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))}/>
      </label>
      <button onClick={() => setThirdPerson((v) => !v)}>
       {thirdPerson ? (touchControlsActive ? "Third person view" : "Third person · V") : (touchControlsActive ? "First person view" : "First person · V")}
      </button>
      <button type="button" aria-pressed={touchControlsActive} onClick={() => setTouchOverride(!touchControlsActive)}>
       Touch controls · {touchControlsActive ? "On" : "Off"}
      </button>
      {<label>Graphics <select aria-label="Graphics quality" value={quality} onChange={e => { setQuality(e.target.value); e.currentTarget.blur(); host.current?.focus({ preventScroll: true }); }}>
       <option value="auto">Auto · {autoLabel}</option><option value="performance">Performance</option><option value="high">High</option><option value="ultra">Ultra</option>
      </select></label>}
      {autoReport && <p className="sv-auto-result">Auto check: {autoReport} Auto targets {AUTO_TARGET_FPS}+ FPS during play.</p>}
      {<label>FPS meter <select aria-label="FPS meter" value={performanceMeter} onChange={e => setPerformanceMeter(e.target.value as PerformanceMeterMode)}>
       <option value="off">Off</option><option value="fps">FPS only</option><option value="detailed">Detailed</option>
      </select></label>}
      </details>
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
          <title>{`Cabin Roof: ${Math.round(roverDamage.cabin_roof ?? roverDamage.solar_array ?? 100)}%`}</title>
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
       {!touchControlsActive && (<div className="sv-rover-hints">
         <span><b>Shift</b> Boost (High Torque)</span>
         <span><b>W / S</b> Drive / Rev</span>
         <span><b>A / D</b> Steer</span>
         <span><b>Space</b> Handbrake</span>
         <span><b>V</b> Camera</span>
        </div>)}
       <button type="button" className="sv-rover-exit-btn" onClick={() => toggleRoverAction.current()}>
        <span className="sv-key-badge">F</span> Exit Rover
       </button>
      </div>)}
     {touchControlsActive && (<TouchDeck enabled={props.enabled} roverDriving={roverDriving} roverNear={roverNear} canInspect={canInspect} thirdPerson={thirdPerson} onWalkAxes={handleWalkAxes} onDriveAxes={handleDriveAxes} onHoldKey={touch} onToggleView={handleToggleView} onToggleRover={handleToggleRover} onInspectNearby={handleInspectNearby}/>)}
    </>)}
   {loaded && introActive && props.enabled && <div className="landing-caption" role="status"><b>{introTelemetry.phase}</b><span>{introTelemetry.alt > 0.1 ? `${introTelemetry.alt.toFixed(1)} m above landing surface` : "Elysium region · Mars"}</span><button onClick={() => skipIntroAction.current()}>Skip landing</button></div>}
   {message && <p className="sv-world-message" role="status">{message}</p>}
  </div>);
}
