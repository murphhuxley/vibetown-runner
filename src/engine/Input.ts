export class InputManager {
  private keys = new Set<string>();
  private justPressedKeys = new Set<string>();

  handleKeyDown(key: string): void {
    if (!this.keys.has(key)) {
      this.justPressedKeys.add(key);
    }
    this.keys.add(key);
  }

  handleKeyUp(key: string): void {
    this.keys.delete(key);
  }

  isDown(key: string): boolean {
    return this.keys.has(key);
  }

  justPressed(key: string): boolean {
    if (this.justPressedKeys.has(key)) {
      this.justPressedKeys.delete(key);
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
      e.preventDefault();
      this.handleKeyDown(e.key);
    });
    window.addEventListener('keyup', (e) => {
      this.handleKeyUp(e.key);
    });
  }
}
