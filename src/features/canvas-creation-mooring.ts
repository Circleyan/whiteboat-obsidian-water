/** Presentation only: gently sway around the berth after navigation arrives. */
export class CanvasCreationMooringMotion {
  private lastTimestamp: number | null = null;
  private strength = 0;
  private phase = 0;

  sample(timestamp: number, moored: boolean, reducedMotion: boolean) {
    const delta = this.lastTimestamp === null ? 0 :
      Math.max(0, Math.min(0.05, (timestamp - this.lastTimestamp) / 1000));
    this.lastTimestamp = timestamp;
    if (reducedMotion) {
      this.strength = 0;
      this.phase = 0;
    } else {
      const target = moored ? 1 : 0;
      // Ease in, then settle more quickly when the writer returns to the water.
      this.strength += (target - this.strength) *
        (1 - Math.exp(-delta / (moored ? 0.28 : 0.12)));
      if (!moored && this.strength < 0.001) this.strength = 0;
      this.phase = this.strength > 0 ? this.phase + delta * Math.PI * 2 / 4.8 : 0;
    }
    const sway = Math.sin(this.phase) * this.strength;
    return { offset: sway * 2.6, heading: sway * 0.045, roll: sway * 0.10 };
  }
}
