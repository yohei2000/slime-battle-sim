import type { BattleState } from "./types";
import { createArmySlime } from "./slime";
import { updateOrder } from "./slimeOrders";
import { updateSlime } from "./slimePhysics";
import { resolveCombat } from "./slimeCombat";
import { updateEncirclement } from "./encirclement";
import { updateEnemyAI } from "./enemyAI";

export class BattleSimulation {
  readonly state: BattleState;
  readonly bounds = { width: 1400, height: 900 };

  constructor() {
    this.state = {
      player: createArmySlime("azure-tide", "player", { x: 390, y: 450 }, { x: 1, y: 0 }),
      enemy: createArmySlime("crimson-mire", "enemy", { x: 1010, y: 450 }, { x: -1, y: 0 }),
      elapsed: 0,
      speed: 1,
      paused: false,
    };
  }

  update(rawDt: number): void {
    if (this.state.paused || this.state.winner) return;
    const dt = Math.min(rawDt, 0.033) * this.state.speed;
    this.state.elapsed += dt;
    const { player, enemy } = this.state;

    updateOrder(player, this.state.elapsed);
    updateOrder(enemy, this.state.elapsed);
    updateEnemyAI(enemy, player, this.state.elapsed);

    resolveCombat(player, enemy, dt);
    resolveCombat(enemy, player, dt);
    updateSlime(player, enemy, dt, this.bounds);
    updateSlime(enemy, player, dt, this.bounds);
    updateEncirclement(player, enemy, dt);
    updateEncirclement(enemy, player, dt);

    if (player.morale <= 3 || player.cohesion <= 2) this.state.winner = "enemy";
    if (enemy.morale <= 3 || enemy.cohesion <= 2) this.state.winner = "player";
  }

  cycleSpeed(): void {
    this.state.speed = this.state.speed === 1 ? 1.5 : this.state.speed === 1.5 ? 0.5 : 1;
  }
}
