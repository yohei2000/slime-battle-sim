import Phaser from "phaser";
import type { ArmySlime, GesturePreviewState, Vector2Like } from "../sim/types";
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
      this.drawArrow(this.state.start, this.state.end, 0x93f1ff, 10);
      this.showLabel(
        this.state.end.x,
        this.state.end.y - 20,
        "軍勢を流す\n命令伝達後に全体移動",
      );
      return;
    }

    if (!this.state.center || !this.state.width || !this.state.depth) return;
    const color = this.colorForMode();
    const direction = normalize(this.state.direction ?? slime.facing);
    this.drawGhostShape(
      this.state.center,
      direction,
      this.state.width,
      this.state.depth,
      this.state.leftWingAdvance ?? 0,
      this.state.rightWingAdvance ?? 0,
      color,
    );

    if (
      (this.state.mode === "breakthrough" ||
        this.state.mode === "envelop-advance") &&
      this.state.end
    ) {
      const advanceDirection = normalize(
        sub(this.state.end, this.state.start ?? slime.center),
      );
      this.drawArrow(
        slime.center,
        add(slime.center, scale(advanceDirection, 145)),
        color,
        this.state.mode === "breakthrough" ? 14 : 9,
      );
    }

    if (this.state.mode === "rotate") {
      this.drawRotation(slime, direction, color);
    }

    if (
      this.state.mode === "left-wing" ||
      this.state.mode === "right-wing"
    ) {
      const lateral = perpendicular(direction);
      const side = this.state.mode === "left-wing" ? 1 : -1;
      const wingStart = add(
        slime.center,
        scale(lateral, side * slime.currentWidth * 0.42),
      );
      this.drawArrow(
        wingStart,
        add(wingStart, scale(direction, 110)),
        color,
        9,
      );
    }

    this.showLabel(
      this.state.center.x,
      this.state.center.y - this.state.width * 0.55,
      this.copyForMode(this.state.mode),
    );
  }

  private drawGhostShape(
    center: Vector2Like,
    direction: Vector2Like,
    width: number,
    depth: number,
    leftWingAdvance: number,
    rightWingAdvance: number,
    color: number,
  ): void {
    const lateral = perpendicular(direction);
    const points: Vector2Like[] = [];
    const segments = 32;
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const sideAmount = Math.sin(angle);
      const leftWeight = Math.max(0, sideAmount);
      const rightWeight = Math.max(0, -sideAmount);
      const frontBias = 0.35 + Math.max(0, Math.cos(angle)) * 0.65;
      const forward =
        Math.cos(angle) * depth * 0.5 +
        (leftWingAdvance * leftWeight + rightWingAdvance * rightWeight) *
          frontBias;
      const sideways = sideAmount * width * 0.5;
      points.push(
        add(
          center,
          add(scale(direction, forward), scale(lateral, sideways)),
        ),
      );
    }

    this.graphics.lineStyle(4, color, 0.84);
    this.graphics.fillStyle(color, 0.06);
    this.graphics.beginPath();
    this.graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      this.graphics.lineTo(points[i].x, points[i].y);
    }
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();
  }

  private drawRotation(
    slime: ArmySlime,
    direction: Vector2Like,
    color: number,
  ): void {
    const radius = Math.max(75, slime.currentWidth * 0.34);
    const startAngle = Math.atan2(slime.facing.y, slime.facing.x);
    const endAngle = Math.atan2(direction.y, direction.x);
    this.graphics.lineStyle(7, color, 0.82);
    this.graphics.beginPath();
    this.graphics.arc(
      slime.center.x,
      slime.center.y,
      radius,
      startAngle,
      endAngle,
      (this.state.rotation ?? 0) < 0,
    );
    this.graphics.strokePath();
    this.drawArrow(
      add(slime.center, scale(direction, radius - 18)),
      add(slime.center, scale(direction, radius + 18)),
      color,
      7,
    );
  }

  private drawArrow(
    start: Vector2Like,
    end: Vector2Like,
    color: number,
    thickness: number,
  ): void {
    const direction = normalize(sub(end, start));
    const side = perpendicular(direction);
    this.graphics.lineStyle(thickness, color, 0.82);
    this.graphics.beginPath();
    this.graphics.moveTo(start.x, start.y);
    this.graphics.lineTo(end.x, end.y);
    this.graphics.strokePath();
    this.graphics.fillStyle(color, 0.92);
    this.graphics.fillTriangle(
      end.x,
      end.y,
      end.x - direction.x * 24 + side.x * 15,
      end.y - direction.y * 24 + side.y * 15,
      end.x - direction.x * 24 - side.x * 15,
      end.y - direction.y * 24 - side.y * 15,
    );
  }

  private colorForMode(): number {
    if (this.state.mode === "breakthrough") return 0xffd166;
    if (this.state.mode === "contract") return 0xffa94d;
    if (this.state.mode === "rotate") return 0xc4a7ff;
    if (
      this.state.mode === "left-wing" ||
      this.state.mode === "right-wing"
    )
      return 0x76f2b5;
    return 0x7cecff;
  }

  private copyForMode(mode: GesturePreviewState["mode"]): string {
    if (mode === "breakthrough")
      return `突破\n成功見込み：${this.state.confidence ?? "中"} / 失敗リスク：高`;
    if (mode === "envelop-advance")
      return "包囲前進\n幅を広げながら両翼で前進";
    if (mode === "rotate")
      return `戦線回転\n向き ${Math.round(((this.state.rotation ?? 0) * 180) / Math.PI)}°`;
    if (mode === "left-wing")
      return "左翼前進\n左翼の接触面を先行";
    if (mode === "right-wing")
      return "右翼前進\n右翼の接触面を先行";
    if (mode === "contract")
      return "密集中\n突破力 +++ / 包囲・過密リスク +";
    if (mode === "envelop")
      return "包囲姿勢\n包囲力 +++ / 中央突破リスク +";
    return "展開中\n包囲力 +++ / 局所密度 -- / 突破リスク +";
  }

  private showLabel(x: number, y: number, text: string): void {
    this.label.setPosition(x, y).setText(text).setVisible(true);
  }
}
