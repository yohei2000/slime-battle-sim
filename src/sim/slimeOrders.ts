import type { ArmySlime, SlimeOrder } from "./types";
import { clamp, distance, dot, normalize } from "./vector";

export function calculateCommandDelay(slime: ArmySlime, order: Omit<SlimeOrder, "executeAt" | "status">): number {
  const shapeChange =
    Math.abs((order.targetWidth ?? slime.desiredWidth) - slime.currentWidth) / 180 +
    Math.abs((order.targetDepth ?? slime.desiredDepth) - slime.currentDepth) / 150 +
    distance(order.targetCenter ?? slime.center, slime.center) / 550 +
    (Math.abs(order.targetLeftWingAdvance ?? slime.desiredLeftWingAdvance) +
      Math.abs(order.targetRightWingAdvance ?? slime.desiredRightWingAdvance)) /
      260 +
    (1 -
      dot(
        normalize(order.targetDirection ?? slime.desiredDirection),
        normalize(slime.facing),
      )) *
      0.8;

  return clamp(
    0.22 +
      slime.fatigue * 0.005 +
      slime.pressure * 0.004 +
      (slime.isEngaged ? 0.32 : 0) +
      (100 - slime.cohesion) * 0.007 +
      shapeChange * 0.85 +
      slime.crowding * 0.55,
    0.18,
    2.8,
  );
}

export function issueOrder(
  slime: ArmySlime,
  order: Omit<SlimeOrder, "executeAt" | "status">,
): SlimeOrder {
  const delay = calculateCommandDelay(slime, order);
  const activeOrder: SlimeOrder = {
    ...order,
    executeAt: order.issuedAt + delay,
    status: "transmitting",
  };
  slime.activeOrder = activeOrder;
  slime.commandDelay = delay;
  return activeOrder;
}

export function updateOrder(slime: ArmySlime, now: number): void {
  const order = slime.activeOrder;
  if (!order) return;
  if (order.status === "transmitting" && now >= order.executeAt) {
    order.status = "executing";
    slime.posture = order.posture;
    if (order.targetCenter) slime.desiredCenter = { ...order.targetCenter };
    if (order.targetDirection) {
      slime.desiredDirection = { ...order.targetDirection };
    }
    if (order.targetWidth !== undefined) slime.desiredWidth = order.targetWidth;
    if (order.targetDepth !== undefined) slime.desiredDepth = order.targetDepth;
    if (order.targetDensity !== undefined) slime.desiredDensity = order.targetDensity;
    if (order.targetLeftWingAdvance !== undefined)
      slime.desiredLeftWingAdvance = order.targetLeftWingAdvance;
    if (order.targetRightWingAdvance !== undefined)
      slime.desiredRightWingAdvance = order.targetRightWingAdvance;
    if (order.posture === "breakthrough") slime.shockTimer = 2.4;
  }

  if (
    order.status === "executing" &&
    now - order.executeAt > (order.posture === "breakthrough" ? 2.5 : 0.8)
  ) {
    order.status = "completed";
    slime.activeOrder = undefined;
  }
}
