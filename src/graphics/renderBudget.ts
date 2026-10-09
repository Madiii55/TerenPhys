/** Resolution is independent of the DOM/UI and bounded even on 4K/Retina screens. */
export function cosmicRenderSize(width: number, height: number, dpr: number, quality = 1, mobile = false) {
  const area = Math.max(1, width * height);
  const outputRatio = Math.min(Math.max(dpr, 0.5), 1.25, Math.sqrt(2_400_000 / area));
  const ratio = Math.min(outputRatio, Math.sqrt((mobile ? 650_000 : 1_150_000) / area))
    * Math.max(0.55, Math.min(1, quality));
  return {
    outputRatio,
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
  };
}

/** Fast downshift, slow recovery; never resize targets in the middle of a zoom. */
export class AdaptiveRenderBudget {
  quality = 1;
  private elapsed = 0;
  private frames = 0;
  private healthyMs = 0;
  private cooldownMs = 1800;

  reset() {
    this.elapsed = this.frames = this.healthyMs = 0;
    this.cooldownMs = 1800;
  }

  sample(frameMs: number, settled: boolean) {
    if (!settled || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 150) {
      this.reset();
      return false;
    }
    if (this.cooldownMs > 0) { this.cooldownMs -= frameMs; return false; }
    this.elapsed += frameMs;
    this.frames++;
    if (this.elapsed < 1200) return false;
    const mean = this.elapsed / this.frames;
    this.healthyMs = mean < 18.5 ? this.healthyMs + this.elapsed : 0;
    this.elapsed = this.frames = 0;
    const next = mean > 22 ? Math.max(0.55, this.quality - 0.1)
      : this.healthyMs > 9000 ? Math.min(1, this.quality + 0.05) : this.quality;
    if (Math.abs(next - this.quality) < 0.001) return false;
    this.quality = next;
    this.reset();
    return true;
  }
}

/** Deadline scheduling avoids 60 → 30 FPS drops caused by sub-ms RAF jitter. */
export class CosmicFramePacer {
  private next = 0;
  reset() { this.next = 0; }
  due(now: number, fps = 60) {
    if (now + 0.75 < this.next) return false;
    this.next = Math.max(this.next + 1000 / fps, now + 1000 / fps * 0.25);
    return true;
  }
}
