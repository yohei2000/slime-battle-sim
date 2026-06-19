import Phaser from "phaser";
import type { Vector2Like } from "../sim/types";
import { clamp } from "../sim/vector";

export class CameraController {
  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {}

  panByScreenDelta(delta: Vector2Like): void {
    this.camera.scrollX -= delta.x / this.camera.zoom;
    this.camera.scrollY -= delta.y / this.camera.zoom;
    this.clampScroll();
  }

  zoomBy(factor: number, screenCenter?: Vector2Like): void {
    const previousCenter = { x: this.camera.midPoint.x, y: this.camera.midPoint.y };
    const before = screenCenter
      ? this.camera.getWorldPoint(screenCenter.x, screenCenter.y)
      : undefined;
    this.camera.setZoom(clamp(this.camera.zoom * factor, 0.24, 1.75));
    if (before && screenCenter) {
      const after = this.camera.getWorldPoint(screenCenter.x, screenCenter.y);
      this.camera.scrollX += before.x - after.x;
      this.camera.scrollY += before.y - after.y;
    } else {
      this.camera.centerOn(previousCenter.x, previousCenter.y);
    }
    this.clampScroll();
  }

  fitAll(viewWidth: number, viewHeight: number): void {
    const zoom = clamp(Math.min(viewWidth / this.worldWidth, viewHeight / this.worldHeight) * 0.92, 0.24, 1.2);
    this.camera.setZoom(zoom);
    this.camera.centerOn(this.worldWidth / 2, this.worldHeight / 2);
    this.clampScroll();
  }

  private clampScroll(): void {
    const visibleWidth = this.camera.width / this.camera.zoom;
    const visibleHeight = this.camera.height / this.camera.zoom;
    const halfWidth = visibleWidth * 0.5;
    const halfHeight = visibleHeight * 0.5;
    const centerX =
      visibleWidth >= this.worldWidth
        ? this.worldWidth * 0.5
        : clamp(this.camera.midPoint.x, halfWidth, this.worldWidth - halfWidth);
    const centerY =
      visibleHeight >= this.worldHeight
        ? this.worldHeight * 0.5
        : clamp(this.camera.midPoint.y, halfHeight, this.worldHeight - halfHeight);
    this.camera.centerOn(centerX, centerY);
  }
}
