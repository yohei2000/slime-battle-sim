import type { BattleState } from "./types";
import { createArmySlime } from "./slime";
import { updateOrder } from "./slimeOrders";
import { updateSlime } from "./slimePhysics";
import { resolveCombat } from "./slimeCombat";
import { updateEncirclement } from "./encirclement";
import { updateEnemyAI } from "./enemyAI";
import { splitArmySlime, shouldSplitSlime, updateSplitStress } from "./slimeSplit";
import { updateRoutingState } from "./routing";
import { distance } from "./vector";
import type { ArmySlime } from "./types";

export class BattleSimulation {
  readonly state: BattleState;
  readonly bounds = { width: 1000, height: 650 };

  constructor() {
    const player = createArmySlime("azure-tide", "player", { x: 300, y: 325 }, { x: 1, y: 0 });
    const enemy = createArmySlime("crimson-mire", "enemy", { x: 700, y: 325 }, { x: -1, y: 0 });
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
    if (this.state.paused) return;
    const isResolved = Boolean(this.state.winner);
    if (
      isResolved &&
      this.state.winnerAt !== undefined &&
      this.state.elapsed - this.state.winnerAt > 6
    ) {
      return;
    }
    const dt =
      Math.min(rawDt, 0.033) *
      this.state.speed *
      (isResolved ? 0.32 : 1);
    this.state.elapsed += dt;
    const players = this.state.playerSlimes;
    const enemies = this.state.enemySlimes;

    if (!isResolved) {
      for (const player of players) {
        const enemy = this.nearest(player, enemies);
        if (enemy) updateRoutingState(player, enemy, this.state.elapsed);
      }
      for (const enemy of enemies) {
        const player = this.nearest(enemy, players);
        if (player) updateRoutingState(enemy, player, this.state.elapsed);
      }

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
    }

    for (const player of players) {
      const enemy = this.nearest(player, enemies);
      if (enemy) updateSlime(player, enemy, dt, this.bounds);
    }
    for (const enemy of enemies) {
      const player = this.nearest(enemy, players);
      if (player) updateSlime(enemy, player, dt, this.bounds);
    }

    if (!isResolved) {
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
    }
    this.state.player =
      this.state.playerSlimes.find((slime) => slime.isSelected) ??
      this.state.playerSlimes[0];
    this.state.enemy = this.nearest(this.state.player, this.state.enemySlimes) ?? this.state.enemySlimes[0];

    if (!isResolved) {
      const playerAlive = this.sideCanStillFight(this.state.playerSlimes);
      const enemyAlive = this.sideCanStillFight(this.state.enemySlimes);
      if (!playerAlive && !enemyAlive) this.finishBattle("draw");
      else if (!playerAlive) this.finishBattle("enemy");
      else if (!enemyAlive) this.finishBattle("player");
    }
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

  private sideCanStillFight(slimes: ArmySlime[]): boolean {
    return slimes.some((slime) => {
      const routedTooLong =
        slime.isRouting && this.state.elapsed - slime.routedAt >= 8;
      return slime.morale > 3 && !routedTooLong;
    });
  }

  private finishBattle(winner: BattleState["winner"]): void {
    if (this.state.winner) return;
    this.state.winner = winner;
    this.state.winnerAt = this.state.elapsed;
  }
}
