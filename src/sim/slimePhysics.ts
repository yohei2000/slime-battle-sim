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
import { updateZocStats } from "./zoc";

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

function applySpringForces(slime: ArmySlime, forces: ForceMap): void {
  const byId = new Map(slime.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  for (const node of slime.nodes) {
    for (const link of node.links) {
      const key = [link.nodeAId, link.nodeBId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const a = byId.get(link.nodeAId);
      const b = byId.get(link.nodeBId);
      if (!a || !b) continue;
      const delta = sub(b.position, a.position);
      const currentLength = Math.max(0.001, length(delta));
      const targetScale =
        slime.currentWidth > 0 && (a.role === "left" || a.role === "right" || b.role === "left" || b.role === "right")
          ? slime.desiredWidth / 250
          : slime.desiredDepth / 180;
      const targetLength = link.restLength * clamp(targetScale, 0.62, 1.62);
      const stretch = currentLength - targetLength;
      const direction = scale(delta, 1 / currentLength);
      const relativeVelocity = dot(sub(b.velocity, a.velocity), direction);
      const cohesionStrength = 0.25 + slime.cohesion / 125;
      const magnitude =
        stretch * link.stiffness * cohesionStrength * 0.022 +
        relativeVelocity * link.damping * 0.08;
      addForce(forces, a, scale(direction, magnitude));
      addForce(forces, b, scale(direction, -magnitude));
    }
  }
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

function applyEnemyPressure(slime: ArmySlime, enemy: ArmySlime, forces: ForceMap): void {
  for (const node of slime.nodes) addForce(forces, node, contactPushForce(slime, enemy, node));
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

function integrateNodes(slime: ArmySlime, forces: ForceMap, dt: number): void {
  for (const node of slime.nodes) {
    const force = forces.get(node.id) ?? { x: 0, y: 0 };
    node.velocity = add(node.velocity, scale(force, dt * 60 / node.mass));
    node.velocity = scale(node.velocity, Math.pow(slime.viscosity, dt * 3.5));
    const speed = length(node.velocity);
    if (speed > 120) node.velocity = scale(node.velocity, 120 / speed);
    node.position = add(node.position, scale(node.velocity, dt));
  }
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
  const areaRatio = (250 * 180) / Math.max(11000, slime.currentWidth * slime.currentDepth);
  slime.currentDensity = clamp(areaRatio, 0.55, 1.82);
  slime.tension = clamp01(Math.max(0, slime.currentWidth / 250 - 1) * 0.9 + (100 - slime.cohesion) / 210);
  const overExtension = clamp01((slime.currentWidth - 285) / 180);
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
  applySpringForces(slime, forces);
  applyDensityForces(slime, forces);
  applyEnemyPressure(slime, enemy, forces);
  applyTerrainForces(slime, forces, bounds);
  integrateNodes(slime, forces, dt);
  updateParticles(slime, dt);
  updateDerivedStats(slime, dt);
}
