import type { ArmySlime, SlimeNode, Vector2Like } from "./types";
import { add, average, clamp, clamp01, distance, dot, normalize, scale, sub } from "./vector";

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

export type ZocFieldSegment = {
  start: Vector2Like;
  end: Vector2Like;
};

type BoundaryCacheEntry = {
  bodyPoints: Vector2Like[];
  bodySegments: ZocFieldSegment[];
  zocSegments: ZocFieldSegment[];
  zocPointsByScale: Map<number, Vector2Like[]>;
};

const boundaryCache = new WeakMap<ArmySlime, BoundaryCacheEntry>();

function boundaryNodes(slime: ArmySlime): SlimeNode[] {
  return slime.nodes.filter((node) => node.role !== "interior");
}

function sortedBoundary(slime: ArmySlime, nodes: SlimeNode[]): SlimeNode[] {
  if (nodes.length < 3) return nodes;
  const center = average(nodes.map((node) => node.position));
  return [...nodes].sort(
    (a, b) =>
      Math.atan2(a.position.y - center.y, a.position.x - center.x) -
      Math.atan2(b.position.y - center.y, b.position.x - center.x),
  );
}

function uniqueLinkSegments(slime: ArmySlime): ZocFieldSegment[] {
  const byId = new Map(slime.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const segments: ZocFieldSegment[] = [];
  for (const node of slime.nodes) {
    for (const link of node.links) {
      if (link.broken) continue;
      const key = [link.nodeAId, link.nodeBId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const a = byId.get(link.nodeAId);
      const b = byId.get(link.nodeBId);
      if (!a || !b) continue;
      segments.push({
        start: { ...a.position },
        end: { ...b.position },
      });
    }
  }
  return segments;
}

function ringSegments(nodes: SlimeNode[]): ZocFieldSegment[] {
  if (nodes.length < 2) return [];
  const segments: ZocFieldSegment[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    const b = nodes[(i + 1) % nodes.length];
    segments.push({
      start: { ...a.position },
      end: { ...b.position },
    });
  }
  return segments;
}

function cachedBoundary(slime: ArmySlime): BoundaryCacheEntry {
  const cached = boundaryCache.get(slime);
  if (cached) return cached;

  const nodes = boundaryNodes(slime);
  const sortedNodes = sortedBoundary(slime, nodes);
  const bodyPoints = sortedNodes.map((node) => ({
    ...node.position,
  }));
  const entry: BoundaryCacheEntry = {
    bodyPoints,
    bodySegments: uniqueLinkSegments(slime),
    zocSegments: ringSegments(sortedNodes),
    zocPointsByScale: new Map(),
  };
  boundaryCache.set(slime, entry);
  return entry;
}

export function invalidateZocBoundaryCache(slime: ArmySlime): void {
  boundaryCache.delete(slime);
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
  return cachedBoundary(slime).bodyPoints.map((point) => ({ ...point }));
}

export function getZocFieldSegments(slime: ArmySlime): ZocFieldSegment[] {
  return cachedBoundary(slime).zocSegments.map((segment) => ({
    start: { ...segment.start },
    end: { ...segment.end },
  }));
}

export function getZocBoundaryPoints(
  slime: ArmySlime,
  clearanceScale = 1,
): Vector2Like[] {
  const cache = cachedBoundary(slime);
  const cacheKey = Math.round(clearanceScale * 1000) / 1000;
  const cached = cache.zocPointsByScale.get(cacheKey);
  if (cached) return cached.map((point) => ({ ...point }));

  const body = cache.bodyPoints;
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
  const zocPoints = smoothClosed(expanded);
  cache.zocPointsByScale.set(cacheKey, zocPoints);
  return zocPoints.map((point) => ({ ...point }));
}

function closestSegmentFieldSample(
  segments: ZocFieldSegment[],
  center: Vector2Like,
  point: Vector2Like,
): {
  closestPoint: Vector2Like;
  distance: number;
  outwardNormal: Vector2Like;
} {
  let closestPoint = segments[0]?.start ?? center;
  let closestDistance = Number.POSITIVE_INFINITY;
  let outwardNormal = normalize(sub(closestPoint, center));
  for (const segment of segments) {
    const candidate = closestPointOnSegment(point, segment.start, segment.end);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < closestDistance) {
      closestPoint = candidate;
      closestDistance = candidateDistance;
      const fromSegment = sub(point, candidate);
      outwardNormal =
        Math.hypot(fromSegment.x, fromSegment.y) > 0.001
          ? normalize(fromSegment)
          : segmentOutwardNormal(segment.start, segment.end, center);
    }
  }
  return { closestPoint, distance: closestDistance, outwardNormal };
}

export function sampleEnemyZoc(
  enemy: ArmySlime,
  point: Vector2Like,
  clearanceScale = 1,
): ZocBoundarySample {
  const cache = cachedBoundary(enemy);
  const bodySegments =
    cache.bodySegments.length > 0 ? cache.bodySegments : cache.zocSegments;
  const zocSegments =
    cache.zocSegments.length > 0 ? cache.zocSegments : bodySegments;
  const bodySample = closestSegmentFieldSample(
    bodySegments,
    enemy.center,
    point,
  );
  const zocSample = closestSegmentFieldSample(zocSegments, enemy.center, point);
  const clearance = enemy.zocRadius * clearanceScale;
  const bodyTubeRadius = 16 + Math.min(1.8, enemy.currentDensity) * 12;
  const insideBody = bodySample.distance <= bodyTubeRadius;
  const insideZoc = insideBody || zocSample.distance <= clearance;
  const penetration = insideBody
    ? Math.max(clearance, bodyTubeRadius - bodySample.distance)
    : clearance - zocSample.distance;

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
    scale(sample.outwardNormal, sample.clearance + 0.75),
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
        : slime.posture === "envelop"
          ? 0.92
          : slime.posture === "spread"
            ? 0.74
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
      : slime.posture === "envelop"
        ? 0.95
        : slime.posture === "spread"
          ? 0.78
        : 1.08;
  slime.zocStrength = moraleFactor * cohesionFactor * densityFactor * spreadFactor;
  slime.zocRadius = Math.min(
    88,
    34 +
      slime.currentWidth * 0.05 +
      (slime.posture === "envelop"
        ? 34
        : slime.posture === "spread"
          ? 24
          : 4),
  );
}

export function zocContinuity(slime: ArmySlime): number {
  return clamp01(1 - slime.gapRisk * 0.72 - Math.max(0, slime.tension - 0.5) * 0.35);
}
