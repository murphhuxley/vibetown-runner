export class InputManager {
  private keys = new Set<string>();
  private justPressedKeys = new Set<string>();

  private normalizeKey(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key;
  }

  handleKeyDown(key: string): void {
    const normalizedKey = this.normalizeKey(key);
    if (!this.keys.has(normalizedKey)) {
      this.justPressedKeys.add(normalizedKey);
    }
    this.keys.add(normalizedKey);
  }

  handleKeyUp(key: string): void {
    this.keys.delete(this.normalizeKey(key));
  }

  isDown(key: string): boolean {
    return this.keys.has(this.normalizeKey(key));
  }

  justPressed(key: string): boolean {
    const normalizedKey = this.normalizeKey(key);
    if (this.justPressedKeys.has(normalizedKey)) {
      this.justPressedKeys.delete(normalizedKey);
      return true;
    }
    return false;
  }

  endFrame(): void {
    this.justPressedKeys.clear();
  }

  get left(): boolean {
    return this.isDown('ArrowLeft') || this.isDown('a');
  }
  get right(): boolean {
    return this.isDown('ArrowRight') || this.isDown('d');
  }
  get up(): boolean {
    return this.isDown('ArrowUp') || this.isDown('w');
  }
  get down(): boolean {
    return this.isDown('ArrowDown') || this.isDown('s');
  }
  get digLeft(): boolean {
    return this.isDown('z');
  }
  get digRight(): boolean {
    return this.isDown('x') || this.isDown('c');
  }
  get activateLFV(): boolean {
    return this.isDown(' ');
  }

  bind(): void {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      this.handleKeyDown(e.key);
    });
    window.addEventListener('keyup', (e) => {
      this.handleKeyUp(e.key);
    });
  }
}
