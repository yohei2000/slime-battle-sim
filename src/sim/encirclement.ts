import type { ArmySlime } from "./types";
import { clamp01, distance, dot, normalize, sub } from "./vector";
import { zocContinuity } from "./zoc";

export function ringIntegrity(slime: ArmySlime): number {
  const averageDensity = Math.min(1.5, slime.currentDensity) / 1.5;
  const cohesionFactor = slime.cohesion / 100;
  const reserveSupport = clamp01(1 - slime.fatigue / 145);
  const commandCoverage = clamp01(1 - slime.commandDelay / 4);
  return clamp01(
    averageDensity *
      zocContinuity(slime) *
      cohesionFactor *
      reserveSupport *
      commandCoverage *
      1.8,
  );
}

export function flankAccess(attacker: ArmySlime, defender: ArmySlime): number {
  const toAttacker = normalize(sub(attacker.center, defender.center));
  const frontal = Math.abs(dot(defender.facing, toAttacker));
  const widthAdvantage = attacker.currentWidth / Math.max(100, defender.currentWidth);
  return clamp01((1 - frontal) * 0.45 + (widthAdvantage - 0.75) * 0.65);
}

export function updateEncirclement(attacker: ArmySlime, defender: ArmySlime, dt: number): void {
  const range = distance(attacker.center, defender.center);
  const reach = attacker.currentWidth * 0.6 + defender.currentWidth * 0.28;
  const postureBonus = attacker.posture === "envelop" ? 0.75 : attacker.posture === "spread" ? 0.38 : 0;
  const access = flankAccess(attacker, defender);
  const integrity = ringIntegrity(attacker);
  const gain = range < reach + 130 ? postureBonus * access * integrity * 0.16 : 0;
  defender.encirclement = clamp01(defender.encirclement + gain * dt - (gain === 0 ? 0.045 * dt : 0));
  defender.isEncircled = defender.encirclement > 0.62;
  attacker.isEncircling = defender.encirclement > 0.22;

  if (defender.encirclement > 0.35) {
    defender.morale -= defender.encirclement * 1.2 * dt;
    defender.fatigue += defender.encirclement * 0.8 * dt;
    defender.commandDelay += defender.encirclement * 0.04 * dt;
  }
}

export function encirclementStage(value: number): string {
  if (value >= 0.86) return "圧縮包囲";
  if (value >= 0.62) return "包囲";
  if (value >= 0.36) return "半包囲";
  if (value >= 0.14) return "側面圧力";
  return "未包囲";
}
