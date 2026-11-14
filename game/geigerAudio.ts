/**
 * Web Audio API Geiger Counter Click Synthesizer.
 * Synthesizes authentic physical click impulses with Poisson-distributed intervals
 * scaling with solar proton flux (PFU).
 */

export class GeigerAudio {
  private ctx: AudioContext | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private gainNode: GainNode | null = null;
  private lastClickTime: number = 0;
  private nextIntervalSec: number = 2.0;
  private muted: boolean = false;
  private initialized: boolean = false;

  constructor() {
    // Lazily initialized upon first interaction to comply with autoplay policy
  }

  private initAudio(): void {
    if (this.initialized || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.18; // Atmospheric, non-fatiguing volume
      this.gainNode.connect(this.ctx.destination);

      // Pre-synthesize an authentic Geiger discharge click impulse (4ms)
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 0.0045);
      this.clickBuffer = this.ctx.createBuffer(1, length, sampleRate);
      const channel = this.clickBuffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Exponential decay envelope
        const env = Math.exp(-t * 22);
        // High frequency ionization crackle + pulse
        const noise = (Math.random() * 2 - 1);
        const osc = Math.sin(t * Math.PI * 24);
        channel[i] = (noise * 0.7 + osc * 0.3) * env;
      }

      this.initialized = true;
    } catch {
      // AudioContext unavailable
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public resume(): void {
    if (!this.initialized) {
      this.initAudio();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  /**
   * Called every frame in the render loop.
   * @param dt Frame delta time in seconds
   * @param sepFluxPFU Active >=10 MeV proton flux in PFU
   * @param isShielded Whether the astronaut is inside a shielded shelter
   */
  public update(dt: number, sepFluxPFU: number, isShielded: boolean): void {
    if (this.muted) return;
    if (!this.initialized) return;
    if (!this.ctx || this.ctx.state !== "running" || !this.clickBuffer || !this.gainNode) return;

    // Shielding cuts proton exposure and lowers clicking significantly
    const effectivePFU = isShielded ? Math.min(0.2, sepFluxPFU * 0.01) : sepFluxPFU;

    // Determine target clicks per second based on PFU
    let targetRate: number;
    if (effectivePFU < 1) {
      // Background cosmic rays: ~1 click every 3 to 5 seconds
      targetRate = 0.25;
    } else if (effectivePFU < 10) {
      targetRate = 1.0 + (effectivePFU / 10) * 3; // 1 to 4 clicks/s
    } else if (effectivePFU < 100) {
      targetRate = 5 + (effectivePFU / 100) * 15; // 5 to 20 clicks/s
    } else if (effectivePFU < 1000) {
      targetRate = 20 + (effectivePFU / 1000) * 50; // 20 to 70 clicks/s
    } else if (effectivePFU < 10000) {
      targetRate = 70 + (effectivePFU / 10000) * 80; // 70 to 150 clicks/s
    } else {
      targetRate = 160 + Math.min(80, (effectivePFU / 30000) * 80); // 160 to 240 clicks/s
    }

    this.lastClickTime += dt;
    if (this.lastClickTime >= this.nextIntervalSec) {
      this.playClick();
      this.lastClickTime = 0;
      // Exponential / Poisson random distribution
      this.nextIntervalSec = -Math.log(Math.max(0.0001, Math.random())) / targetRate;
      // Clamp bounds
      this.nextIntervalSec = Math.max(0.003, Math.min(6.0, this.nextIntervalSec));
    }
  }

  private playClick(): void {
    if (!this.ctx || !this.clickBuffer || !this.gainNode) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.clickBuffer;
      // Slight pitch variance for realism
      src.playbackRate.value = 0.85 + Math.random() * 0.35;
      src.connect(this.gainNode);
      src.start();
    } catch {
      // Audio playback interrupted
    }
  }

  public dispose(): void {
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        // Ignored
      }
      this.ctx = null;
    }
  }
}
