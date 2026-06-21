import type { ArmySlime, GesturePreviewState, Vector2Like } from "../sim/types";
import { pointInsideSlime } from "../sim/slime";
import { issueOrder } from "../sim/slimeOrders";
import {
  add,
  clamp,
  distance,
  dot,
  normalize,
  perpendicular,
  scale,
  sub,
} from "../sim/vector";

type FocusTarget = {
  enemy: ArmySlime;
  point: Vector2Like;
};

export class DragIntentController {
  private start?: Vector2Like;
  private latest?: Vector2Like;

  begin(startWorldPoint: Vector2Like, latestWorldPoint?: Vector2Like): void {
    this.start = { ...startWorldPoint };
    this.latest = { ...(latestWorldPoint ?? startWorldPoint) };
  }

  move(
    worldPoint: Vector2Like,
    slime?: ArmySlime,
    enemies: ArmySlime[] = [],
  ): GesturePreviewState {
    this.latest = { ...worldPoint };
    const focus = this.findFocusTarget(this.latest, enemies);
    return {
      active: true,
      mode: "drag",
      start: this.start,
      end: this.latest,
      direction:
        slime && focus ? normalize(sub(focus.point, slime.center)) : undefined,
      targetPoint: focus?.point,
      focusMode: slime && focus
        ? this.shouldEnvelop(slime)
          ? "envelop"
          : "breakthrough"
        : undefined,
    };
  }

  commit(slime: ArmySlime, now: number, enemies: ArmySlime[] = []): boolean {
    const focus = this.latest ? this.findFocusTarget(this.latest, enemies) : undefined;
    if (
      !this.start ||
      !this.latest ||
      (!focus && distance(this.start, this.latest) < 22)
    ) {
      this.reset();
      return false;
    }

    if (focus) {
      const direction = normalize(sub(focus.point, slime.center));
      const travel = clamp(distance(slime.center, focus.point) * 0.68, 90, 255);
      if (this.shouldEnvelop(slime)) {
        const width = clamp(slime.currentWidth * 1.22, 195, 530);
        const depth = clamp(slime.currentDepth * 0.82, 112, 255);
        const lateral = perpendicular(direction);
        const targetSide = dot(sub(focus.point, focus.enemy.center), lateral);
        const sideBias = clamp(
          Math.abs(targetSide) / Math.max(1, focus.enemy.currentWidth * 0.46),
          0,
          1,
        );
        const baseWingAdvance = clamp(
          focus.enemy.currentWidth * 0.34 + slime.currentWidth * 0.12,
          82,
          195,
        );
        const leftWingAdvance =
          targetSide >= 0
            ? baseWingAdvance * (1 + sideBias * 0.34)
            : baseWingAdvance * (0.9 - sideBias * 0.18);
        const rightWingAdvance =
          targetSide < 0
            ? baseWingAdvance * (1 + sideBias * 0.34)
            : baseWingAdvance * (0.9 - sideBias * 0.18);
        issueOrder(slime, {
          posture: "envelop",
          targetCenter: add(slime.center, scale(direction, Math.min(180, travel))),
          targetDirection: direction,
          targetWidth: width,
          targetDepth: depth,
          targetDensity: clamp((250 * 180) / (width * depth), 0.62, 1.62),
          targetLeftWingAdvance: leftWingAdvance,
          targetRightWingAdvance: rightWingAdvance,
          targetFocusPoint: focus.point,
          issuedAt: now,
        });
      } else {
        const width = clamp(slime.currentWidth * 0.72, 128, 275);
        const depth = clamp(slime.currentDepth * 1.18, 132, 305);
        issueOrder(slime, {
          posture: "breakthrough",
          targetCenter: add(slime.center, scale(direction, travel)),
          targetDirection: direction,
          targetWidth: width,
          targetDepth: depth,
          targetDensity: clamp((250 * 180) / (width * depth), 0.72, 1.72),
          targetLeftWingAdvance: 0,
          targetRightWingAdvance: 0,
          targetFocusPoint: focus.point,
          issuedAt: now,
        });
      }
      this.reset();
      return true;
    }

    const direction = normalize(sub(this.latest, this.start));
    const travel = Math.min(290, distance(this.start, this.latest) * 1.2);
    issueOrder(slime, {
      posture: slime.posture === "hold" ? "neutral" : slime.posture,
      targetCenter: add(slime.center, scale(direction, travel)),
      targetDirection: direction,
      targetLeftWingAdvance: 0,
      targetRightWingAdvance: 0,
      issuedAt: now,
    });
    this.reset();
    return true;
  }

  private findFocusTarget(
    point: Vector2Like,
    enemies: ArmySlime[],
  ): FocusTarget | undefined {
    const direct = enemies.find((enemy) => pointInsideSlime(enemy, point, 125));
    if (direct) return { enemy: direct, point: { ...point } };

    let best: ArmySlime | undefined;
    let bestDistance = Infinity;
    for (const enemy of enemies) {
      const threshold =
        Math.max(enemy.currentWidth, enemy.currentDepth) * 0.62 +
        enemy.zocRadius * 0.5 +
        40;
      const gap = distance(point, enemy.center);
      if (gap < threshold && gap < bestDistance) {
        best = enemy;
        bestDistance = gap;
      }
    }
    return best ? { enemy: best, point: { ...point } } : undefined;
  }

  private shouldEnvelop(slime: ArmySlime): boolean {
    return (
      slime.posture === "spread" ||
      slime.posture === "envelop" ||
      slime.currentWidth > slime.baseWidth * 1.1 ||
      slime.desiredWidth > slime.baseWidth * 1.13
    );
  }

  reset(): void {
    this.start = undefined;
    this.latest = undefined;
  }
}
