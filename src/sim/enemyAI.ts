import type { ArmySlime, SlimePosture, Vector2Like } from "./types";
import { flankAccess } from "./encirclement";
import { issueOrder } from "./slimeOrders";
import { add, clamp, normalize, perpendicular, scale, sub } from "./vector";

function targetShape(enemy: ArmySlime, posture: SlimePosture) {
  if (posture === "breakthrough" || posture === "contract") {
    return { width: 170, depth: 245, density: 1.42 };
  }
  if (posture === "spread" || posture === "envelop") {
    return { width: 390, depth: 128, density: 0.76 };
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
  } else if (player.gapRisk > 0.48) {
    posture = "breakthrough";
    target = weakPoint(player, enemy);
  } else if (player.currentDensity > 1.23 && access > 0.18) {
    posture = "envelop";
  } else if (enemy.morale > player.morale + 8 && player.morale < 48) {
    posture = "envelop";
  } else if (enemy.fatigue > 68) {
    posture = "hold";
    target = enemy.center;
  } else {
    posture = Math.random() > 0.56 ? "spread" : "contract";
  }

  const shape = targetShape(enemy, posture);
  const direction = normalize(sub(target, enemy.center));
  const moveDistance = posture === "retreat" ? 150 : posture === "hold" ? 0 : 100;
  issueOrder(enemy, {
    posture,
    targetCenter: add(enemy.center, scale(direction, moveDistance)),
    targetDirection: direction,
    targetWidth: clamp(shape.width, 145, 430),
    targetDepth: clamp(shape.depth, 112, 275),
    targetDensity: shape.density,
    targetLeftWingAdvance: 0,
    targetRightWingAdvance: 0,
    issuedAt: now,
  });
}
