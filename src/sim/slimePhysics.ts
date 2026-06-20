import type { ArmySlime, SlimeNode, Vector2Like } from "./types";
import {
  add,
  average,
  clamp,
  clamp01,
  distance,
  dot,
  length,
  lerp,
  normalize,
  perpendicular,
  scale,
  sub,
} from "./vector";
import { contactPushForce } from "./slimeCombat";
import { projectOutsideEnemyZoc, sampleEnemyZoc, updateZocStats } from "./zoc";

type ForceMap = Map<string, Vector2Like>;

function addForce(forces: ForceMap, node: SlimeNode, force: Vector2Like): void {
  forces.set(node.id, add(forces.get(node.id) ?? { x: 0, y: 0 }, force));
}

function updateDesiredShape(slime: ArmySlime): void {
  const direction = normalize(slime.desiredDirection);
  const lateral = perpendicular(direction);
  const boundary = slime.nodes.filter((node) => node.role !== "interior");
  const wingCurve = slime.posture === "envelop" ? 0.34 : 0;

  boundary.forEach((node, i) => {
    const angle = (i / boundary.length) * Math.PI * 2;
    let forward = Math.cos(angle) * slime.desiredDepth * 0.5;
    const sideways = Math.sin(angle) * slime.desiredWidth * 0.5;
    const leftWeight = clamp01(Math.sin(angle));
    const rightWeight = clamp01(-Math.sin(angle));
    const wingFrontBias = 0.35 + Math.max(0, Math.cos(angle)) * 0.65;
    forward +=
      (slime.desiredLeftWingAdvance * leftWeight +
        slime.desiredRightWingAdvance * rightWeight) *
      wingFrontBias;
    if (slime.posture === "envelop") {
      forward += Math.abs(Math.sin(angle)) * slime.desiredDepth * wingCurve;
    }
    if (slime.posture === "breakthrough" && Math.cos(angle) > 0.45) {
      forward += slime.desiredDepth * 0.2;
    }
    node.targetPosition = add(
      slime.desiredCenter,
      add(scale(direction, forward), scale(lateral, sideways)),
    );
  });

  const core = slime.nodes.find((node) => node.role === "interior");
  if (core) core.targetPosition = { ...slime.desiredCenter };
}

function applyOrderForces(slime: ArmySlime, forces: ForceMap): void {
  const flow = sub(slime.desiredCenter, slime.center);
  const flowSpeed = Math.min(length(flow), slime.posture === "breakthrough" ? 115 : 78);
  const flowForce = scale(normalize(flow), flowSpeed * 0.025);
  for (const node of slime.nodes) {
    const shapeForce = scale(sub(node.targetPosition, node.position), 0.055 * slime.elasticity);
    addForce(forces, node, add(flowForce, shapeForce));
  }
}

function localEnemyPressure(
  slime: ArmySlime,
  enemy: ArmySlime,
  node: SlimeNode,
): number {
  const patch = slime.contactPatches.find((candidate) =>
    candidate.ownNodeIds.includes(node.id),
  );
  const contactLoad = patch
    ? clamp01(patch.pressure / 48) * (0.72 + enemy.zocStrength * 0.28)
    : 0;
  const sample = sampleEnemyZoc(enemy, node.position);
  const pressureRange = sample.clearance + 14;
  const zocCompression = sample.insideBody
    ? 1
    : clamp01((pressureRange - sample.distance) / pressureRange);
  return clamp(
    (contactLoad * 0.72 + zocCompression * 0.38) *
      (0.7 + enemy.currentDensity * 0.3),
    0,
    1.25,
  );
}

function applySpringForces(
  slime: ArmySlime,
  enemy: ArmySlime,
  forces: ForceMap,
  dt: number,
): void {
  const byId = new Map(slime.nodes.map((node) => [node.id, node]));
  const pressureByNode = new Map(
    slime.nodes.map((node) => [node.id, localEnemyPressure(slime, enemy, node)]),
  );
  const seen = new Set<string>();
  let totalIntegrity = 0;
  let linkCount = 0;
  let brokenCount = 0;
  let peakLocalStress = 0;
  slime.effectiveToughness = clamp(
    slime.toughness *
      (0.55 + slime.cohesion * 0.0045) *
      (0.72 + slime.morale * 0.0028),
    0.18,
    1.2,
  );
  for (const node of slime.nodes) {
    for (const link of node.links) {
      const key = [link.nodeAId, link.nodeBId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      linkCount += 1;
      if (link.broken) {
        brokenCount += 1;
        continue;
      }
      const a = byId.get(link.nodeAId);
      const b = byId.get(link.nodeBId);
      if (!a || !b) continue;
      const delta = sub(b.position, a.position);
      const currentLength = Math.max(0.001, length(delta));
      const structuralStrain = currentLength / Math.max(0.001, link.restLength);
      const endpointPressure =
        Math.max(
          pressureByNode.get(a.id) ?? 0,
          pressureByNode.get(b.id) ?? 0,
        ) *
          0.7 +
        ((pressureByNode.get(a.id) ?? 0) +
          (pressureByNode.get(b.id) ?? 0)) *
          0.15;
      link.localPressure = endpointPressure;
      const strainAmplifier =
        0.78 + Math.max(0, structuralStrain - 0.92) * 0.92;
      const fatigueAmplifier = 0.82 + slime.fatigue / 145;
      const stressTarget = endpointPressure * strainAmplifier * fatigueAmplifier;
      link.stress +=
        (stressTarget - link.stress) * clamp01(dt * (stressTarget > link.stress ? 5 : 2.4));
      link.stress = clamp(link.stress, 0, 1.5);
      peakLocalStress = Math.max(peakLocalStress, link.stress);

      if (link.stress > slime.effectiveToughness) {
        link.integrity -=
          (link.stress - slime.effectiveToughness) *
          1 *
          (1 + (100 - slime.cohesion) / 120) *
          dt;
      } else if (
        link.stress < slime.effectiveToughness * 0.58 &&
        link.localPressure < 0.16
      ) {
        link.integrity = Math.min(1, link.integrity + 0.025 * dt);
      }
      if (link.integrity <= 0) {
        link.integrity = 0;
        link.broken = true;
        brokenCount += 1;
        continue;
      }
      totalIntegrity += link.integrity;
      const targetScale =
        slime.currentWidth > 0 && (a.role === "left" || a.role === "right" || b.role === "left" || b.role === "right")
          ? slime.desiredWidth / slime.baseWidth
          : slime.desiredDepth / slime.baseDepth;
      const targetLength = link.restLength * clamp(targetScale, 0.62, 1.62);
      const stretch = currentLength - targetLength;
      const direction = scale(delta, 1 / currentLength);
      const relativeVelocity = dot(sub(b.velocity, a.velocity), direction);
      const cohesionStrength = 0.25 + slime.cohesion / 125;
      const magnitude =
        stretch * link.stiffness * cohesionStrength * link.integrity * 0.022 +
        relativeVelocity * link.damping * 0.08;
      addForce(forces, a, scale(direction, magnitude));
      addForce(forces, b, scale(direction, -magnitude));
    }
  }
  slime.brokenLinkRatio = linkCount > 0 ? brokenCount / linkCount : 0;
  slime.linkIntegrity =
    linkCount > 0 ? totalIntegrity / Math.max(1, linkCount - brokenCount) : 1;
  slime.peakLocalStress = peakLocalStress;
}

function applyDensityForces(slime: ArmySlime, forces: ForceMap): void {
  for (let i = 0; i < slime.nodes.length; i += 1) {
    const a = slime.nodes[i];
    for (let j = i + 1; j < slime.nodes.length; j += 1) {
      const b = slime.nodes[j];
      const delta = sub(b.position, a.position);
      const gap = length(delta);
      if (gap > 0 && gap < 42) {
        const push = scale(normalize(delta), (42 - gap) * 0.018);
        addForce(forces, a, scale(push, -1));
        addForce(forces, b, push);
      }
    }
  }
}

function applyZocForces(slime: ArmySlime, enemy: ArmySlime, forces: ForceMap): void {
  for (const node of slime.nodes.filter((candidate) => candidate.role !== "interior")) {
    addForce(forces, node, contactPushForce(slime, enemy, node));
    const sample = sampleEnemyZoc(enemy, node.position);
    const influenceDistance = sample.clearance + 38;
    if (!sample.insideBody && sample.distance >= influenceDistance) continue;

    const proximity = sample.insideBody
      ? 1
      : clamp01((influenceDistance - sample.distance) / 38);
    const desiredFlow = sub(node.targetPosition, node.position);
    const inwardFlow = Math.min(0, dot(desiredFlow, sample.outwardNormal));
    const tangentFlow = sub(desiredFlow, scale(sample.outwardNormal, dot(desiredFlow, sample.outwardNormal)));
    const slideFactor =
      slime.posture === "envelop" || slime.posture === "spread"
        ? 0.055
        : slime.posture === "breakthrough"
          ? 0.018
          : 0.035;
    const barrierStrength =
      (8 + enemy.zocStrength * 13) *
      proximity *
      (1 + Math.max(0, sample.penetration) / Math.max(1, sample.clearance));

    addForce(
      forces,
      node,
      add(
        scale(sample.outwardNormal, barrierStrength + Math.abs(inwardFlow) * 0.12),
        scale(tangentFlow, slideFactor * proximity),
      ),
    );
  }
}

function applyTerrainForces(slime: ArmySlime, forces: ForceMap, bounds: { width: number; height: number }): void {
  for (const node of slime.nodes) {
    const margin = 45;
    if (node.position.x < margin) addForce(forces, node, { x: (margin - node.position.x) * 0.08, y: 0 });
    if (node.position.x > bounds.width - margin)
      addForce(forces, node, { x: (bounds.width - margin - node.position.x) * 0.08, y: 0 });
    if (node.position.y < margin) addForce(forces, node, { x: 0, y: (margin - node.position.y) * 0.08 });
    if (node.position.y > bounds.height - margin)
      addForce(forces, node, { x: 0, y: (bounds.height - margin - node.position.y) * 0.08 });
  }
}

function enforceZocBoundary(slime: ArmySlime, enemy: ArmySlime): void {
  const contactNormals: Vector2Like[] = [];
  for (const node of slime.nodes.filter((candidate) => candidate.role !== "interior")) {
    const sample = sampleEnemyZoc(enemy, node.position);
    if (!sample.insideBody && sample.penetration <= 0) continue;

    contactNormals.push(sample.outwardNormal);
    node.position = projectOutsideEnemyZoc(enemy, node.position, 1, 18);
    const normalVelocity = dot(node.velocity, sample.outwardNormal);
    const tangentVelocity = sub(
      node.velocity,
      scale(sample.outwardNormal, normalVelocity),
    );
    const outwardVelocity =
      normalVelocity > 0 ? scale(sample.outwardNormal, normalVelocity * 0.35) : { x: 0, y: 0 };
    node.velocity = add(scale(tangentVelocity, 0.9), outwardVelocity);
    node.localPressure = clamp(
      node.localPressure + Math.max(0, sample.penetration) * 2.4 + 12,
      0,
      100,
    );
  }

  if (contactNormals.length > 0) {
    const averageNormal = normalize(average(contactNormals));
    const requestedFlow = sub(slime.desiredCenter, slime.center);
    const normalFlow = dot(requestedFlow, averageNormal);
    if (normalFlow < -10) {
      const tangentFlow = sub(requestedFlow, scale(averageNormal, normalFlow));
      slime.desiredCenter = add(
        slime.center,
        add(tangentFlow, scale(averageNormal, -10)),
      );
    }
  }
}

function enforceCohesionEnvelope(slime: ArmySlime): void {
  const maxRadius = Math.max(
    125,
    Math.max(slime.desiredWidth, slime.desiredDepth) *
      (slime.posture === "envelop" || slime.posture === "spread" ? 0.76 : 0.68),
  );
  for (const node of slime.nodes.filter((candidate) => candidate.role !== "interior")) {
    const offset = sub(node.position, slime.center);
    const radius = length(offset);
    if (radius <= maxRadius) continue;
    const normal = normalize(offset);
    node.position = add(slime.center, scale(normal, maxRadius));
    const outwardSpeed = Math.max(0, dot(node.velocity, normal));
    node.velocity = sub(node.velocity, scale(normal, outwardSpeed));
  }
}

function enforceWorldBoundary(
  slime: ArmySlime,
  bounds: { width: number; height: number },
): void {
  const margin = 38;
  for (const node of slime.nodes) {
    const x = clamp(node.position.x, margin, bounds.width - margin);
    const y = clamp(node.position.y, margin, bounds.height - margin);
    if (x !== node.position.x) node.velocity.x *= -0.12;
    if (y !== node.position.y) node.velocity.y *= -0.12;
    node.position = { x, y };
  }
}

function integrateNodes(
  slime: ArmySlime,
  enemy: ArmySlime,
  forces: ForceMap,
  dt: number,
  bounds: { width: number; height: number },
): void {
  for (const node of slime.nodes) {
    const force = forces.get(node.id) ?? { x: 0, y: 0 };
    node.velocity = add(node.velocity, scale(force, dt * 60 / node.mass));
    node.velocity = scale(node.velocity, Math.pow(slime.viscosity, dt * 3.5));
    const speed = length(node.velocity);
    if (speed > 120) node.velocity = scale(node.velocity, 120 / speed);
    node.position = add(node.position, scale(node.velocity, dt));
  }
  enforceZocBoundary(slime, enemy);
  enforceCohesionEnvelope(slime);
  enforceWorldBoundary(slime, bounds);
  const nextCenter = average(slime.nodes.map((node) => node.position));
  slime.velocity = scale(sub(nextCenter, slime.center), 1 / Math.max(dt, 0.001));
  slime.center = nextCenter;
}

function updateParticles(slime: ArmySlime, dt: number): void {
  const byId = new Map(slime.nodes.map((node) => [node.id, node]));
  const direction = normalize(slime.facing);
  const lateral = perpendicular(direction);
  for (const particle of slime.particles) {
    if (!particle.alive) continue;
    const anchor = byId.get(particle.localNodeId) ?? slime.nodes[0];
    particle.phase += dt * (1.8 + slime.currentDensity);
    const wander = add(
      scale(direction, Math.cos(particle.phase * 0.73) * 9),
      scale(lateral, Math.sin(particle.phase) * 12),
    );
    const target = lerp(slime.center, anchor.position, 0.56);
    const desired = add(target, wander);
    particle.velocity = add(scale(particle.velocity, 0.84), scale(sub(desired, particle.position), 0.09));
    particle.position = add(particle.position, scale(particle.velocity, dt * 3.5));
  }
}

function updateDerivedStats(slime: ArmySlime, dt: number): void {
  const direction = normalize(slime.facing);
  const lateral = perpendicular(direction);
  const boundary = slime.nodes.filter((node) => node.role !== "interior");
  const projectedForward = boundary.map((node) => dot(sub(node.position, slime.center), direction));
  const projectedSide = boundary.map((node) => dot(sub(node.position, slime.center), lateral));
  slime.currentDepth = Math.max(...projectedForward) - Math.min(...projectedForward);
  slime.currentWidth = Math.max(...projectedSide) - Math.min(...projectedSide);
  const areaRatio =
    (slime.baseWidth * slime.baseDepth) /
    Math.max(
      slime.baseWidth * slime.baseDepth * 0.245,
      slime.currentWidth * slime.currentDepth,
    );
  slime.currentDensity = clamp(areaRatio, 0.55, 1.82);
  slime.tension = clamp01(
    Math.max(0, slime.currentWidth / slime.baseWidth - 1) * 0.9 +
      (100 - slime.cohesion) / 210,
  );
  const overExtension = clamp01(
    (slime.currentWidth - slime.baseWidth * 1.14) /
      (slime.baseWidth * 0.72),
  );
  const lowDensity = clamp01((1.05 - slime.currentDensity) / 0.45);
  const lowCohesion = clamp01((72 - slime.cohesion) / 72);
  slime.gapRisk = clamp01(
    overExtension * 0.58 + lowDensity * 0.32 + lowCohesion * 0.28 + (slime.pressure / 100) * 0.18,
  );
  slime.crowding = Math.max(0, slime.currentDensity / 1.22 - 1);
  if (slime.crowding > 0) {
    slime.fatigue += slime.crowding * 5 * dt;
    slime.cohesion -= slime.crowding * 6 * dt;
  }
  slime.breakthroughPower = clamp01(
    slime.currentDensity * 0.34 +
      slime.morale / 330 +
      slime.cohesion / 420 +
      (slime.posture === "breakthrough" ? 0.2 : 0),
  );
  slime.envelopPower = clamp01(
    slime.currentWidth / 520 +
      slime.zocRadius / 190 +
      slime.cohesion / 420 -
      slime.gapRisk * 0.28,
  );
  slime.pressure = clamp(slime.pressure - (slime.isEngaged ? 0.5 : 7) * dt, 0, 100);
  slime.fatigue = clamp(slime.fatigue - (slime.isEngaged || slime.posture === "breakthrough" ? 0 : 0.7) * dt, 0, 100);
  slime.cohesion = clamp(slime.cohesion + (!slime.isEngaged && slime.crowding < 0.05 ? 0.45 * dt : 0), 0, 100);
  slime.morale = clamp(slime.morale + (!slime.isEngaged && !slime.isEncircled ? 0.22 * dt : 0), 0, 100);
  slime.shockTimer = Math.max(0, slime.shockTimer - dt);
  slime.facing = normalize(lerp(slime.facing, slime.desiredDirection, clamp01(dt * 2.2)));
  for (const node of slime.nodes) {
    node.localDensity = clamp(slime.currentDensity * (0.9 + Math.sin(node.position.x * 0.04) * 0.08), 0.45, 1.9);
    node.localPressure = slime.pressure * (node.role === "front" ? 1.18 : 0.72);
    node.localMorale = slime.morale;
    node.localCohesion = slime.cohesion;
  }
  updateZocStats(slime);
}

export function updateSlime(
  slime: ArmySlime,
  enemy: ArmySlime,
  dt: number,
  bounds: { width: number; height: number },
): void {
  updateDesiredShape(slime);
  const forces: ForceMap = new Map();
  applyOrderForces(slime, forces);
  applySpringForces(slime, enemy, forces, dt);
  applyDensityForces(slime, forces);
  applyZocForces(slime, enemy, forces);
  applyTerrainForces(slime, forces, bounds);
  integrateNodes(slime, enemy, forces, dt, bounds);
  updateParticles(slime, dt);
  updateDerivedStats(slime, dt);
}
