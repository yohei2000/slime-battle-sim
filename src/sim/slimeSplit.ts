import type { ArmySlime, SlimeLink, Vector2Like } from "./types";
import { createArmySlime } from "./slime";
import {
  add,
  clamp,
  clamp01,
  distance,
  dot,
  lerp,
  normalize,
  perpendicular,
  scale,
  sub,
} from "./vector";

const MAX_SPLIT_GENERATION = 2;
const MIN_SPLIT_MASS = 42;
const REQUIRED_LOCAL_BREAKS = 2;

type FractureSample = {
  link: SlimeLink;
  midpoint: Vector2Like;
  severity: number;
};

function uniqueLinks(slime: ArmySlime): SlimeLink[] {
  const links: SlimeLink[] = [];
  const seen = new Set<string>();
  for (const node of slime.nodes) {
    for (const link of node.links) {
      const key = [link.nodeAId, link.nodeBId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      links.push(link);
    }
  }
  return links;
}

function fractureSamples(slime: ArmySlime): FractureSample[] {
  const byId = new Map(slime.nodes.map((node) => [node.id, node]));
  return uniqueLinks(slime)
    .filter((link) => link.broken || link.integrity < 0.82)
    .flatMap((link) => {
      const a = byId.get(link.nodeAId);
      const b = byId.get(link.nodeBId);
      if (!a || !b) return [];
      return [
        {
          link,
          midpoint: scale(add(a.position, b.position), 0.5),
          severity: link.broken ? 1 : 1 - link.integrity,
        },
      ];
    });
}

export function updateSplitStress(slime: ArmySlime, dt: number): void {
  slime.splitCooldown = Math.max(0, slime.splitCooldown - dt);
  const samples = fractureSamples(slime);

  if (samples.length === 0) {
    slime.fractureConcentration = 0;
    slime.fractureLinkCount = 0;
    slime.fractureCenter = { ...slime.center };
    slime.fractureNormal = { ...slime.facing };
    slime.splitStress = Math.max(0, slime.splitStress - 0.22 * dt);
    return;
  }

  const clusterRadius = Math.max(
    54,
    Math.min(slime.currentWidth, slime.currentDepth) * 0.42,
  );
  let strongestCluster: FractureSample[] = [];
  let strongestWeight = 0;
  for (const origin of samples) {
    const cluster = samples.filter(
      (candidate) => distance(origin.midpoint, candidate.midpoint) <= clusterRadius,
    );
    const weight = cluster.reduce((sum, sample) => sum + sample.severity, 0);
    if (weight > strongestWeight) {
      strongestWeight = weight;
      strongestCluster = cluster;
    }
  }

  const totalWeight = Math.max(
    0.001,
    strongestCluster.reduce((sum, sample) => sum + sample.severity, 0),
  );
  slime.fractureCenter = scale(
    strongestCluster.reduce(
      (sum, sample) => add(sum, scale(sample.midpoint, sample.severity)),
      { x: 0, y: 0 },
    ),
    1 / totalWeight,
  );
  const outward = sub(slime.fractureCenter, slime.center);
  slime.fractureNormal =
    Math.hypot(outward.x, outward.y) > 12
      ? normalize(outward)
      : normalize(slime.facing);
  slime.fractureLinkCount = strongestCluster.filter(
    (sample) => sample.link.broken,
  ).length;
  slime.fractureConcentration = clamp01(strongestWeight / 2.7);

  const targetProgress = clamp01(
    slime.fractureConcentration * 0.82 +
      clamp01(slime.fractureLinkCount / REQUIRED_LOCAL_BREAKS) * 0.28,
  );
  slime.splitStress = clamp01(
    lerp(
      { x: slime.splitStress, y: 0 },
      { x: targetProgress, y: 0 },
      clamp01(dt * 3.2),
    ).x,
  );
}

export function shouldSplitSlime(slime: ArmySlime): boolean {
  return (
    slime.splitCooldown <= 0 &&
    slime.splitGeneration < MAX_SPLIT_GENERATION &&
    slime.mass >= MIN_SPLIT_MASS &&
    slime.splitStress >= 0.72 &&
    slime.fractureConcentration >= 0.68 &&
    slime.fractureLinkCount >= REQUIRED_LOCAL_BREAKS
  );
}

export function splitArmySlime(slime: ArmySlime): [ArmySlime, ArmySlime] {
  const nextGeneration = slime.splitGeneration + 1;
  const separationAxis = normalize(slime.fractureNormal);
  const lateral = perpendicular(slime.facing);
  const forwardAlignment = Math.abs(dot(separationAxis, slime.facing));
  const childWidth = clamp(
    slime.currentWidth * (0.48 + forwardAlignment * 0.32),
    90,
    250,
  );
  const childDepth = clamp(
    slime.currentDepth * (0.82 - forwardAlignment * 0.32),
    86,
    240,
  );
  const projectedRadius =
    Math.abs(dot(separationAxis, slime.facing)) * slime.currentDepth * 0.5 +
    Math.abs(dot(separationAxis, lateral)) * slime.currentWidth * 0.5;
  const separation = projectedRadius * 0.42 + 18;
  const remainingFlow = sub(slime.desiredCenter, slime.center);
  const aliveParticles = slime.particles.filter((particle) => particle.alive).length;
  const fragmentMass = slime.mass * 0.42;
  const mainMass = slime.mass - fragmentMass;
  const fragmentParticles = Math.max(24, Math.floor(aliveParticles * 0.42));
  const mainParticles = Math.max(28, aliveParticles - fragmentParticles);

  const fragmentCenter = add(slime.center, scale(separationAxis, separation));
  const mainCenter = add(slime.center, scale(separationAxis, -separation * 0.72));
  const fragment = createArmySlime(
    `${slime.id}-F${nextGeneration}`,
    slime.side,
    fragmentCenter,
    slime.facing,
    {
      width: childWidth,
      depth: childDepth,
      mass: fragmentMass,
      particleCount: fragmentParticles,
      splitGeneration: nextGeneration,
    },
  );
  const main = createArmySlime(
    `${slime.id}-M${nextGeneration}`,
    slime.side,
    mainCenter,
    slime.facing,
    {
      width: childWidth,
      depth: childDepth,
      mass: mainMass,
      particleCount: mainParticles,
      splitGeneration: nextGeneration,
    },
  );

  for (const [child, offset] of [
    [fragment, 14],
    [main, -10],
  ] as const) {
    child.posture = "neutral";
    child.desiredCenter = add(
      child.center,
      add(scale(remainingFlow, 0.48), scale(separationAxis, offset)),
    );
    child.desiredDirection = { ...slime.desiredDirection };
    child.facing = { ...slime.facing };
    child.morale = clamp(slime.morale - 7, 0, 100);
    child.cohesion = clamp(slime.cohesion - 20, 0, 100);
    child.fatigue = clamp(slime.fatigue + 11, 0, 100);
    child.pressure = clamp(slime.pressure + 12, 0, 100);
    child.encirclement = slime.encirclement * 0.65;
    child.toughness = clamp(slime.toughness - 0.04, 0.42, 0.9);
    child.splitCooldown = 3.5;
  }

  fragment.isSelected = false;
  main.isSelected = slime.isSelected;
  return [fragment, main];
}
