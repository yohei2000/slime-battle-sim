import type { ArmySlime, SlimeNode, Vector2Like } from "./types";
import { add, clamp, clamp01, distance, dot, normalize, scale, sub } from "./vector";

export type ZocBoundarySample = {
  closestPoint: Vector2Like;
  zocClosestPoint: Vector2Like;
  outwardNormal: Vector2Like;
  distance: number;
  insideBody: boolean;
  insideZoc: boolean;
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

function pointInsidePolygon(points: Vector2Like[], point: Vector2Like): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 0.0001) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function smoothClosed(points: Vector2Like[], passes = 2): Vector2Like[] {
  let result = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Vector2Like[] = [];
    for (let i = 0; i < result.length; i += 1) {
      const a = result[i];
      const b = result[(i + 1) % result.length];
      next.push(add(scale(a, 0.75), scale(b, 0.25)));
      next.push(add(scale(a, 0.25), scale(b, 0.75)));
    }
    result = next;
  }
  return result;
}

function segmentOutwardNormal(
  start: Vector2Like,
  end: Vector2Like,
  center: Vector2Like,
): Vector2Like {
  const tangent = normalize(sub(end, start));
  const candidate = { x: -tangent.y, y: tangent.x };
  const midpoint = scale(add(start, end), 0.5);
  return dot(candidate, sub(midpoint, center)) >= 0
    ? candidate
    : scale(candidate, -1);
}

export function getBodyBoundaryPoints(slime: ArmySlime): Vector2Like[] {
  return boundary(slime).map((node) => ({ ...node.position }));
}

export function getZocBoundaryPoints(
  slime: ArmySlime,
  clearanceScale = 1,
): Vector2Like[] {
  const body = getBodyBoundaryPoints(slime);
  if (body.length < 3) return body;
  const clearance = slime.zocRadius * clearanceScale;
  const expanded = body.map((point, index) => {
    const previous = body[(index - 1 + body.length) % body.length];
    const next = body[(index + 1) % body.length];
    const previousNormal = segmentOutwardNormal(previous, point, slime.center);
    const nextNormal = segmentOutwardNormal(point, next, slime.center);
    const averagedNormal = normalize(add(previousNormal, nextNormal));
    const safeNormal =
      dot(averagedNormal, sub(point, slime.center)) > 0.05
        ? averagedNormal
        : normalize(sub(point, slime.center));
    return add(point, scale(safeNormal, clearance));
  });
  return smoothClosed(expanded);
}

function closestPolygonSample(
  points: Vector2Like[],
  center: Vector2Like,
  point: Vector2Like,
): {
  closestPoint: Vector2Like;
  distance: number;
  outwardNormal: Vector2Like;
} {
  let closestPoint = points[0] ?? center;
  let closestDistance = Number.POSITIVE_INFINITY;
  let outwardNormal = normalize(sub(closestPoint, center));
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const candidate = closestPointOnSegment(point, start, end);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < closestDistance) {
      closestPoint = candidate;
      closestDistance = candidateDistance;
      outwardNormal = segmentOutwardNormal(start, end, center);
    }
  }
  return { closestPoint, distance: closestDistance, outwardNormal };
}

export function sampleEnemyZoc(
  enemy: ArmySlime,
  point: Vector2Like,
  clearanceScale = 1,
): ZocBoundarySample {
  const bodyPoints = getBodyBoundaryPoints(enemy);
  const zocPoints = getZocBoundaryPoints(enemy, clearanceScale);
  const bodySample = closestPolygonSample(bodyPoints, enemy.center, point);
  const zocSample = closestPolygonSample(zocPoints, enemy.center, point);
  const insideBody = pointInsidePolygon(bodyPoints, point);
  const insideZoc = insideBody || pointInsidePolygon(zocPoints, point);
  const clearance = enemy.zocRadius * clearanceScale;
  const penetration = insideZoc ? zocSample.distance : -zocSample.distance;

  return {
    closestPoint: bodySample.closestPoint,
    zocClosestPoint: zocSample.closestPoint,
    outwardNormal: zocSample.outwardNormal,
    distance: bodySample.distance,
    insideBody,
    insideZoc,
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
  if (!sample.insideZoc) return point;
  const target = add(
    sample.zocClosestPoint,
    scale(sample.outwardNormal, 0.75),
  );
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
