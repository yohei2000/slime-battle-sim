import type { ArmySlime, SlimeNode, Vector2Like } from "./types";
import { add, clamp, clamp01, distance, dot, normalize, scale, sub } from "./vector";

export type ZocBoundarySample = {
  closestPoint: Vector2Like;
  outwardNormal: Vector2Like;
  distance: number;
  insideBody: boolean;
  clearance: number;
  penetration: number;
};

function boundary(slime: ArmySlime): SlimeNode[] {
  return slime.nodes.filter((node) => node.role !== "interior");
}

function closestPointOnSegment(
  point: Vector2Like,
  start: Vector2Like,
  end: Vector2Like,
): Vector2Like {
  const segment = sub(end, start);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared < 0.0001) return { ...start };
  const t = clamp(dot(sub(point, start), segment) / lengthSquared, 0, 1);
  return add(start, scale(segment, t));
}

function pointInsideBoundary(slime: ArmySlime, point: Vector2Like): boolean {
  const nodes = boundary(slime);
  let inside = false;
  for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i, i += 1) {
    const a = nodes[i].position;
    const b = nodes[j].position;
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 0.0001) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function sampleEnemyZoc(
  enemy: ArmySlime,
  point: Vector2Like,
  clearanceScale = 1,
): ZocBoundarySample {
  const nodes = boundary(enemy);
  let closestPoint = nodes[0]?.position ?? enemy.center;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < nodes.length; i += 1) {
    const candidate = closestPointOnSegment(
      point,
      nodes[i].position,
      nodes[(i + 1) % nodes.length].position,
    );
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < closestDistance) {
      closestPoint = candidate;
      closestDistance = candidateDistance;
    }
  }

  const insideBody = pointInsideBoundary(enemy, point);
  const radialNormal = normalize(sub(closestPoint, enemy.center));
  const pointNormal = normalize(sub(point, closestPoint));
  const outwardNormal =
    !insideBody && dot(pointNormal, radialNormal) > 0.1 ? pointNormal : radialNormal;
  const clearance = enemy.zocRadius * clearanceScale;
  const penetration = insideBody ? clearance + closestDistance : clearance - closestDistance;

  return {
    closestPoint,
    outwardNormal,
    distance: closestDistance,
    insideBody,
    clearance,
    penetration,
  };
}

export function projectOutsideEnemyZoc(
  enemy: ArmySlime,
  point: Vector2Like,
  clearanceScale = 1,
  maxCorrection = Number.POSITIVE_INFINITY,
): Vector2Like {
  const sample = sampleEnemyZoc(enemy, point, clearanceScale);
  if (!sample.insideBody && sample.penetration <= 0) return point;
  const target = add(sample.closestPoint, scale(sample.outwardNormal, sample.clearance + 0.75));
  const correction = sub(target, point);
  const correctionLength = Math.hypot(correction.x, correction.y);
  if (correctionLength <= maxCorrection) return target;
  return add(point, scale(correction, maxCorrection / Math.max(0.0001, correctionLength)));
}

export function calculateLocalZoc(slime: ArmySlime, node: SlimeNode, target: SlimeNode): number {
  const moraleFactor = 0.45 + slime.morale / 180;
  const cohesionFactor = 0.35 + slime.cohesion / 150;
  const densityFactor = 0.55 + node.localDensity * 0.45;
  const postureFactor =
    slime.isRouting
      ? 0.38
      : slime.posture === "breakthrough"
      ? 1.28
      : slime.posture === "contract"
        ? 1.18
        : slime.posture === "spread" || slime.posture === "envelop"
          ? 0.78
          : 1;
  const towardTarget = normalize(sub(target.position, node.position));
  const facingFactor = 0.65 + Math.max(0, dot(slime.facing, towardTarget)) * 0.45;
  return slime.zocStrength * moraleFactor * cohesionFactor * densityFactor * postureFactor * facingFactor;
}

export function updateZocStats(slime: ArmySlime): void {
  const moraleFactor = 0.45 + slime.morale / 180;
  const cohesionFactor = 0.4 + slime.cohesion / 165;
  const densityFactor = 0.6 + Math.min(1.6, slime.currentDensity) * 0.38;
  const spreadFactor =
    slime.isRouting
      ? 0.42
      : slime.posture === "spread" || slime.posture === "envelop"
        ? 0.82
        : 1.08;
  slime.zocStrength = moraleFactor * cohesionFactor * densityFactor * spreadFactor;
  slime.zocRadius = Math.min(
    88,
    34 +
      slime.currentWidth * 0.05 +
      (slime.posture === "spread" || slime.posture === "envelop" ? 24 : 4),
  );
}

export function zocContinuity(slime: ArmySlime): number {
  return clamp01(1 - slime.gapRisk * 0.72 - Math.max(0, slime.tension - 0.5) * 0.35);
}
