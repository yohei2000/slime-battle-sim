import type { ArmySlime, GesturePreviewState, Vector2Like } from "../sim/types";
import { issueOrder } from "../sim/slimeOrders";
import { add, distance, normalize, scale, sub } from "../sim/vector";

export class DragIntentController {
  private start?: Vector2Like;
  private latest?: Vector2Like;

  begin(worldPoint: Vector2Like): void {
    this.start = { ...worldPoint };
    this.latest = { ...worldPoint };
  }

  move(worldPoint: Vector2Like): GesturePreviewState {
    this.latest = { ...worldPoint };
    return {
      active: true,
      mode: "drag",
      start: this.start,
      end: this.latest,
    };
  }

  commit(slime: ArmySlime, now: number): boolean {
    if (!this.start || !this.latest || distance(this.start, this.latest) < 22) {
      this.reset();
      return false;
    }
    const direction = normalize(sub(this.latest, this.start));
    const travel = Math.min(290, distance(this.start, this.latest) * 1.2);
    issueOrder(slime, {
      posture: slime.posture === "hold" ? "neutral" : slime.posture,
      targetCenter: add(slime.center, scale(direction, travel)),
      targetDirection: direction,
      issuedAt: now,
    });
    this.reset();
    return true;
  }

  reset(): void {
    this.start = undefined;
    this.latest = undefined;
  }
}
