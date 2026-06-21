import type { ArmySlime } from "./types";
import { add, clamp, normalize, scale, sub } from "./vector";

export const ROUT_MORALE_THRESHOLD = 25;
export const RALLY_MORALE_THRESHOLD = 38;
const ROUT_COHESION_THRESHOLD = 4;
const MIN_ROUT_SECONDS = 8;

export function updateRoutingState(
  slime: ArmySlime,
  enemy: ArmySlime,
  now: number,
): void {
  if (
    !slime.isRouting &&
    (slime.morale <= ROUT_MORALE_THRESHOLD ||
      slime.cohesion <= ROUT_COHESION_THRESHOLD)
  ) {
    slime.isRouting = true;
    slime.routedAt = now;
    slime.activeOrder = undefined;
    slime.shockTimer = 0;
  }

  if (
    slime.isRouting &&
    slime.morale >= RALLY_MORALE_THRESHOLD &&
    !slime.isEngaged &&
    now - slime.routedAt >= MIN_ROUT_SECONDS
  ) {
    slime.isRouting = false;
    slime.routedAt = -1;
    slime.posture = "hold";
    slime.desiredCenter = { ...slime.center };
    return;
  }

  if (!slime.isRouting) return;

  const escapeDirection = normalize(sub(slime.center, enemy.center));
  slime.activeOrder = undefined;
  slime.posture = "retreat";
  slime.desiredDirection = escapeDirection;
  slime.desiredCenter = add(slime.center, scale(escapeDirection, 260));
  slime.desiredWidth = clamp(slime.baseWidth * 0.78, 90, 280);
  slime.desiredDepth = clamp(slime.baseDepth * 1.08, 95, 260);
  slime.desiredDensity = 1.12;
  slime.desiredLeftWingAdvance = 0;
  slime.desiredRightWingAdvance = 0;
}
