import type {
  ArmySlime,
  GesturePreviewState,
  SlimePosture,
  Vector2Like,
} from "../sim/types";
import { issueOrder } from "../sim/slimeOrders";
import {
  add,
  clamp,
  dot,
  length,
  normalize,
  rotate,
  scale,
  sub,
} from "../sim/vector";
import {
  analyzeTwoFingerGesture,
  type TwoFingerGestureKind,
} from "./GestureAnalyzer";

export class PinchGestureController {
  private startA: Vector2Like = { x: 0, y: 0 };
  private startB: Vector2Like = { x: 0, y: 0 };
  private startCenter: Vector2Like = { x: 0, y: 0 };
  private latestCenter: Vector2Like = { x: 0, y: 0 };
  private scaleValue = 1;
  private rotation = 0;
  private leftWingAdvance = 0;
  private rightWingAdvance = 0;
  private gesture: TwoFingerGestureKind = "spread";
  private active = false;

  begin(a: Vector2Like, b: Vector2Like): void {
    this.startA = { ...a };
    this.startB = { ...b };
    this.startCenter = scale(add(a, b), 0.5);
    this.latestCenter = { ...this.startCenter };
    this.scaleValue = 1;
    this.rotation = 0;
    this.leftWingAdvance = 0;
    this.rightWingAdvance = 0;
    this.gesture = "spread";
    this.active = true;
  }

  move(a: Vector2Like, b: Vector2Like, slime: ArmySlime): GesturePreviewState {
    this.latestCenter = scale(add(a, b), 0.5);
    const analysis = analyzeTwoFingerGesture(
      this.startA,
      this.startB,
      a,
      b,
      slime.facing,
    );
    this.scaleValue = analysis.scale;
    this.rotation = analysis.rotation;
    this.gesture = analysis.kind;
    this.leftWingAdvance = analysis.leftWingAdvance;
    this.rightWingAdvance = analysis.rightWingAdvance;
    const centroidMotion = analysis.centroidMotion;
    const forwardMotion = analysis.forwardMotion;
    const movingForward = forwardMotion > 22;

    const width = clamp(slime.currentWidth * this.scaleValue, 145, 450);
    const depth = clamp(
      slime.currentDepth / Math.pow(this.scaleValue, 0.72),
      110,
      290,
    );
    const direction =
      this.gesture === "rotate"
        ? rotate(slime.facing, this.rotation)
        : movingForward
          ? normalize(centroidMotion)
          : slime.facing;

    return {
      active: true,
      mode: this.gesture,
      center: slime.center,
      width,
      depth,
      start: this.startCenter,
      end: this.latestCenter,
      direction,
      rotation: this.rotation,
      leftWingAdvance: this.leftWingAdvance,
      rightWingAdvance: this.rightWingAdvance,
      confidence:
        this.gesture === "breakthrough" &&
        forwardMotion > 75 &&
        slime.breakthroughPower > 0.62
          ? "高"
          : slime.breakthroughPower > 0.46
            ? "中"
            : "低",
    };
  }

  commit(slime: ArmySlime, now: number): boolean {
    if (!this.active) return false;

    const centroidMotion = sub(this.latestCenter, this.startCenter);
    const forwardMotion = dot(centroidMotion, slime.facing);
    const hasShapeChange = Math.abs(this.scaleValue - 1) >= 0.06;
    const hasSpecialGesture =
      this.gesture === "rotate" ||
      this.gesture === "left-wing" ||
      this.gesture === "right-wing";
    if (!hasShapeChange && !hasSpecialGesture) {
      this.reset();
      return false;
    }

    const isAdvance =
      this.gesture === "breakthrough" || this.gesture === "envelop-advance";
    const envelopAdvance =
      this.gesture === "envelop-advance"
        ? clamp(Math.max(70, forwardMotion * 0.82), 70, 175)
        : 0;
    const width =
      this.gesture === "rotate" ||
      this.gesture === "left-wing" ||
      this.gesture === "right-wing"
        ? slime.desiredWidth
        : this.gesture === "envelop-advance"
          ? clamp(slime.currentWidth * this.scaleValue * 1.12, 185, 520)
          : clamp(slime.currentWidth * this.scaleValue, 145, 450);
    const depth =
      this.gesture === "rotate" ||
      this.gesture === "left-wing" ||
      this.gesture === "right-wing"
        ? slime.desiredDepth
        : this.gesture === "envelop-advance"
          ? clamp(
              slime.currentDepth / Math.pow(this.scaleValue, 0.54),
              118,
              255,
            )
          : clamp(
              slime.currentDepth / Math.pow(this.scaleValue, 0.72),
              110,
              290,
            );
    const targetDirection =
      this.gesture === "rotate"
        ? rotate(slime.facing, this.rotation)
        : isAdvance && length(centroidMotion) > 0
          ? normalize(centroidMotion)
          : slime.facing;
    const targetCenter = isAdvance
      ? add(
          slime.center,
          scale(
            targetDirection,
            Math.min(
              this.gesture === "envelop-advance" ? 190 : 240,
              Math.max(70, forwardMotion * (this.gesture === "envelop-advance" ? 1.18 : 1.55)),
            ),
          ),
        )
      : slime.desiredCenter;
    const posture: SlimePosture =
      this.gesture === "breakthrough"
        ? "breakthrough"
        : this.gesture === "envelop-advance"
          ? "envelop"
          : this.gesture === "spread"
            ? "spread"
            : this.gesture === "contract"
              ? "contract"
              : slime.posture === "hold"
                ? "neutral"
                : slime.posture;

    issueOrder(slime, {
      posture,
      targetCenter,
      targetDirection,
      targetWidth: width,
      targetDepth: depth,
      targetDensity: clamp((250 * 180) / (width * depth), 0.62, 1.65),
      targetLeftWingAdvance: this.leftWingAdvance + envelopAdvance,
      targetRightWingAdvance: this.rightWingAdvance + envelopAdvance,
      issuedAt: now,
    });
    this.reset();
    return true;
  }

  reset(): void {
    this.active = false;
    this.scaleValue = 1;
    this.rotation = 0;
    this.leftWingAdvance = 0;
    this.rightWingAdvance = 0;
  }
}
