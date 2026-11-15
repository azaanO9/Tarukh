/**
 * Space Weather Service: Real-time NOAA SWPC GOES proton telemetry & historical NASA DONKI SEP superstorm replays.
 *
 * Scientific Sources:
 * - NOAA SWPC: GOES integral proton flux (>=10 MeV), PFU (particles / (cm^2 * s * sr))
 *   https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json
 * - NASA DONKI: Solar Energetic Particle (SEP) events
 *   https://api.nasa.gov/DONKI/SEP
 */

export type SpaceWeatherMode = "live" | "historical";

export type StormScale = "S0 NOMINAL" | "S1 MINOR" | "S2 MODERATE" | "S3 STRONG" | "S4 EXTREME";

export interface HistoricalSEPEvent {
  readonly id: string;
  readonly name: string;
  readonly dateRange: string;
  readonly flareClass: string;
  readonly peakPFU: number;
  readonly stormScale: StormScale;
  readonly description: string;
  readonly rampDurationSec: number;
}

export const HISTORICAL_SEP_EVENTS: readonly HistoricalSEPEvent[] = [
  {
    id: "2024-05-13T09:33:00-SEP-001",
    name: "May 2024 Solar Superstorm",
    dateRange: "2024-05-10 to 2024-05-15",
    flareClass: "X8.7 (Active Region AR3664)",
    peakPFU: 240,
    stormScale: "S2 MODERATE",
    description: "Triggered by active region AR3664; directly impacted Mars, recorded by NASA MAVEN and Curiosity RAD.",
    rampDurationSec: 20,
  },
  {
    id: "2017-09-10T16:45:00-SEP-001",
    name: "September 2017 Mars Surface Event",
    dateRange: "2017-09-10 to 2017-09-14",
    flareClass: "X8.2 Solar Flare",
    peakPFU: 1490,
    stormScale: "S3 STRONG",
    description: "Ground-level event doubling Martian surface radiation dose recorded by Curiosity RAD.",
    rampDurationSec: 25,
  },
  {
    id: "2003-10-28T11:10:00-SEP-001",
    name: "Halloween 2003 Extreme Storm",
    dateRange: "2003-10-28",
    flareClass: "X17.2 / X28+ Flare",
    peakPFU: 29500,
    stormScale: "S4 EXTREME",
    description: "Historical extreme benchmark superstorm; massive solar proton deluge inundating interplanetary space.",
    rampDurationSec: 30,
  },
];

export interface SpaceWeatherTelemetry {
  readonly mode: SpaceWeatherMode;
  readonly sepFluxPFU: number;
  readonly stormScale: StormScale;
  readonly activeEvent: HistoricalSEPEvent | null;
  readonly isLiveConnected: boolean;
  readonly lastFetchTime: number;
  readonly replayProgress: number; // 0 to 1
  readonly statusMessage: string;
}

/** Determines NOAA Solar Radiation Storm Scale based on >=10 MeV proton flux (PFU). */
export function getStormScale(pfu: number): StormScale {
  if (pfu < 10) return "S0 NOMINAL";
  if (pfu < 100) return "S1 MINOR";
  if (pfu < 1000) return "S2 MODERATE";
  if (pfu < 10000) return "S3 STRONG";
  return "S4 EXTREME";
}

export interface EnvironmentalShieldingState {
  readonly inBase: boolean;
  readonly inRover: boolean;
  readonly mitigationMultiplier: number;
  readonly label: string;
}

/** Existing landing-habitat zone plus the actual outpost, greenhouse or garage interior. */
export function isBaseShelter(x: number, z: number, insideFacility: boolean): boolean {
  return insideFacility || x * x + (z - 12) * (z - 12) <= 10.5 * 10.5;
}

const BASE_SHIELD: EnvironmentalShieldingState = Object.freeze({inBase:true, inRover:false, mitigationMultiplier:0, label:"100% (HABITAT)"});
const ROVER_SHIELD: EnvironmentalShieldingState = Object.freeze({inBase:false, inRover:true, mitigationMultiplier:.5, label:"50% (ROVER)"});
const SURFACE_SHIELD: EnvironmentalShieldingState = Object.freeze({inBase:false, inRover:false, mitigationMultiplier:1, label:"0% (UNSHIELDED)"});

/**
 * Determines environmental radiation shielding status based on player location.
 * - Habitat Base Interior: 100% mitigation (0x radiation damage, completely safe)
 * - 6-Wheel Rover Chassis: 50% mitigation (0.5x radiation damage)
 * - Martian Surface EVA: 0% mitigation (1.0x radiation damage, unshielded)
 */
export function getEnvironmentalShielding(inBase: boolean, inRover: boolean): EnvironmentalShieldingState {
  return inBase ? BASE_SHIELD : inRover ? ROVER_SHIELD : SURFACE_SHIELD;
}

/**
 * Calculates radiation exposure delta (mSv) for a given timestep.
 * - Inside Shielded Habitat / Lava Tube: decontamination at -1.5 mSv/sec
 * - Outside in Quiet Baseline (<10 PFU): +0.05 mSv/sec (Galactic Cosmic Rays)
 * - Outside in Active SEP Storm (>=10 PFU): 0.6 + log10(PFU) * 1.4 mSv/sec
 *
 * @param sepFluxPFU Active >=10 MeV proton flux in PFU
 * @param isShielded Whether the player is inside a fully shielded base habitat
 * @param dt Frame delta time in seconds
 * @param mitigationMultiplier Damage/exposure mitigation factor (1.0 = exposed surface, 0.5 = rover, 0 = shielded base)
 */
export function calculateExposureDelta(
  sepFluxPFU: number,
  isShielded: boolean,
  dt: number,
  mitigationMultiplier: number = 1.0,
): number {
  if (isShielded || mitigationMultiplier <= 0) {
    return -1.5 * dt;
  }
  if (sepFluxPFU < 10) {
    return 0.05 * mitigationMultiplier * dt;
  }
  const exposureRate = (0.6 + Math.log10(Math.max(10, sepFluxPFU)) * 1.4) * mitigationMultiplier;
  return exposureRate * dt;
}

/**
 * Calculates damage drain rate applied to astronaut health / suit integrity.
 * Applies mitigation multiplier (100% in base = 0x damage, 50% in rover = 0.5x damage).
 */
export function calculateRadiationDrain(
  exposure: number,
  isShielded: boolean,
  mitigationMultiplier: number,
  dt: number,
): number {
  if (isShielded || mitigationMultiplier <= 0 || exposure < 75) {
    return 0;
  }
  const baseRate = exposure >= 90 ? 4.5 : 2.5;
  return baseRate * mitigationMultiplier * dt;
}

export class SpaceWeatherService {
  private mode: SpaceWeatherMode = "live";
  private liveFluxPFU: number = 0.24;
  private isLiveConnected: boolean = false;
  private lastFetchTime: number = 0;
  private pollTimer: number | null = null;
  private selectedEventIndex: number = 0;
  private replayElapsedSec: number = 0;
  private isReplaying: boolean = false;
  private statusMessage: string = "Connecting to NOAA SWPC Live Telemetry…";

  constructor() {
    this.startLivePolling();
  }

  public getMode(): SpaceWeatherMode {
    return this.mode;
  }

  public setMode(mode: SpaceWeatherMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === "historical") {
      this.replayElapsedSec = 0;
      this.isReplaying = true;
      const event = HISTORICAL_SEP_EVENTS[this.selectedEventIndex];
      this.statusMessage = `Replaying NASA DONKI Archive: ${event.name}`;
    } else {
      this.isReplaying = false;
      this.statusMessage = this.isLiveConnected
        ? "Live NOAA SWPC Feed Active"
        : "Live Telemetry Baseline (0.2 PFU)";
      this.fetchLiveTelemetry();
    }
  }

  public toggleMode(): SpaceWeatherMode {
    const nextMode: SpaceWeatherMode = this.mode === "live" ? "historical" : "live";
    this.setMode(nextMode);
    return nextMode;
  }

  public selectHistoricalEvent(index: number): void {
    this.selectedEventIndex = (index + HISTORICAL_SEP_EVENTS.length) % HISTORICAL_SEP_EVENTS.length;
    this.replayElapsedSec = 0;
    this.isReplaying = true;
    const event = HISTORICAL_SEP_EVENTS[this.selectedEventIndex];
    this.statusMessage = `Replaying NASA DONKI Archive: ${event.name}`;
  }

  public nextHistoricalEvent(): void {
    this.selectHistoricalEvent(this.selectedEventIndex + 1);
  }

  public getSelectedEvent(): HistoricalSEPEvent {
    return HISTORICAL_SEP_EVENTS[this.selectedEventIndex];
  }

  public getEventIndex(): number {
    return this.selectedEventIndex;
  }

  public update(dt: number): SpaceWeatherTelemetry {
    let flux = this.liveFluxPFU;
    let progress = 1;
    let activeEvent: HistoricalSEPEvent | null = null;

    if (this.mode === "historical") {
      activeEvent = HISTORICAL_SEP_EVENTS[this.selectedEventIndex];
      this.replayElapsedSec += dt;
      const duration = activeEvent.rampDurationSec;
      progress = Math.min(1, this.replayElapsedSec / duration);

      // Smooth cubic ease-in-out ramp curve from quiet baseline (0.2 PFU) to peak PFU
      const smooth = progress * progress * (3 - 2 * progress);
      const baseline = 0.2;
      const targetPeak = activeEvent.peakPFU;
      
      // When at peak, add subtle realistic high-frequency fluctuations (+-2%)
      const peakNoise = progress >= 1 ? (Math.sin(this.replayElapsedSec * 3) * 0.02) : 0;
      flux = baseline + (targetPeak - baseline) * smooth * (1 + peakNoise);
    } else {
      flux = this.liveFluxPFU;
    }

    const stormScale = getStormScale(flux);

    return {
      mode: this.mode,
      sepFluxPFU: Math.max(0.01, flux),
      stormScale,
      activeEvent,
      isLiveConnected: this.isLiveConnected,
      lastFetchTime: this.lastFetchTime,
      replayProgress: progress,
      statusMessage: this.statusMessage,
    };
  }

  public async fetchLiveTelemetry(): Promise<void> {
    try {
      // 1. Fetch NOAA SWPC GOES integral protons (>=10 MeV)
      const res = await fetch("https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const tenMev = data.filter((d: { energy?: string; flux?: number }) => d.energy === ">=10 MeV");
          if (tenMev.length > 0) {
            const latest = tenMev[tenMev.length - 1];
            if (typeof latest.flux === "number" && !isNaN(latest.flux)) {
              this.liveFluxPFU = Math.max(0.05, latest.flux);
              this.isLiveConnected = true;
              this.lastFetchTime = Date.now();
              this.statusMessage = "NOAA SWPC Live Feed Connected";
            }
          }
        }
      }
    } catch {
      // Offline fallback: Maintain nominal baseline flux without throwing
      this.isLiveConnected = false;
      this.statusMessage = "Live Feed Offline (Nominal Baseline: 0.24 PFU)";
    }
  }

  private startLivePolling(): void {
    void this.fetchLiveTelemetry();
    if (typeof window !== "undefined") {
      this.pollTimer = window.setInterval(() => {
        if (this.mode === "live") {
          void this.fetchLiveTelemetry();
        }
      }, 60000);
    }
  }

  public dispose(): void {
    if (this.pollTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
