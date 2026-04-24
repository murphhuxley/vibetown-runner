export class GameLoop {
  private lastTime = 0;
  private running = false;
  private updateFn: (dt: number) => void;
  private renderFn: () => void;

  constructor(update: (dt: number) => void, render: () => void) {
    this.updateFn = update;
    this.renderFn = render;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
  }

  private tick(time: number): void {
    if (!this.running) return;
    const dt = time - this.lastTime;
    this.lastTime = time;
    // Mobile Safari can occasionally deliver 60-100ms frames during compositing.
    // A 50ms cap made those dips play in slow motion, so allow enough catch-up
    // without letting a background-tab resume jump the whole simulation.
    const cappedDt = Math.min(dt, 100);
    try {
      this.updateFn(cappedDt);
      this.renderFn();
    } catch (err) {
      console.error('GameLoop crash:', err);
    }
    requestAnimationFrame((t) => this.tick(t));
  }
}
