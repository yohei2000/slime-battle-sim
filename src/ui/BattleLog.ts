import Phaser from "phaser";

export class BattleLog {
  private readonly text: Phaser.GameObjects.Text;
  private readonly entries: string[] = [];

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(12, 98, "", {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: "12px",
        color: "#bed5df",
        backgroundColor: "#07131d88",
        padding: { x: 7, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(90);
  }

  push(message: string): void {
    this.entries.unshift(message);
    this.entries.length = Math.min(this.entries.length, 3);
    this.text.setText(this.entries.join("\n"));
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
