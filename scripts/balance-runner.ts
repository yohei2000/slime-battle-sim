// @ts-nocheck
import { mkdirSync, writeFileSync } from "node:fs";
import { BattleSimulation } from "../src/sim/simulation";
import type { ArmySlime, SlimePosture, Vector2Like } from "../src/sim/types";
import { flankAccess } from "../src/sim/encirclement";
import { issueOrder } from "../src/sim/slimeOrders";
import { add, clamp, distance, normalize, perpendicular, scale, sub } from "../src/sim/vector";

type PolicyId = "cpu-basic" | "player-adaptive" | "breakthrough-only" | "envelop-only";
type Winner = "player" | "enemy" | "draw" | "timeout";

type BalanceMetrics = {
  maxEnemyEncirclement: number;
  maxPlayerEncirclement: number;
  maxPlayerBreakthrough: number;
  maxEnemyBreakthrough: number;
  maxPlayerCrowding: number;
  maxPlayerGapRisk: number;
  maxEnemyGapRisk: number;
  maxPlayerSplitStress: number;
  maxEnemySplitStress: number;
  playerSplits: number;
  enemySplits: number;
};

type BattleResult = {
  seed: number;
  policy: PolicyId;
  winner: Winner;
  elapsed: number;
  playerMorale: number;
  enemyMorale: number;
  playerCohesion: number;
  enemyCohesion: number;
  playerSlimes: number;
  enemySlimes: number;
  score: number;
  likelyCause: string;
  metrics: BalanceMetrics;
};

type PolicyRuntime = {
  nextOrderAt: number;
};

const POLICIES: PolicyId[] = [
  "cpu-basic",
  "player-adaptive",
  "breakthrough-only",
  "envelop-only",
];
const DEFAULT_SEEDS = [
  1001, 1002, 1003, 1004,
];
const SEEDS = process.env.BALANCE_SEEDS
  ? process.env.BALANCE_SEEDS.split(",").map((value) => Number(value.trim())).filter(Number.isFinite)
  : DEFAULT_SEEDS;
const MAX_SECONDS = Number(process.env.BALANCE_SECONDS ?? 120);
const SIM_SPEED = Number(process.env.BALANCE_SIM_SPEED ?? 1);
const DT = 1 / 30;

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runWithSeed<T>(seed: number, fn: () => T): T {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function nearest(origin: ArmySlime, candidates: ArmySlime[]): ArmySlime | undefined {
  return candidates.reduce<ArmySlime | undefined>((best, candidate) => {
    if (!best) return candidate;
    return distance(origin.center, candidate.center) < distance(origin.center, best.center)
      ? candidate
      : best;
  }, undefined);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sideAverage(slimes: ArmySlime[], key: "morale" | "cohesion"): number {
  return average(slimes.map((slime) => slime[key]));
}

function shapeFor(posture: SlimePosture): { width: number; depth: number; density: number } {
  if (posture === "breakthrough" || posture === "contract") {
    return { width: 184, depth: 224, density: 1.23 };
  }
  if (posture === "spread" || posture === "envelop") {
    return { width: 408, depth: 142, density: 0.76 };
  }
  return { width: 252, depth: 180, density: 1 };
}

function enemyCenterTarget(enemy: ArmySlime): Vector2Like {
  return add(enemy.center, scale(enemy.facing, enemy.currentDepth * 0.06));
}

function flankTarget(attacker: ArmySlime, defender: ArmySlime): Vector2Like {
  const lateral = perpendicular(defender.facing);
  const side = Math.sin(attacker.center.x * 0.011 + attacker.center.y * 0.019) > 0 ? 1 : -1;
  return add(defender.center, scale(lateral, defender.currentWidth * 0.45 * side));
}

function issuePlayerShapeOrder(
  player: ArmySlime,
  enemy: ArmySlime,
  posture: SlimePosture,
  now: number,
  focusPoint: Vector2Like,
  intensity = 1,
): void {
  const shape = shapeFor(posture);
  const direction = normalize(sub(focusPoint, player.center));
  const moveDistance =
    posture === "breakthrough"
      ? 112
      : posture === "envelop"
        ? 76
        : posture === "spread"
          ? 46
          : posture === "contract"
            ? 52
            : 0;
  const wingAdvance =
    posture === "envelop"
      ? clamp((enemy.currentWidth * 0.31 + player.currentWidth * 0.12) * intensity, 30, 136)
      : 0;
  issueOrder(player, {
    posture,
    targetCenter: add(player.center, scale(direction, moveDistance * intensity)),
    targetDirection: direction,
    targetWidth: clamp(shape.width * (posture === "envelop" ? intensity : 1), 145, 520),
    targetDepth: clamp(shape.depth, 110, 280),
    targetDensity: shape.density,
    targetLeftWingAdvance: wingAdvance,
    targetRightWingAdvance: wingAdvance,
    targetFocusPoint:
      posture === "breakthrough" || posture === "envelop" ? focusPoint : undefined,
    issuedAt: now,
  });
}

function choosePosture(policy: PolicyId, player: ArmySlime, enemy: ArmySlime): {
  posture: SlimePosture;
  focus: Vector2Like;
  intensity: number;
  cooldown: number;
} {
  const access = flankAccess(player, enemy);
  const canBreak =
    enemy.gapRisk > 0.48 ||
    (enemy.currentWidth > enemy.baseWidth * 1.32 && enemy.currentDensity < 0.98) ||
    enemy.cohesion < 42;
  const canWrap =
    access > 0.16 ||
    enemy.currentDensity > 1.14 ||
    player.currentWidth > enemy.currentWidth * 0.95;

  if (policy === "breakthrough-only") {
    return {
      posture: player.crowding > 0.34 ? "hold" : "breakthrough",
      focus: enemyCenterTarget(enemy),
      intensity: 1.05,
      cooldown: 1.05,
    };
  }

  if (policy === "envelop-only") {
    return {
      posture: "envelop",
      focus: flankTarget(player, enemy),
      intensity: 1.08,
      cooldown: 1.1,
    };
  }

  if (policy === "cpu-basic") {
    if (player.crowding > 0.26) {
      return { posture: "spread", focus: enemyCenterTarget(enemy), intensity: 0.76, cooldown: 2.8 };
    }
    if (enemy.gapRisk > 0.64 && Math.random() > 0.32) {
      return { posture: "breakthrough", focus: enemyCenterTarget(enemy), intensity: 0.78, cooldown: 2.55 };
    }
    if (enemy.currentDensity > 1.25 && access > 0.18 && Math.random() > 0.38) {
      return { posture: "envelop", focus: flankTarget(player, enemy), intensity: 0.76, cooldown: 2.75 };
    }
    return Math.random() > 0.52
      ? { posture: "breakthrough", focus: enemyCenterTarget(enemy), intensity: 0.68, cooldown: 2.9 }
      : { posture: "envelop", focus: flankTarget(player, enemy), intensity: 0.64, cooldown: 3.05 };
  }

  if (player.isEncircled && player.breakthroughPower > 0.48) {
    return { posture: "breakthrough", focus: enemyCenterTarget(enemy), intensity: 1.18, cooldown: 0.8 };
  }
  if (player.gapRisk > 0.7) {
    return { posture: "breakthrough", focus: enemyCenterTarget(enemy), intensity: 0.98, cooldown: 0.72 };
  }
  if (player.crowding > 0.3 || player.fatigue > 78) {
    return { posture: "spread", focus: enemyCenterTarget(enemy), intensity: 0.86, cooldown: 0.9 };
  }
  if (enemy.encirclement > 0.32) {
    return { posture: "envelop", focus: flankTarget(player, enemy), intensity: 1.14, cooldown: 0.75 };
  }
  if (canBreak && player.breakthroughPower >= 0.5) {
    return { posture: "breakthrough", focus: enemyCenterTarget(enemy), intensity: 1.16, cooldown: 0.78 };
  }
  if (canWrap) {
    return { posture: "envelop", focus: flankTarget(player, enemy), intensity: 1.18, cooldown: 0.82 };
  }
  return player.breakthroughPower > player.envelopPower + 0.08
    ? { posture: "breakthrough", focus: enemyCenterTarget(enemy), intensity: 1.04, cooldown: 0.9 }
    : { posture: "envelop", focus: flankTarget(player, enemy), intensity: 1.06, cooldown: 0.92 };
}

function updatePlayerPolicy(
  sim: BattleSimulation,
  policy: PolicyId,
  runtime: PolicyRuntime,
): void {
  const now = sim.state.elapsed;
  if (now < runtime.nextOrderAt || sim.state.winner) return;
  for (const player of sim.state.playerSlimes) {
    if (player.isRouting) continue;
    const enemy = nearest(player, sim.state.enemySlimes);
    if (!enemy) continue;
    const decision = choosePosture(policy, player, enemy);
    issuePlayerShapeOrder(
      player,
      enemy,
      decision.posture,
      now,
      decision.focus,
      decision.intensity,
    );
    runtime.nextOrderAt = Math.max(runtime.nextOrderAt, now + decision.cooldown);
  }
}

function blankMetrics(): BalanceMetrics {
  return {
    maxEnemyEncirclement: 0,
    maxPlayerEncirclement: 0,
    maxPlayerBreakthrough: 0,
    maxEnemyBreakthrough: 0,
    maxPlayerCrowding: 0,
    maxPlayerGapRisk: 0,
    maxEnemyGapRisk: 0,
    maxPlayerSplitStress: 0,
    maxEnemySplitStress: 0,
    playerSplits: 0,
    enemySplits: 0,
  };
}

function updateMetrics(
  metrics: BalanceMetrics,
  sim: BattleSimulation,
  previousCounts: { player: number; enemy: number },
): void {
  const players = sim.state.playerSlimes;
  const enemies = sim.state.enemySlimes;
  metrics.maxEnemyEncirclement = Math.max(
    metrics.maxEnemyEncirclement,
    ...enemies.map((slime) => slime.encirclement),
  );
  metrics.maxPlayerEncirclement = Math.max(
    metrics.maxPlayerEncirclement,
    ...players.map((slime) => slime.encirclement),
  );
  metrics.maxPlayerBreakthrough = Math.max(
    metrics.maxPlayerBreakthrough,
    ...players.map((slime) => slime.breakthroughPower),
  );
  metrics.maxEnemyBreakthrough = Math.max(
    metrics.maxEnemyBreakthrough,
    ...enemies.map((slime) => slime.breakthroughPower),
  );
  metrics.maxPlayerCrowding = Math.max(
    metrics.maxPlayerCrowding,
    ...players.map((slime) => slime.crowding),
  );
  metrics.maxPlayerGapRisk = Math.max(
    metrics.maxPlayerGapRisk,
    ...players.map((slime) => slime.gapRisk),
  );
  metrics.maxEnemyGapRisk = Math.max(
    metrics.maxEnemyGapRisk,
    ...enemies.map((slime) => slime.gapRisk),
  );
  metrics.maxPlayerSplitStress = Math.max(
    metrics.maxPlayerSplitStress,
    ...players.map((slime) => slime.splitStress),
  );
  metrics.maxEnemySplitStress = Math.max(
    metrics.maxEnemySplitStress,
    ...enemies.map((slime) => slime.splitStress),
  );
  if (players.length > previousCounts.player) {
    metrics.playerSplits += players.length - previousCounts.player;
    previousCounts.player = players.length;
  }
  if (enemies.length > previousCounts.enemy) {
    metrics.enemySplits += enemies.length - previousCounts.enemy;
    previousCounts.enemy = enemies.length;
  }
}

function scoreBattle(sim: BattleSimulation, metrics: BalanceMetrics): number {
  const playerMorale = sideAverage(sim.state.playerSlimes, "morale");
  const enemyMorale = sideAverage(sim.state.enemySlimes, "morale");
  const playerCohesion = sideAverage(sim.state.playerSlimes, "cohesion");
  const enemyCohesion = sideAverage(sim.state.enemySlimes, "cohesion");
  return (
    playerMorale - enemyMorale +
    (playerCohesion - enemyCohesion) * 0.45 +
    (metrics.maxEnemyEncirclement - metrics.maxPlayerEncirclement) * 26 +
    (metrics.enemySplits - metrics.playerSplits) * 8
  );
}

function likelyCause(result: {
  winner: Winner;
  score: number;
  metrics: BalanceMetrics;
  playerMorale: number;
  enemyMorale: number;
}): string {
  if (result.winner === "timeout") return result.score >= 0 ? "timeout-player-edge" : "timeout-enemy-edge";
  if (result.winner === "draw") return "mutual-rout";
  if (result.metrics.maxEnemyEncirclement > 0.55 && result.winner === "player") return "player-encirclement";
  if (result.metrics.maxPlayerEncirclement > 0.55 && result.winner === "enemy") return "enemy-encirclement";
  if (result.metrics.enemySplits > result.metrics.playerSplits && result.winner === "player") return "enemy-fracture";
  if (result.metrics.playerSplits > result.metrics.enemySplits && result.winner === "enemy") return "player-fracture";
  if (result.winner === "player" && result.metrics.maxPlayerBreakthrough > 0.62) return "player-breakthrough";
  if (result.winner === "enemy" && result.metrics.maxEnemyBreakthrough > 0.62) return "enemy-breakthrough";
  return result.winner === "player" ? "enemy-morale-collapse" : "player-morale-collapse";
}

function runBattle(seed: number, policy: PolicyId): BattleResult {
  return runWithSeed(seed, () => {
    const sim = new BattleSimulation();
    sim.state.speed = SIM_SPEED;
    const runtime: PolicyRuntime = { nextOrderAt: 0.35 };
    const metrics = blankMetrics();
    const previousCounts = { player: sim.state.playerSlimes.length, enemy: sim.state.enemySlimes.length };
    while (!sim.state.winner && sim.state.elapsed < MAX_SECONDS) {
      updatePlayerPolicy(sim, policy, runtime);
      sim.update(DT);
      updateMetrics(metrics, sim, previousCounts);
    }

    const playerMorale = sideAverage(sim.state.playerSlimes, "morale");
    const enemyMorale = sideAverage(sim.state.enemySlimes, "morale");
    const playerCohesion = sideAverage(sim.state.playerSlimes, "cohesion");
    const enemyCohesion = sideAverage(sim.state.enemySlimes, "cohesion");
    const score = scoreBattle(sim, metrics);
    const winner = (sim.state.winner ?? "timeout") as Winner;
    const result = {
      seed,
      policy,
      winner,
      elapsed: sim.state.elapsed,
      playerMorale,
      enemyMorale,
      playerCohesion,
      enemyCohesion,
      playerSlimes: sim.state.playerSlimes.length,
      enemySlimes: sim.state.enemySlimes.length,
      score,
      likelyCause: "",
      metrics,
    };
    result.likelyCause = likelyCause(result);
    return result;
  });
}

function winScore(winner: Winner): number {
  if (winner === "player") return 1;
  if (winner === "enemy") return 0;
  return 0.5;
}

function summarize(results: BattleResult[]) {
  return POLICIES.map((policy) => {
    const rows = results.filter((result) => result.policy === policy);
    const playerWins = rows.filter((result) => result.winner === "player").length;
    const enemyWins = rows.filter((result) => result.winner === "enemy").length;
    const draws = rows.length - playerWins - enemyWins;
    return {
      policy,
      count: rows.length,
      playerWins,
      enemyWins,
      draws,
      playerScoreRate: average(rows.map((row) => winScore(row.winner))),
      enemyScoreRate: average(rows.map((row) => 1 - winScore(row.winner))),
      avgElapsed: average(rows.map((row) => row.elapsed)),
      avgPlayerMorale: average(rows.map((row) => row.playerMorale)),
      avgEnemyMorale: average(rows.map((row) => row.enemyMorale)),
      avgEnemyEncirclement: average(rows.map((row) => row.metrics.maxEnemyEncirclement)),
      avgPlayerEncirclement: average(rows.map((row) => row.metrics.maxPlayerEncirclement)),
    };
  });
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fixed(value: number, digits = 1): string {
  return value.toFixed(digits);
}

function verdict(summary: ReturnType<typeof summarize>): string[] {
  const cpu = summary.find((row) => row.policy === "cpu-basic");
  const adaptive = summary.find((row) => row.policy === "player-adaptive");
  const breakthrough = summary.find((row) => row.policy === "breakthrough-only");
  const envelop = summary.find((row) => row.policy === "envelop-only");
  const lines: string[] = [];
  if (cpu) {
    const ok = cpu.enemyScoreRate >= 0.55 && cpu.enemyScoreRate <= 0.65;
    lines.push(
      `CPU基準: 敵スコア率 ${percent(cpu.enemyScoreRate)} ${ok ? "OK" : "要調整"}（目標55〜65%）`,
    );
  }
  if (adaptive) {
    const ok = adaptive.playerScoreRate >= 0.55 && adaptive.playerScoreRate <= 0.7;
    lines.push(
      `プレイヤー方針: 自軍スコア率 ${percent(adaptive.playerScoreRate)} ${ok ? "OK" : "要調整"}（目標55〜70%）`,
    );
  }
  if (breakthrough && adaptive) {
    const ok = breakthrough.playerScoreRate <= adaptive.playerScoreRate + 0.08 && breakthrough.playerScoreRate < 0.76;
    lines.push(
      `突破一強チェック: 自軍スコア率 ${percent(breakthrough.playerScoreRate)} ${ok ? "OK" : "要調整"}`,
    );
  }
  if (envelop && adaptive) {
    const ok = envelop.playerScoreRate <= adaptive.playerScoreRate + 0.08 && envelop.playerScoreRate < 0.76;
    lines.push(
      `包囲一強チェック: 自軍スコア率 ${percent(envelop.playerScoreRate)} ${ok ? "OK" : "要調整"}`,
    );
  }
  return lines;
}

function markdownReport(results: BattleResult[]): string {
  const summary = summarize(results);
  const now = new Date().toISOString();
  return [
    "# Balance Report",
    "",
    `Generated: ${now}`,
    `Seeds: ${SEEDS.join(", ")}`,
    `Max seconds: ${MAX_SECONDS}`,
    `Simulation speed: ${SIM_SPEED}`,
    "",
    "## Verdict",
    "",
    ...verdict(summary).map((line) => `- ${line}`),
    "",
    "## Summary",
    "",
    "| Policy | Battles | Player W-L-D | Player score | Enemy score | Avg seconds | Avg morale P/E | Avg max encirclement enemy/player |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...summary.map((row) =>
      `| ${row.policy} | ${row.count} | ${row.playerWins}-${row.enemyWins}-${row.draws} | ${percent(row.playerScoreRate)} | ${percent(row.enemyScoreRate)} | ${fixed(row.avgElapsed)} | ${fixed(row.avgPlayerMorale)}/${fixed(row.avgEnemyMorale)} | ${fixed(row.avgEnemyEncirclement, 2)}/${fixed(row.avgPlayerEncirclement, 2)} |`,
    ),
    "",
    "## Battles",
    "",
    "| Policy | Seed | Winner | Seconds | Score | Cause | Morale P/E | Cohesion P/E | Splits P/E | Max encirclement enemy/player | Max gap P/E |",
    "|---|---:|---|---:|---:|---|---:|---:|---:|---:|---:|",
    ...results.map((row) =>
      `| ${row.policy} | ${row.seed} | ${row.winner} | ${fixed(row.elapsed)} | ${fixed(row.score)} | ${row.likelyCause} | ${fixed(row.playerMorale)}/${fixed(row.enemyMorale)} | ${fixed(row.playerCohesion)}/${fixed(row.enemyCohesion)} | ${row.metrics.playerSplits}/${row.metrics.enemySplits} | ${fixed(row.metrics.maxEnemyEncirclement, 2)}/${fixed(row.metrics.maxPlayerEncirclement, 2)} | ${fixed(row.metrics.maxPlayerGapRisk, 2)}/${fixed(row.metrics.maxEnemyGapRisk, 2)} |`,
    ),
    "",
  ].join("\n");
}

const results = POLICIES.flatMap((policy) => SEEDS.map((seed) => runBattle(seed, policy)));
const report = markdownReport(results);
mkdirSync("balance-reports", { recursive: true });
writeFileSync("balance-reports/latest.md", report, "utf8");
writeFileSync("balance-reports/latest.json", JSON.stringify(results, null, 2), "utf8");

console.log(report);
