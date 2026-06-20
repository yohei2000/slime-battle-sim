import type {
  ArmySlime,
  Side,
  SlimeLink,
  SlimeNode,
  SlimeNodeRole,
  SlimeParticle,
  Vector2Like,
} from "./types";
import { add, normalize, perpendicular, rotate, scale } from "./vector";

const RING_NODE_COUNT = 18;
const PARTICLE_COUNT = 128;

export type ArmySlimeOptions = {
  width?: number;
  depth?: number;
  mass?: number;
  particleCount?: number;
  splitGeneration?: number;
};

function roleForAngle(angle: number): SlimeNodeRole {
  const forward = Math.cos(angle);
  const side = Math.sin(angle);
  if (forward > 0.55) return "front";
  if (forward < -0.55) return "rear";
  return side > 0 ? "left" : "right";
}

export function createArmySlime(
  id: string,
  side: Side,
  center: Vector2Like,
  facing: Vector2Like,
  options: ArmySlimeOptions = {},
): ArmySlime {
  const direction = normalize(facing);
  const lateral = perpendicular(direction);
  const width = options.width ?? 250;
  const depth = options.depth ?? 180;
  const mass = options.mass ?? 100;
  const particleCount = options.particleCount ?? PARTICLE_COUNT;
  const nodes: SlimeNode[] = [];
  const links: SlimeLink[] = [];

  for (let i = 0; i < RING_NODE_COUNT; i += 1) {
    const angle = (i / RING_NODE_COUNT) * Math.PI * 2;
    const offset = add(
      scale(direction, Math.cos(angle) * depth * 0.5),
      scale(lateral, Math.sin(angle) * width * 0.5),
    );
    nodes.push({
      id: `${id}-node-${i}`,
      role: roleForAngle(angle),
      position: add(center, offset),
      velocity: { x: 0, y: 0 },
      targetPosition: add(center, offset),
      mass: 1,
      localDensity: 1,
      localPressure: 0,
      localMorale: 82,
      localCohesion: 82,
      links: [],
    });
  }

  nodes.push({
    id: `${id}-core`,
    role: "interior",
    position: { ...center },
    velocity: { x: 0, y: 0 },
    targetPosition: { ...center },
    mass: 2.5,
    localDensity: 1,
    localPressure: 0,
    localMorale: 84,
    localCohesion: 88,
    links: [],
  });

  const core = nodes[nodes.length - 1];
  const connect = (a: SlimeNode, b: SlimeNode, stiffness: number): void => {
    const restLength = Math.hypot(
      a.position.x - b.position.x,
      a.position.y - b.position.y,
    );
    const link: SlimeLink = {
      nodeAId: a.id,
      nodeBId: b.id,
      restLength,
      stiffness,
      damping: 0.72,
      integrity: 1,
      stress: 0,
      localPressure: 0,
      broken: false,
    };
    links.push(link);
    a.links.push(link);
    b.links.push(link);
  };

  for (let i = 0; i < RING_NODE_COUNT; i += 1) {
    connect(nodes[i], nodes[(i + 1) % RING_NODE_COUNT], 0.84);
    connect(nodes[i], core, 0.32);
    if (i % 3 === 0) connect(nodes[i], nodes[(i + 3) % RING_NODE_COUNT], 0.22);
  }

  const particles: SlimeParticle[] = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i * 2.399963229728653) % (Math.PI * 2);
    const radius = Math.sqrt((i + 0.5) / particleCount) * 0.88;
    const local = add(
      scale(direction, Math.cos(angle) * depth * 0.5 * radius),
      scale(lateral, Math.sin(angle) * width * 0.5 * radius),
    );
    const nodeIndex = Math.round((angle / (Math.PI * 2)) * RING_NODE_COUNT) % RING_NODE_COUNT;
    return {
      id: `${id}-particle-${i}`,
      position: add(center, local),
      velocity: { x: 0, y: 0 },
      localNodeId: nodes[nodeIndex].id,
      alive: true,
      phase: Math.random() * Math.PI * 2,
    };
  });

  return {
    id,
    side,
    center: { ...center },
    velocity: { x: 0, y: 0 },
    facing: direction,
    posture: "neutral",
    nodes,
    particles,
    desiredCenter: { ...center },
    desiredDirection: direction,
    desiredWidth: width,
    desiredDepth: depth,
    desiredDensity: 1,
    desiredLeftWingAdvance: 0,
    desiredRightWingAdvance: 0,
    baseWidth: width,
    baseDepth: depth,
    currentWidth: width,
    currentDepth: depth,
    currentDensity: 1,
    mass,
    morale: side === "player" ? 84 : 82,
    cohesion: 86,
    fatigue: 8,
    pressure: 0,
    elasticity: 0.86,
    viscosity: 0.82,
    tension: 0,
    crowding: 0,
    gapRisk: 0.08,
    zocStrength: 1,
    zocRadius: 42,
    isSelected: side === "player",
    isEngaged: false,
    isEncircling: false,
    isEncircled: false,
    contactPatches: [],
    activeOrder: undefined,
    encirclement: 0,
    breakthroughPower: 0.5,
    envelopPower: 0.5,
    commandDelay: 0,
    shockTimer: 0,
    aiThinkAt: 0,
    linkIntegrity: 1,
    brokenLinkRatio: 0,
    toughness: 0.68,
    effectiveToughness: 0.68,
    peakLocalStress: 0,
    fractureConcentration: 0,
    fractureLinkCount: 0,
    fractureCenter: { ...center },
    fractureNormal: direction,
    splitStress: 0,
    splitGeneration: options.splitGeneration ?? 0,
    splitCooldown: 0,
  };
}

export function getBoundaryNodes(slime: ArmySlime): SlimeNode[] {
  return slime.nodes.filter((node) => node.role !== "interior");
}

export function pointInsideSlime(slime: ArmySlime, point: Vector2Like, padding = 0): boolean {
  const direction = normalize(slime.facing);
  const lateral = perpendicular(direction);
  const delta = { x: point.x - slime.center.x, y: point.y - slime.center.y };
  const forward = delta.x * direction.x + delta.y * direction.y;
  const sideways = delta.x * lateral.x + delta.y * lateral.y;
  const rx = slime.currentDepth * 0.55 + padding;
  const ry = slime.currentWidth * 0.55 + padding;
  return (forward * forward) / (rx * rx) + (sideways * sideways) / (ry * ry) <= 1;
}

export function postureLabel(posture: ArmySlime["posture"]): string {
  return {
    neutral: "中立",
    spread: "展開",
    envelop: "包囲",
    contract: "密集",
    breakthrough: "突破",
    hold: "保持",
    retreat: "後退",
  }[posture];
}

export function setDesiredFacing(slime: ArmySlime, facing: Vector2Like): void {
  slime.desiredDirection = normalize(facing);
}

export function jitterFacing(slime: ArmySlime, amount: number): Vector2Like {
  return rotate(slime.facing, Math.sin(slime.tension * 13 + slime.center.x) * amount);
}
