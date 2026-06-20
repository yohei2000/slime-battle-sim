import type { ArmySlime } from "./types";
import { createArmySlime } from "./slime";
import { add, clamp, clamp01, perpendicular, scale, sub } from "./vector";

const MAX_SPLIT_GENERATION = 2;
const MIN_SPLIT_MASS = 42;

export function updateSplitStress(slime: ArmySlime, dt: number): void {
  slime.splitCooldown = Math.max(0, slime.splitCooldown - dt);
  if (
    slime.splitCooldown > 0 ||
    slime.splitGeneration >= MAX_SPLIT_GENERATION ||
    slime.mass < MIN_SPLIT_MASS
  ) {
    slime.splitStress = Math.max(0, slime.splitStress - 0.18 * dt);
    return;
  }

  const splitWidth = slime.baseWidth * 1.45;
  const overWidth = clamp01(
    (slime.currentWidth - splitWidth) / Math.max(1, slime.baseWidth * 0.35),
  );
  const structuralDamage =
    0.25 +
    slime.tension * 0.55 +
    slime.brokenLinkRatio * 1.8 +
    (1 - slime.linkIntegrity) * 0.65;
  const cohesionVulnerability = 0.5 + (100 - slime.cohesion) / 100;

  if (overWidth > 0) {
    slime.splitStress = clamp01(
      slime.splitStress +
        overWidth * structuralDamage * cohesionVulnerability * 0.68 * dt,
    );
  } else {
    slime.splitStress = Math.max(0, slime.splitStress - 0.14 * dt);
  }
}

export function shouldSplitSlime(slime: ArmySlime): boolean {
  return (
    slime.splitCooldown <= 0 &&
    slime.splitGeneration < MAX_SPLIT_GENERATION &&
    slime.mass >= MIN_SPLIT_MASS &&
    slime.splitStress >= 0.72 &&
    slime.brokenLinkRatio >= 0.08
  );
}

export function splitArmySlime(slime: ArmySlime): [ArmySlime, ArmySlime] {
  const nextGeneration = slime.splitGeneration + 1;
  const lateral = perpendicular(slime.facing);
  const childWidth = clamp(
    slime.currentWidth * 0.44,
    Math.max(105, slime.baseWidth * 0.54),
    240,
  );
  const childDepth = clamp(slime.currentDepth * 0.92, 100, 250);
  const separation = childWidth * 0.48 + 20;
  const remainingFlow = sub(slime.desiredCenter, slime.center);
  const particleCount = Math.max(
    32,
    Math.floor(slime.particles.filter((particle) => particle.alive).length / 2),
  );

  const leftCenter = add(slime.center, scale(lateral, separation));
  const rightCenter = add(slime.center, scale(lateral, -separation));
  const left = createArmySlime(
    `${slime.id}-L${nextGeneration}`,
    slime.side,
    leftCenter,
    slime.facing,
    {
      width: childWidth,
      depth: childDepth,
      mass: slime.mass * 0.5,
      particleCount,
      splitGeneration: nextGeneration,
    },
  );
  const right = createArmySlime(
    `${slime.id}-R${nextGeneration}`,
    slime.side,
    rightCenter,
    slime.facing,
    {
      width: childWidth,
      depth: childDepth,
      mass: slime.mass * 0.5,
      particleCount,
      splitGeneration: nextGeneration,
    },
  );

  for (const [child, side] of [
    [left, 1],
    [right, -1],
  ] as const) {
    child.posture = "neutral";
    child.desiredCenter = add(
      child.center,
      add(scale(remainingFlow, 0.55), scale(lateral, side * 18)),
    );
    child.desiredDirection = { ...slime.desiredDirection };
    child.facing = { ...slime.facing };
    child.morale = clamp(slime.morale - 6, 0, 100);
    child.cohesion = clamp(slime.cohesion - 18, 0, 100);
    child.fatigue = clamp(slime.fatigue + 10, 0, 100);
    child.pressure = clamp(slime.pressure + 12, 0, 100);
    child.encirclement = slime.encirclement * 0.65;
    child.splitCooldown = 3.5;
  }

  left.isSelected = slime.isSelected;
  right.isSelected = false;
  return [left, right];
}
