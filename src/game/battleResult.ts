import type { BattleState } from "../sim/types";

export type BattleOutcome = NonNullable<BattleState["winner"]>;

export type BattleResultPayload = {
  outcome: BattleOutcome;
  elapsedSeconds: number;
  playerMorale: number;
  enemyMorale: number;
  playerSlimeCount: number;
  enemySlimeCount: number;
  finishedAt: number;
};

export function battleOutcomeTitle(outcome: BattleOutcome): string {
  if (outcome === "player") return "勝利";
  if (outcome === "enemy") return "敗北";
  return "痛み分け";
}

export function battleOutcomeMessage(outcome: BattleOutcome): string {
  if (outcome === "player") {
    return "敵軍が崩れました。戦果を戦略画面へ持ち帰ります。";
  }
  if (outcome === "enemy") {
    return "自軍が崩れました。残存戦力を戦略画面で立て直します。";
  }
  return "両軍とも戦闘継続能力を失いました。戦略画面へ戻ります。";
}

export function battleOutcomeColor(outcome: BattleOutcome): number {
  if (outcome === "player") return 0x7cecff;
  if (outcome === "enemy") return 0xff91aa;
  return 0xffd166;
}

export function battleResultReport(result: BattleResultPayload): string {
  return (
    `戦闘結果: ${battleOutcomeTitle(result.outcome)} ` +
    `自軍士気${Math.round(result.playerMorale)} ` +
    `敵軍士気${Math.round(result.enemyMorale)} ` +
    `時間${Math.round(result.elapsedSeconds)}秒`
  );
}
