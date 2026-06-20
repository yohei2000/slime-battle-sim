import type { BattleState } from "./types";
import { createArmySlime } from "./slime";
import { updateOrder } from "./slimeOrders";
import { updateSlime } from "./slimePhysics";
import { resolveCombat } from "./slimeCombat";
import { updateEncirclement } from "./encirclement";
import { updateEnemyAI } from "./enemyAI";
import { splitArmySlime, shouldSplitSlime, updateSplitStress } from "./slimeSplit";
import { distance } from "./vector";
import type { ArmySlime } from "./types";

export class BattleSimulation {
  readonly state: BattleState;
  readonly bounds = { width: 1400, height: 900 };

  constructor() {
    const player = createArmySlime("azure-tide", "player", { x: 390, y: 450 }, { x: 1, y: 0 });
    const enemy = createArmySlime("crimson-mire", "enemy", { x: 1010, y: 450 }, { x: -1, y: 0 });
    this.state = {
      player,
      enemy,
      playerSlimes: [player],
      enemySlimes: [enemy],
      elapsed: 0,
      speed: 1,
      paused: false,
    };
  }

  update(rawDt: number): void {
    if (this.state.paused || this.state.winner) return;
    const dt = Math.min(rawDt, 0.033) * this.state.speed;
    this.state.elapsed += dt;
    const players = this.state.playerSlimes;
    const enemies = this.state.enemySlimes;

    for (const slime of [...players, ...enemies]) {
      updateOrder(slime, this.state.elapsed);
    }
    for (const enemy of enemies) {
      const target = this.nearest(enemy, players);
      if (target) updateEnemyAI(enemy, target, this.state.elapsed);
    }

    for (const player of players) {
      const enemy = this.nearest(player, enemies);
      if (enemy) resolveCombat(player, enemy, dt);
    }
    for (const enemy of enemies) {
      const player = this.nearest(enemy, players);
      if (player) resolveCombat(enemy, player, dt);
    }

    for (const player of players) {
      const enemy = this.nearest(player, enemies);
      if (enemy) updateSlime(player, enemy, dt, this.bounds);
    }
    for (const enemy of enemies) {
      const player = this.nearest(enemy, players);
      if (player) updateSlime(enemy, player, dt, this.bounds);
    }

    for (const player of players) {
      const enemy = this.nearest(player, enemies);
      if (enemy) updateEncirclement(player, enemy, dt);
    }
    for (const enemy of enemies) {
      const player = this.nearest(enemy, players);
      if (player) updateEncirclement(enemy, player, dt);
    }

    this.state.playerSlimes = this.processSplits(players, dt);
    this.state.enemySlimes = this.processSplits(enemies, dt);
    this.state.player =
      this.state.playerSlimes.find((slime) => slime.isSelected) ??
      this.state.playerSlimes[0];
    this.state.enemy = this.nearest(this.state.player, this.state.enemySlimes) ?? this.state.enemySlimes[0];

    const playerAlive = this.state.playerSlimes.some(
      (slime) => slime.morale > 3 && slime.cohesion > 2,
    );
    const enemyAlive = this.state.enemySlimes.some(
      (slime) => slime.morale > 3 && slime.cohesion > 2,
    );
    if (!playerAlive) this.state.winner = "enemy";
    if (!enemyAlive) this.state.winner = "player";
  }

  cycleSpeed(): void {
    this.state.speed = this.state.speed === 1 ? 1.5 : this.state.speed === 1.5 ? 0.5 : 1;
  }

  private nearest(origin: ArmySlime, candidates: ArmySlime[]): ArmySlime | undefined {
    return candidates.reduce<ArmySlime | undefined>((nearest, candidate) => {
      if (!nearest) return candidate;
      return distance(origin.center, candidate.center) <
        distance(origin.center, nearest.center)
        ? candidate
        : nearest;
    }, undefined);
  }

  private processSplits(slimes: ArmySlime[], dt: number): ArmySlime[] {
    const result: ArmySlime[] = [];
    for (const slime of slimes) {
      updateSplitStress(slime, dt);
      if (shouldSplitSlime(slime)) {
        result.push(...splitArmySlime(slime));
      } else {
        result.push(slime);
      }
    }
    return result;
  }
}
