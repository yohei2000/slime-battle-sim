import Phaser from "phaser";
import type { ArmySlime, GesturePreviewState } from "../sim/types";
import { add, normalize, perpendicular, scale, sub } from "../sim/vector";

export class GesturePreview {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private state: GesturePreviewState = { active: false, mode: "none" };

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(20);
    this.label = scene.add
      .text(0, 0, "", {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: "17px",
        color: "#ffffff",
        backgroundColor: "#07131ddd",
        padding: { x: 10, y: 7 },
        stroke: "#07131d",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(21)
      .setVisible(false);
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [this.graphics, this.label];
  }

  setState(state: GesturePreviewState): void {
    this.state = state;
  }

  draw(slime: ArmySlime): void {
    this.graphics.clear();
    this.label.setVisible(false);
    if (!this.state.active) return;

    if (this.state.mode === "drag" && this.state.start && this.state.end) {
      const direction = normalize(sub(this.state.end, this.state.start));
      const side = perpendicular(direction);
      this.graphics.lineStyle(10, 0x93f1ff, 0.78);
      this.graphics.beginPath();
      this.graphics.moveTo(this.state.start.x, this.state.start.y);
      this.graphics.lineTo(this.state.end.x, this.state.end.y);
      this.graphics.strokePath();
      this.graphics.fillStyle(0xc7f8ff, 0.9);
      this.graphics.fillTriangle(
        this.state.end.x,
        this.state.end.y,
        this.state.end.x - direction.x * 28 + side.x * 18,
        this.state.end.y - direction.y * 28 + side.y * 18,
        this.state.end.x - direction.x * 28 - side.x * 18,
        this.state.end.y - direction.y * 28 - side.y * 18,
      );
      this.showLabel(this.state.end.x, this.state.end.y - 20, "軍勢を流す\n命令伝達後に全体移動");
      return;
    }

    if (this.state.center && this.state.width && this.state.depth) {
      const color =
        this.state.mode === "breakthrough"
          ? 0xffd166
          : this.state.mode === "contract"
            ? 0xffa94d
            : 0x7cecff;
      this.graphics.lineStyle(4, color, 0.82);
      this.graphics.fillStyle(color, 0.055);
      this.graphics.fillEllipse(
        this.state.center.x,
        this.state.center.y,
        this.state.depth,
        this.state.width,
      );
      this.graphics.strokeEllipse(
        this.state.center.x,
        this.state.center.y,
        this.state.depth,
        this.state.width,
      );
      if (this.state.mode === "breakthrough" && this.state.end) {
        const direction = normalize(sub(this.state.end, this.state.start ?? slime.center));
        const end = add(slime.center, scale(direction, 135));
        this.graphics.lineStyle(14, 0xffd166, 0.86);
        this.graphics.lineBetween(slime.center.x, slime.center.y, end.x, end.y);
      }
      this.showLabel(
        this.state.center.x,
        this.state.center.y - this.state.width * 0.52,
        this.copyForMode(this.state.mode),
      );
    }
  }

  private copyForMode(mode: GesturePreviewState["mode"]): string {
    if (mode === "breakthrough")
      return `突破命令\n成功見込み：${this.state.confidence ?? "中"} / 失敗時リスク：高`;
    if (mode === "contract") return "密集中\n突破力 +++ / 包囲・過密リスク +";
    if (mode === "envelop") return "包囲姿勢\n包囲力 +++ / 中央突破リスク +";
    return "展開中\n包囲力 +++ / 局所密度 -- / 突破リスク +";
  }

  private showLabel(x: number, y: number, text: string): void {
    this.label.setPosition(x, y).setText(text).setVisible(true);
  }
}
