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
    const cappedDt = Math.min(dt, 50);
    try {
      this.updateFn(cappedDt);
      this.renderFn();
    } catch (err) {
      console.error('GameLoop crash:', err);
    }
    requestAnimationFrame((t) => this.tick(t));
  }
}
