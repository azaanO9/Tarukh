/**
 * Web Audio API Geiger Counter Click Synthesizer.
 * Radiation static noise audio removed per user request.
 */

export class GeigerAudio {
  private ctx: AudioContext | null = null;
  private muted: boolean = true;
  private initialized: boolean = false;

  constructor() {
    this.muted = true;
  }

  public setMuted(_muted: boolean): void {
    this.muted = true;
  }

  public isMuted(): boolean {
    return true;
  }

  public toggleMute(): boolean {
    return true;
  }

  public resume(): void {
    // Static sound noise from radiation (SEP) removed
  }

  /**
   * Called every frame in the render loop.
   * Radiation static sound generation is completely removed.
   */
  public update(_dt: number, _sepFluxPFU: number, _isShielded: boolean): void {
    // Static sound noise from radiation (SEP) removed
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
