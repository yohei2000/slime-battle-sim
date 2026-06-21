import type { ArmySlime, SlimePosture, Vector2Like } from "./types";
import { flankAccess } from "./encirclement";
import { issueOrder } from "./slimeOrders";
import { add, clamp, normalize, perpendicular, scale, sub } from "./vector";

function targetShape(enemy: ArmySlime, posture: SlimePosture) {
  if (posture === "breakthrough" || posture === "contract") {
    return { width: 172, depth: 235, density: 1.35 };
  }
  if (posture === "spread" || posture === "envelop") {
    return { width: 440, depth: 132, density: 0.72 };
  }
  return { width: 250, depth: 180, density: 1 };
}

function weakPoint(player: ArmySlime, enemy: ArmySlime): Vector2Like {
  const lateral = perpendicular(player.facing);
  const side = Math.sin(enemy.center.y * 0.017) > 0 ? 1 : -1;
  return add(player.center, scale(lateral, player.currentWidth * 0.14 * side));
}

export function updateEnemyAI(enemy: ArmySlime, player: ArmySlime, now: number): void {
  if (enemy.isRouting) return;
  if (now < enemy.aiThinkAt || enemy.activeOrder?.status === "transmitting") return;
  enemy.aiThinkAt = now + 1.2 + Math.random() * 0.7;

  const access = flankAccess(enemy, player);
  let posture: SlimePosture = "neutral";
  let target = player.center;

  if (enemy.cohesion < 35 || enemy.morale < 30) {
    posture = "retreat";
    target = add(enemy.center, scale(normalize(sub(enemy.center, player.center)), 180));
  } else if (enemy.isEncircled) {
    posture = "breakthrough";
    target = weakPoint(player, enemy);
  } else if (player.gapRisk > 0.64 && player.envelopPower < 0.58) {
    posture = "breakthrough";
    target = weakPoint(player, enemy);
  } else if (player.currentDensity > 1.12 && access > 0.12) {
    posture = "envelop";
  } else if (enemy.morale > player.morale + 6 && player.morale < 56) {
    posture = "envelop";
  } else if (enemy.fatigue > 68) {
    posture = "hold";
    target = enemy.center;
  } else {
    posture =
      access > 0.08 || player.currentDensity > 1.02 || Math.random() > 0.34
        ? "envelop"
        : "breakthrough";
    if (posture === "breakthrough") target = weakPoint(player, enemy);
  }

  const shape = targetShape(enemy, posture);
  const direction = normalize(sub(target, enemy.center));
  const moveDistance =
    posture === "retreat"
      ? 150
      : posture === "hold"
        ? 0
        : posture === "envelop"
          ? 86
          : 118;
  const wingAdvance =
    posture === "envelop"
      ? clamp(player.currentWidth * 0.28 + enemy.currentWidth * 0.12, 75, 165)
      : 0;
  issueOrder(enemy, {
    posture,
    targetCenter: add(enemy.center, scale(direction, moveDistance)),
    targetDirection: direction,
    targetWidth: clamp(shape.width, 145, 505),
    targetDepth: clamp(shape.depth, 112, 275),
    targetDensity: shape.density,
    targetLeftWingAdvance: wingAdvance,
    targetRightWingAdvance: wingAdvance,
    issuedAt: now,
  });
}
