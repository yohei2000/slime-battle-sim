import Phaser from "phaser";
import type { ArmySlime, GesturePreviewState, Vector2Like } from "../sim/types";
import { add, clamp, normalize, perpendicular, scale, sub } from "../sim/vector";

export class GesturePreview {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private state: GesturePreviewState = { active: false, mode: "none" };

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(20);
    this.label = scene.add
      .text(0, 0, "", {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        backgroundColor: "#07131df2",
        padding: { x: 14, y: 10 },
        stroke: "#07131d",
        strokeThickness: 4,
        lineSpacing: 6,
        wordWrap: { width: 210, useAdvancedWrap: true },
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(120)
      .setVisible(false);
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [this.graphics];
  }

  uiObjects(): Phaser.GameObjects.GameObject[] {
    return [this.label];
  }

  setState(state: GesturePreviewState): void {
    this.state = state;
  }

  draw(slime: ArmySlime): void {
    this.graphics.clear();
    this.label.setVisible(false);
    if (!this.state.active) return;

    if (this.state.mode === "drag" && this.state.start && this.state.end) {
      const color =
        this.state.focusMode === "breakthrough"
          ? 0xffd166
          : this.state.focusMode === "envelop"
            ? 0x7cecff
            : 0x93f1ff;
      this.drawArrow(
        this.state.start,
        this.state.targetPoint ?? this.state.end,
        color,
        this.state.focusMode === "breakthrough" ? 13 : 10,
      );
      if (this.state.targetPoint) {
        this.drawTargetMarker(this.state.targetPoint, color, this.state.focusMode);
      }
      this.showLabelNearWorld(
        this.state.targetPoint ?? this.state.end,
        this.state.focusMode
          ? this.copyForFocus(this.state.focusMode)
          : "移動",
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
    if (this.state.targetPoint) {
      this.drawArrow(
        slime.center,
        this.state.targetPoint,
        color,
        this.state.focusMode === "breakthrough" ? 9 : 6,
      );
      this.drawTargetMarker(this.state.targetPoint, color, this.state.focusMode);
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

    this.showLabelNearWorld(
      this.state.targetPoint ??
        {
          x: this.state.center.x,
          y: this.state.center.y - this.state.width * 0.42,
        },
      this.state.focusMode
        ? this.copyForFocus(this.state.focusMode)
        : this.copyForMode(this.state.mode),
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

  private drawTargetMarker(
    point: Vector2Like,
    color: number,
    mode?: "breakthrough" | "envelop",
  ): void {
    const radius = mode === "breakthrough" ? 22 : 26;
    this.graphics.lineStyle(3, color, 0.9);
    this.graphics.strokeCircle(point.x, point.y, radius);
    this.graphics.lineStyle(2, 0xffffff, 0.82);
    this.graphics.beginPath();
    this.graphics.moveTo(point.x - radius * 0.7, point.y);
    this.graphics.lineTo(point.x + radius * 0.7, point.y);
    this.graphics.moveTo(point.x, point.y - radius * 0.7);
    this.graphics.lineTo(point.x, point.y + radius * 0.7);
    this.graphics.strokePath();
    if (mode === "envelop") {
      this.graphics.lineStyle(4, color, 0.58);
      this.graphics.beginPath();
      this.graphics.arc(point.x, point.y, radius + 9, -0.85, 0.85, false);
      this.graphics.arc(point.x, point.y, radius + 9, Math.PI - 0.85, Math.PI + 0.85, false);
      this.graphics.strokePath();
    }
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
      return `突破\n成功 ${this.state.confidence ?? "中"}`;
    if (mode === "envelop-advance")
      return "包囲前進";
    if (mode === "rotate")
      return `戦線回転\n${Math.round(((this.state.rotation ?? 0) * 180) / Math.PI)}°`;
    if (mode === "left-wing")
      return "左翼前進";
    if (mode === "right-wing")
      return "右翼前進";
    if (mode === "contract")
      return "密集\n突破+";
    if (mode === "envelop")
      return "包囲\n両翼+";
    return "展開\n包囲+";
  }

  private copyForFocus(mode: "breakthrough" | "envelop"): string {
    if (mode === "breakthrough") {
      return "ここを貫く\n突破";
    }
    return "ここを包む\n包囲";
  }

  private showLabelNearWorld(anchor: Vector2Like, text: string): void {
    const camera = this.scene.cameras.main;
    const viewportWidth = camera.width;
    const viewportHeight = camera.height;
    const screen = {
      x: (anchor.x - camera.worldView.x) * camera.zoom,
      y: (anchor.y - camera.worldView.y) * camera.zoom,
    };
    const placeRight = screen.x < viewportWidth * 0.58;
    const placeAbove = screen.y > viewportHeight * 0.34;
    const x = clamp(
      screen.x + (placeRight ? 78 : -78),
      18,
      viewportWidth - 18,
    );
    const y = clamp(
      screen.y + (placeAbove ? -96 : 96),
      72,
      viewportHeight - 150,
    );
    this.label
      .setOrigin(placeRight ? 0 : 1, placeAbove ? 1 : 0)
      .setPosition(x, y)
      .setText(text)
      .setVisible(true);
  }
}
