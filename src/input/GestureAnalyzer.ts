export type GesturePoint = { x: number; y: number };

export type TwoFingerGestureKind =
  | "spread"
  | "contract"
  | "breakthrough"
  | "envelop-advance"
  | "rotate"
  | "left-wing"
  | "right-wing";

export type TwoFingerGestureAnalysis = {
  kind: TwoFingerGestureKind;
  scale: number;
  rotation: number;
  centroidMotion: GesturePoint;
  forwardMotion: number;
  leftWingAdvance: number;
  rightWingAdvance: number;
};

const add = (a: GesturePoint, b: GesturePoint): GesturePoint => ({
  x: a.x + b.x,
  y: a.y + b.y,
});
const sub = (a: GesturePoint, b: GesturePoint): GesturePoint => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
const scalePoint = (a: GesturePoint, amount: number): GesturePoint => ({
  x: a.x * amount,
  y: a.y * amount,
});
const dot = (a: GesturePoint, b: GesturePoint): number =>
  a.x * b.x + a.y * b.y;
const distance = (a: GesturePoint, b: GesturePoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const signedAngle = (a: GesturePoint, b: GesturePoint): number =>
  Math.atan2(a.x * b.y - a.y * b.x, dot(a, b));

export function analyzeTwoFingerGesture(
  startA: GesturePoint,
  startB: GesturePoint,
  currentA: GesturePoint,
  currentB: GesturePoint,
  facing: GesturePoint,
): TwoFingerGestureAnalysis {
  const startCenter = scalePoint(add(startA, startB), 0.5);
  const currentCenter = scalePoint(add(currentA, currentB), 0.5);
  const centroidMotion = sub(currentCenter, startCenter);
  const scaleValue = clamp(
    distance(currentA, currentB) / Math.max(10, distance(startA, startB)),
    0.56,
    1.62,
  );
  const rotation = signedAngle(sub(startB, startA), sub(currentB, currentA));
  const forwardMotion = dot(centroidMotion, facing);
  const lateral = { x: -facing.y, y: facing.x };
  const aIsLeft = dot(sub(startA, startCenter), lateral) >= 0;
  const forwardA = dot(sub(currentA, startA), facing);
  const forwardB = dot(sub(currentB, startB), facing);
  const movementA = distance(currentA, startA);
  const movementB = distance(currentB, startB);
  const balancedFingerMotion =
    Math.min(movementA, movementB) > 16 &&
    Math.max(movementA, movementB) / Math.max(1, Math.min(movementA, movementB)) <
      3;
  const leftForward = aIsLeft ? forwardA : forwardB;
  const rightForward = aIsLeft ? forwardB : forwardA;
  const wingDifference = leftForward - rightForward;
  const rotating =
    Math.abs(rotation) > 0.2 &&
    scaleValue > 0.82 &&
    scaleValue < 1.22 &&
    Math.abs(forwardMotion) < 42 &&
    balancedFingerMotion;
  const advancingOneWing =
    !rotating &&
    scaleValue > 0.84 &&
    scaleValue < 1.18 &&
    Math.abs(wingDifference) > 30 &&
    Math.max(leftForward, rightForward) > 28;
  const movingForward = forwardMotion > 22;

  let kind: TwoFingerGestureKind;
  let leftWingAdvance = 0;
  let rightWingAdvance = 0;
  if (rotating) {
    kind = "rotate";
  } else if (advancingOneWing) {
    if (wingDifference > 0) {
      kind = "left-wing";
      leftWingAdvance = clamp(wingDifference * 1.25, 35, 135);
    } else {
      kind = "right-wing";
      rightWingAdvance = clamp(-wingDifference * 1.25, 35, 135);
    }
  } else if (scaleValue > 1.06 && movingForward) {
    kind = "envelop-advance";
  } else if (scaleValue < 0.94 && movingForward) {
    kind = "breakthrough";
  } else {
    kind = scaleValue >= 1 ? "spread" : "contract";
  }

  return {
    kind,
    scale: scaleValue,
    rotation,
    centroidMotion,
    forwardMotion,
    leftWingAdvance,
    rightWingAdvance,
  };
}
