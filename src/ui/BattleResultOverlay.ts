import Phaser from "phaser";
import {
  battleOutcomeColor,
  battleOutcomeMessage,
  battleOutcomeTitle,
  type BattleResultPayload,
} from "../game/battleResult";

type VisibleGameObject = Phaser.GameObjects.GameObject & {
  setVisible(value: boolean): Phaser.GameObjects.GameObject;
};

export class BattleResultOverlay {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly accent: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.Rectangle;
  private readonly buttonLabel: Phaser.GameObjects.Text;
  private readonly allObjects: VisibleGameObject[];
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onContinue: () => void,
  ) {
    this.backdrop = scene.add
      .rectangle(0, 0, 10, 10, 0x02080d, 0.72)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(230)
      .setInteractive();
    this.panel = scene.add
      .rectangle(0, 0, 10, 10, 0x07131d, 0.96)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(231)
      .setStrokeStyle(2, 0x7cecff, 0.72);
    this.accent = scene.add
      .rectangle(0, 0, 10, 4, 0x7cecff, 0.95)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(232);
    this.title = this.text("", 38, "#eafaff", 900, 233).setOrigin(0.5, 0);
    this.body = this.text("", 15, "#d8f4ff", 500, 233);
    this.hint = this.text("", 13, "#ffd166", 700, 233).setOrigin(0.5, 0);
    this.button = scene.add
      .rectangle(0, 0, 10, 44, 0x163242, 0.98)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(233)
      .setStrokeStyle(2, 0x7cecff, 0.86)
      .setInteractive({ useHandCursor: true });
    this.buttonLabel = this.text("戦略画面へ戻る", 15, "#eafaff", 800, 234).setOrigin(0.5);

    this.button.on("pointerdown", () => this.button.setFillStyle(0x28566f, 1));
    this.button.on("pointerout", () => this.button.setFillStyle(0x163242, 0.98));
    this.button.on("pointerup", () => {
      this.button.setFillStyle(0x163242, 0.98);
      this.onContinue();
    });
    this.backdrop.on("pointerup", () => this.onContinue());

    this.allObjects = [
      this.backdrop,
      this.panel,
      this.accent,
      this.title,
      this.body,
      this.hint,
      this.button,
      this.buttonLabel,
    ];
    this.scene.scale.on("resize", this.layout, this);
    this.layout();
    this.hide();
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return this.allObjects;
  }

  show(result: BattleResultPayload): void {
    this.visible = true;
    const accentColor = battleOutcomeColor(result.outcome);
    const title = battleOutcomeTitle(result.outcome);
    this.title.setText(title).setColor(`#${accentColor.toString(16).padStart(6, "0")}`);
    this.panel.setStrokeStyle(2, accentColor, 0.82);
    this.accent.setFillStyle(accentColor, 0.95);
    this.body.setText(
      `${battleOutcomeMessage(result.outcome)}\n\n` +
        `戦闘時間 ${Math.round(result.elapsedSeconds)}秒\n` +
        `自軍 士気 ${Math.round(result.playerMorale)} / スライム ${result.playerSlimeCount}\n` +
        `敵軍 士気 ${Math.round(result.enemyMorale)} / スライム ${result.enemySlimeCount}`,
    );
    this.setCountdown(4);
    this.allObjects.forEach((object) => object.setVisible(true));
    this.layout();
  }

  setCountdown(seconds: number): void {
    if (!this.visible) return;
    this.hint.setText(`${Math.max(0, Math.ceil(seconds))}秒後に戦略画面へ戻ります / タップで戻る`);
  }

  hide(): void {
    this.visible = false;
    this.allObjects.forEach((object) => object.setVisible(false));
  }

  destroy(): void {
    this.scene.scale.off("resize", this.layout, this);
    this.allObjects.forEach((object) => object.destroy());
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const panelWidth = Math.min(width - 32, 430);
    const panelHeight = Math.min(height - 96, 330);
    const x = (width - panelWidth) / 2;
    const y = (height - panelHeight) / 2;

    this.backdrop.setPosition(0, 0).setSize(width, height);
    this.panel.setPosition(x, y).setSize(panelWidth, panelHeight);
    this.accent.setPosition(x, y).setSize(panelWidth, 5);
    this.title.setPosition(width / 2, y + 28);
    this.body
      .setPosition(x + 24, y + 92)
      .setWordWrapWidth(panelWidth - 48, true)
      .setLineSpacing(6);
    this.hint.setPosition(width / 2, y + panelHeight - 92);
    this.button.setPosition(x + 42, y + panelHeight - 62).setSize(panelWidth - 84, 44);
    this.buttonLabel.setPosition(width / 2, y + panelHeight - 40);
  }

  private text(
    value: string,
    size: number,
    color: string,
    weight: number,
    depth: number,
  ): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, value, {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: `${size}px`,
        color,
        fontStyle: weight >= 700 ? "bold" : "normal",
        lineSpacing: 4,
        align: "center",
      })
      .setScrollFactor(0)
      .setDepth(depth)
      .setShadow(0, 2, "#001018", 5, true, true);
  }
}
