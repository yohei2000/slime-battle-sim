import Phaser from "phaser";
import type { BattleState } from "../sim/types";
import { postureLabel } from "../sim/slime";
import { encirclementStage, ringIntegrity } from "../sim/encirclement";

type HudActions = {
  togglePause: () => void;
  cycleSpeed: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  setUiCapture: (value: boolean) => void;
};

type Button = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class MobileHUD {
  private readonly topPanel: Phaser.GameObjects.Rectangle;
  private readonly bottomPanel: Phaser.GameObjects.Rectangle;
  private readonly playerStats: Phaser.GameObjects.Text;
  private readonly enemyStats: Phaser.GameObjects.Text;
  private readonly tacticalStats: Phaser.GameObjects.Text;
  private readonly warningText: Phaser.GameObjects.Text;
  private readonly pauseButton: Button;
  private readonly speedButton: Button;
  private readonly cameraButtons: Button[] = [];
  private readonly allObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: BattleState,
    private readonly actions: HudActions,
  ) {
    this.topPanel = scene.add.rectangle(0, 0, 10, 88, 0x07131d, 0.88).setOrigin(0).setScrollFactor(0).setDepth(100);
    this.bottomPanel = scene.add.rectangle(0, 0, 10, 118, 0x07131d, 0.92).setOrigin(0).setScrollFactor(0).setDepth(100);
    this.playerStats = this.text("#7cecff", "left");
    this.enemyStats = this.text("#ff91aa", "right").setOrigin(1, 0);
    this.tacticalStats = this.text("#eefaff", "left");
    this.warningText = this.text("#ffd166", "right").setOrigin(1, 0);
    this.pauseButton = this.button("Ⅱ", actions.togglePause);
    this.speedButton = this.button("×1", actions.cycleSpeed);
    this.cameraButtons = [
      this.button("+", actions.zoomIn, 42),
      this.button("−", actions.zoomOut, 42),
      this.button("全", actions.fitAll, 42),
    ];
    this.allObjects.push(
      this.topPanel,
      this.bottomPanel,
      this.playerStats,
      this.enemyStats,
      this.tacticalStats,
      this.warningText,
    );
    scene.scale.on("resize", this.layout, this);
    this.layout({ width: scene.scale.width, height: scene.scale.height });
  }

  update(): void {
    const player =
      this.state.playerSlimes.find((slime) => slime.isSelected) ??
      this.state.player;
    const enemy = this.state.enemy;
    this.playerStats.setText(
      `自軍×${this.state.playerSlimes.length}  士気 ${player.morale.toFixed(0)}  結束 ${player.cohesion.toFixed(0)}\n` +
        `命令 ${player.activeOrder?.status === "transmitting" ? `${player.commandDelay.toFixed(1)}秒` : "即応"}`,
    );
    this.enemyStats.setText(
      `敵軍  士気 ${enemy.morale.toFixed(0)}  結束 ${enemy.cohesion.toFixed(0)}\n` +
        `${encirclementStage(enemy.encirclement)} ${(enemy.encirclement * 100).toFixed(0)}%`,
    );
    this.tacticalStats.setText(
      `姿勢 ${postureLabel(player.posture)}  密度 ${player.currentDensity.toFixed(2)}  幅 ${player.currentWidth.toFixed(0)}\n` +
        `疲労 ${player.fatigue.toFixed(0)}  圧力 ${player.pressure.toFixed(0)}  隙間 ${(player.gapRisk * 100).toFixed(0)}%  過密 ${(player.crowding * 100).toFixed(0)}%\n` +
        `向き ${Math.round((Math.atan2(player.facing.y, player.facing.x) * 180) / Math.PI)}°  翼 L${player.desiredLeftWingAdvance.toFixed(0)} / R${player.desiredRightWingAdvance.toFixed(0)}\n` +
        `接続 ${(player.linkIntegrity * 100).toFixed(0)}%  応力 ${(player.peakLocalStress * 100).toFixed(0)} / 靱性 ${(player.effectiveToughness * 100).toFixed(0)}\n` +
        `亀裂 ${(player.splitStress * 100).toFixed(0)}%  包囲力 ${(player.envelopPower * 100).toFixed(0)}  突破力 ${(player.breakthroughPower * 100).toFixed(0)}`,
    );
    const warnings: string[] = [];
    if (player.gapRisk > 0.45) warnings.push("戦線の隙間");
    if (player.crowding > 0.18) warnings.push("過密継続");
    if (player.isEncircling && ringIntegrity(player) < 0.46) warnings.push("包囲線が薄い");
    if (player.isEncircled) warnings.push("包囲されています");
    if (player.activeOrder?.status === "transmitting") warnings.push("命令伝達中");
    if (player.isRouting) warnings.push("士気崩壊：敗走中");
    if (player.peakLocalStress > player.effectiveToughness)
      warnings.push("局所応力が靱性を超過");
    if (player.splitStress > 0.45) warnings.push("亀裂が連結しています");
    this.warningText.setText(warnings.length ? `⚠ ${warnings.join("\n⚠ ")}` : "形状は安定");
    this.pauseButton.label.setText(this.state.paused ? "▶" : "Ⅱ");
    this.speedButton.label.setText(`×${this.state.speed}`);
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return this.allObjects;
  }

  private text(color: string, align: "left" | "right"): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, "", {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: "14px",
        color,
        align,
        lineSpacing: 3,
        stroke: "#07131d",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(102);
  }

  private button(label: string, action: () => void, size = 48): Button {
    const background = this.scene.add
      .rectangle(0, 0, size, size, 0x163242, 0.96)
      .setStrokeStyle(2, 0x7cecff, 0.68)
      .setScrollFactor(0)
      .setDepth(104)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(0, 0, label, {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: size < 45 ? "17px" : "19px",
        color: "#eafaff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(105);
    background.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.actions.setUiCapture(true);
      background.setFillStyle(0x28566f, 1);
    });
    background.on("pointerup", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      action();
      this.actions.setUiCapture(false);
      background.setFillStyle(0x163242, 0.96);
    });
    background.on("pointerout", () => {
      this.actions.setUiCapture(false);
      background.setFillStyle(0x163242, 0.96);
    });
    this.allObjects.push(background, text);
    return { background, label: text };
  }

  private positionButton(button: Button, x: number, y: number): void {
    button.background.setPosition(x, y);
    button.label.setPosition(x, y);
  }

  private layout(gameSize: { width: number; height: number }): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const topHeight = width < 600 ? 92 : 74;
    const bottomHeight = width < 600 ? 126 : 104;
    this.topPanel.setSize(width, topHeight);
    this.bottomPanel.setPosition(0, height - bottomHeight).setSize(width, bottomHeight);
    this.playerStats.setPosition(12, 9).setFontSize(width < 460 ? 12 : 14);
    this.enemyStats.setPosition(width - 12, 9).setFontSize(width < 460 ? 12 : 14);
    this.positionButton(this.pauseButton, width * 0.5 - 29, 31);
    this.positionButton(this.speedButton, width * 0.5 + 29, 31);
    this.tacticalStats
      .setPosition(width < 600 ? 12 : 124, height - bottomHeight + 10)
      .setFontSize(width < 460 ? 11 : 13);
    this.warningText
      .setPosition(width - 12, height - bottomHeight + 12)
      .setFontSize(width < 460 ? 10 : 12);
    const cameraY = height - bottomHeight - 28;
    this.cameraButtons.forEach((button, index) => this.positionButton(button, 28 + index * 48, cameraY));
  }

  destroy(): void {
    this.scene.scale.off("resize", this.layout, this);
    this.allObjects.forEach((object) => object.destroy());
  }
}
