import type { ArmySlime, GesturePreviewState, Vector2Like } from "../sim/types";
import { issueOrder } from "../sim/slimeOrders";
import { add, clamp, distance, length, normalize, scale, sub } from "../sim/vector";

export class PinchGestureController {
  private startDistance = 0;
  private startCenter: Vector2Like = { x: 0, y: 0 };
  private latestCenter: Vector2Like = { x: 0, y: 0 };
  private scaleValue = 1;
  private active = false;

  begin(a: Vector2Like, b: Vector2Like): void {
    this.startDistance = Math.max(10, distance(a, b));
    this.startCenter = scale(add(a, b), 0.5);
    this.latestCenter = { ...this.startCenter };
    this.scaleValue = 1;
    this.active = true;
  }

  move(a: Vector2Like, b: Vector2Like, slime: ArmySlime): GesturePreviewState {
    const currentDistance = Math.max(10, distance(a, b));
    this.scaleValue = clamp(currentDistance / this.startDistance, 0.56, 1.62);
    this.latestCenter = scale(add(a, b), 0.5);
    const centroidMotion = sub(this.latestCenter, this.startCenter);
    const motionAlongFacing = length(centroidMotion) > 8
      ? Math.max(0, centroidMotion.x * slime.facing.x + centroidMotion.y * slime.facing.y)
      : 0;
    const spreading = this.scaleValue >= 1;
    const breakthrough = !spreading && motionAlongFacing > 34;
    const envelop = spreading && this.scaleValue > 1.16;
    const width = clamp(slime.currentWidth * this.scaleValue, 145, 450);
    const depth = clamp(slime.currentDepth / Math.pow(this.scaleValue, 0.72), 110, 290);
    return {
      active: true,
      mode: breakthrough ? "breakthrough" : envelop ? "envelop" : spreading ? "spread" : "contract",
      center: slime.center,
      width,
      depth,
      start: this.startCenter,
      end: this.latestCenter,
      confidence:
        breakthrough && motionAlongFacing > 80 && slime.breakthroughPower > 0.62
          ? "高"
          : slime.breakthroughPower > 0.46
            ? "中"
            : "低",
    };
  }

  commit(slime: ArmySlime, now: number): boolean {
    if (!this.active || Math.abs(this.scaleValue - 1) < 0.06) {
      this.reset();
      return false;
    }
    const motion = sub(this.latestCenter, this.startCenter);
    const spreading = this.scaleValue > 1;
    const movingForward = length(motion) > 34 && motion.x * slime.facing.x + motion.y * slime.facing.y > 28;
    const posture = !spreading && movingForward
      ? "breakthrough"
      : spreading && this.scaleValue > 1.16
        ? "envelop"
        : spreading
          ? "spread"
          : "contract";
    const width = clamp(slime.currentWidth * this.scaleValue, 145, 450);
    const depth = clamp(slime.currentDepth / Math.pow(this.scaleValue, 0.72), 110, 290);
    const targetDirection = movingForward ? normalize(motion) : slime.facing;
    const targetCenter = movingForward
      ? add(slime.center, scale(targetDirection, Math.min(230, length(motion) * 1.4)))
      : slime.desiredCenter;
    issueOrder(slime, {
      posture,
      targetCenter,
      targetDirection,
      targetWidth: width,
      targetDepth: depth,
      targetDensity: clamp((250 * 180) / (width * depth), 0.62, 1.65),
      issuedAt: now,
    });
    this.reset();
    return true;
  }

  reset(): void {
    this.active = false;
    this.scaleValue = 1;
  }
}
