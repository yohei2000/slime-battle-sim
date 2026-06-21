import type {
  ArmySlime,
  GesturePreviewState,
  SlimePosture,
  Vector2Like,
} from "../sim/types";
import { pointInsideSlime } from "../sim/slime";
import { issueOrder } from "../sim/slimeOrders";
import {
  add,
  clamp,
  distance,
  dot,
  length,
  normalize,
  perpendicular,
  rotate,
  scale,
  sub,
} from "../sim/vector";
import {
  analyzeTwoFingerGesture,
  type TwoFingerGestureKind,
} from "./GestureAnalyzer";

type FocusTarget = {
  enemy: ArmySlime;
  point: Vector2Like;
};

export class PinchGestureController {
  private startA: Vector2Like = { x: 0, y: 0 };
  private startB: Vector2Like = { x: 0, y: 0 };
  private startCenter: Vector2Like = { x: 0, y: 0 };
  private latestCenter: Vector2Like = { x: 0, y: 0 };
  private scaleValue = 1;
  private rotation = 0;
  private leftWingAdvance = 0;
  private rightWingAdvance = 0;
  private focusTarget?: FocusTarget;
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
    this.focusTarget = undefined;
    this.gesture = "spread";
    this.active = true;
  }

  move(
    a: Vector2Like,
    b: Vector2Like,
    slime: ArmySlime,
    enemies: ArmySlime[] = [],
  ): GesturePreviewState {
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
    this.focusTarget = this.resolveFocusTarget(
      this.latestCenter,
      slime,
      enemies,
      movingForward ||
        this.gesture === "breakthrough" ||
        this.gesture === "envelop-advance",
    );
    const focusDirection = this.focusTarget
      ? normalize(sub(this.focusTarget.point, slime.center))
      : undefined;

    const width = clamp(slime.currentWidth * this.scaleValue, 145, 450);
    const depth = clamp(
      slime.currentDepth / Math.pow(this.scaleValue, 0.72),
      110,
      290,
    );
    const direction =
      this.gesture === "rotate"
        ? rotate(slime.facing, this.rotation)
        : focusDirection &&
            (this.gesture === "breakthrough" ||
              this.gesture === "envelop-advance" ||
              this.gesture === "spread")
          ? focusDirection
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
      targetPoint: this.focusTarget?.point,
      focusMode: this.focusTarget
        ? this.gesture === "breakthrough" || this.gesture === "contract"
          ? "breakthrough"
          : "envelop"
        : undefined,
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

  commit(
    slime: ArmySlime,
    now: number,
    enemies: ArmySlime[] = [],
  ): boolean {
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
    const focus =
      this.focusTarget ??
      this.resolveFocusTarget(this.latestCenter, slime, enemies, isAdvance);
    const focusDirection = focus
      ? normalize(sub(focus.point, slime.center))
      : undefined;
    const focusDrivenShape =
      Boolean(focus) &&
      (this.gesture === "spread" || this.gesture === "contract");
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
        : focusDirection &&
            (this.gesture === "breakthrough" ||
              this.gesture === "envelop-advance" ||
              this.gesture === "spread" ||
              this.gesture === "contract")
          ? focusDirection
        : isAdvance && length(centroidMotion) > 0
          ? normalize(centroidMotion)
          : slime.facing;
    const targetCenter = isAdvance || focusDrivenShape
      ? add(
          slime.center,
          scale(
            targetDirection,
            Math.min(
              this.gesture === "envelop-advance" || this.gesture === "spread"
                ? 190
                : 240,
              focus
                ? Math.max(
                    80,
                    distance(slime.center, focus.point) *
                      (this.gesture === "envelop-advance" ||
                      this.gesture === "spread"
                        ? 0.58
                        : 0.7),
                  )
                : Math.max(70, forwardMotion * (this.gesture === "envelop-advance" ? 1.18 : 1.55)),
            ),
          ),
        )
      : slime.desiredCenter;
    const posture: SlimePosture =
      this.gesture === "breakthrough"
        ? "breakthrough"
        : this.gesture === "contract" && Boolean(focus)
          ? "breakthrough"
        : this.gesture === "envelop-advance" ||
            (this.gesture === "spread" && Boolean(focus))
          ? "envelop"
          : this.gesture === "spread"
            ? "spread"
            : this.gesture === "contract"
              ? "contract"
              : slime.posture === "hold"
              ? "neutral"
              : slime.posture;
    const focusWingBias = posture === "envelop" && focus
      ? this.focusWingBias(focus, targetDirection)
      : { left: 0, right: 0 };

    issueOrder(slime, {
      posture,
      targetCenter,
      targetDirection,
      targetWidth: width,
      targetDepth: depth,
      targetDensity: clamp((250 * 180) / (width * depth), 0.62, 1.65),
      targetLeftWingAdvance:
        this.leftWingAdvance + envelopAdvance + focusWingBias.left,
      targetRightWingAdvance:
        this.rightWingAdvance + envelopAdvance + focusWingBias.right,
      targetFocusPoint:
        posture === "breakthrough" || posture === "envelop"
          ? focus?.point
          : undefined,
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
    this.focusTarget = undefined;
  }

  private resolveFocusTarget(
    referencePoint: Vector2Like,
    slime: ArmySlime,
    enemies: ArmySlime[],
    allowProjected: boolean,
  ): FocusTarget | undefined {
    const direct = enemies.find((enemy) =>
      pointInsideSlime(enemy, referencePoint, 145),
    );
    if (direct) return { enemy: direct, point: { ...referencePoint } };
    if (!allowProjected || enemies.length === 0) return undefined;

    const motion = sub(referencePoint, this.startCenter);
    const motionDirection =
      length(motion) > 8 ? normalize(motion) : normalize(sub(enemies[0].center, slime.center));
    let bestEnemy = enemies[0];
    let bestScore = -Infinity;
    for (const enemy of enemies) {
      const toEnemy = normalize(sub(enemy.center, slime.center));
      const score =
        dot(toEnemy, motionDirection) * 900 -
        distance(enemy.center, slime.center) * 0.25;
      if (score > bestScore) {
        bestEnemy = enemy;
        bestScore = score;
      }
    }

    const axis = normalize(sub(bestEnemy.center, slime.center));
    const lateral = perpendicular(axis);
    const relative = sub(referencePoint, bestEnemy.center);
    const lateralOffset = clamp(
      dot(relative, lateral),
      -bestEnemy.currentWidth * 0.46,
      bestEnemy.currentWidth * 0.46,
    );
    const forwardOffset = clamp(
      dot(relative, axis),
      -bestEnemy.currentDepth * 0.28,
      bestEnemy.currentDepth * 0.34,
    );
    return {
      enemy: bestEnemy,
      point: add(
        bestEnemy.center,
        add(scale(axis, forwardOffset), scale(lateral, lateralOffset)),
      ),
    };
  }

  private focusWingBias(
    focus: FocusTarget,
    direction: Vector2Like,
  ): { left: number; right: number } {
    const lateral = perpendicular(direction);
    const side = dot(sub(focus.point, focus.enemy.center), lateral);
    const strength = clamp(
      Math.abs(side) / Math.max(1, focus.enemy.currentWidth * 0.46),
      0,
      1,
    );
    const amount = clamp(focus.enemy.currentWidth * 0.11, 22, 62) * strength;
    return side >= 0
      ? { left: amount, right: -amount * 0.35 }
      : { left: -amount * 0.35, right: amount };
  }
}
