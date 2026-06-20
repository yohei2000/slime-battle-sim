import Phaser from "phaser";
import type { ArmySlime, SlimeNode, Vector2Like } from "../sim/types";
import { getBoundaryNodes } from "../sim/slime";
import { add, normalize, perpendicular, scale } from "../sim/vector";

const COLORS = {
  player: { fill: 0x28bde9, edge: 0x9ceeff, particle: 0xd9faff, zoc: 0x2dd4ef },
  enemy: { fill: 0xef496f, edge: 0xffa2b7, particle: 0xffd9e1, zoc: 0xfb7185 },
};

function smoothClosed(points: Vector2Like[], passes = 2): Vector2Like[] {
  let result = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Vector2Like[] = [];
    for (let i = 0; i < result.length; i += 1) {
      const a = result[i];
      const b = result[(i + 1) % result.length];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    result = next;
  }
  return result;
}

function drawPolygon(graphics: Phaser.GameObjects.Graphics, points: Vector2Like[]): void {
  if (points.length < 3) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) graphics.lineTo(points[i].x, points[i].y);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

export class SlimeOverlay {
  private readonly zocGraphics: Phaser.GameObjects.Graphics;
  private readonly bodyGraphics: Phaser.GameObjects.Graphics;
  private readonly particleGraphics: Phaser.GameObjects.Graphics;
  private readonly effectGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.zocGraphics = scene.add.graphics().setDepth(2);
    this.bodyGraphics = scene.add.graphics().setDepth(4);
    this.particleGraphics = scene.add.graphics().setDepth(5);
    this.effectGraphics = scene.add.graphics().setDepth(6);
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [this.zocGraphics, this.bodyGraphics, this.particleGraphics, this.effectGraphics];
  }

  draw(slimes: ArmySlime[], time: number): void {
    this.zocGraphics.clear();
    this.bodyGraphics.clear();
    this.particleGraphics.clear();
    this.effectGraphics.clear();
    for (const slime of slimes) this.drawSlime(slime, time);
  }

  private drawSlime(slime: ArmySlime, time: number): void {
    const color = COLORS[slime.side];
    const boundary = getBoundaryNodes(slime);
    const rawPoints = boundary.map((node, index) => this.tensionPoint(slime, node, index, time));
    const points = smoothClosed(rawPoints);
    const zocPoints = smoothClosed(
      rawPoints.map((point) => {
        const radial = normalize({ x: point.x - slime.center.x, y: point.y - slime.center.y });
        return add(point, scale(radial, slime.zocRadius));
      }),
    );

    this.zocGraphics.fillStyle(color.zoc, 0.055);
    this.zocGraphics.lineStyle(1.5, color.zoc, 0.2);
    drawPolygon(this.zocGraphics, zocPoints);

    this.bodyGraphics.fillStyle(color.fill, 0.2 + Math.min(0.24, slime.currentDensity * 0.1));
    this.bodyGraphics.lineStyle(slime.isSelected ? 5 : 3, color.edge, slime.isSelected ? 0.98 : 0.75);
    drawPolygon(this.bodyGraphics, points);

    const coreRadius = 24 + slime.currentDensity * 8;
    this.bodyGraphics.fillStyle(color.fill, 0.22);
    this.bodyGraphics.fillCircle(slime.center.x, slime.center.y, coreRadius);

    for (const particle of slime.particles) {
      if (!particle.alive) continue;
      const pulse = 1 + Math.sin(time * 0.003 + particle.phase) * 0.25;
      this.particleGraphics.fillStyle(color.particle, 0.38 + slime.currentDensity * 0.16);
      this.particleGraphics.fillCircle(particle.position.x, particle.position.y, 1.4 * pulse + slime.currentDensity * 0.45);
    }

    this.drawFacing(slime, color.edge);
    this.drawWarnings(slime, boundary, time);
    this.drawContacts(slime, color.edge);
  }

  private tensionPoint(slime: ArmySlime, node: SlimeNode, index: number, time: number): Vector2Like {
    if (slime.tension < 0.28) return node.position;
    const normal = normalize({ x: node.position.x - slime.center.x, y: node.position.y - slime.center.y });
    const shake = Math.sin(time * 0.018 + index * 2.7) * slime.tension * 4.2;
    return add(node.position, scale(normal, shake));
  }

  private drawFacing(slime: ArmySlime, color: number): void {
    const start = add(slime.center, scale(slime.facing, slime.currentDepth * 0.16));
    const end = add(start, scale(slime.facing, 50 + slime.breakthroughPower * 35));
    const side = perpendicular(slime.facing);
    this.effectGraphics.lineStyle(slime.posture === "breakthrough" ? 8 : 3, color, 0.72);
    this.effectGraphics.beginPath();
    this.effectGraphics.moveTo(start.x, start.y);
    this.effectGraphics.lineTo(end.x, end.y);
    this.effectGraphics.strokePath();
    this.effectGraphics.fillStyle(color, 0.8);
    this.effectGraphics.fillTriangle(
      end.x,
      end.y,
      end.x - slime.facing.x * 18 + side.x * 12,
      end.y - slime.facing.y * 18 + side.y * 12,
      end.x - slime.facing.x * 18 - side.x * 12,
      end.y - slime.facing.y * 18 - side.y * 12,
    );
  }

  private drawWarnings(slime: ArmySlime, nodes: SlimeNode[], time: number): void {
    if (slime.gapRisk > 0.38 && Math.sin(time * 0.009) > -0.2) {
      this.effectGraphics.lineStyle(5, 0xffd166, 0.85);
      nodes
        .filter((node) => node.role === "front" || node.role === "left" || node.role === "right")
        .forEach((node) => this.effectGraphics.strokeCircle(node.position.x, node.position.y, 12 + slime.gapRisk * 12));
    }
    if (slime.crowding > 0.18) {
      this.effectGraphics.fillStyle(0xff9f43, 0.08 + slime.crowding * 0.12);
      this.effectGraphics.fillCircle(slime.center.x, slime.center.y, 58 + slime.crowding * 30);
    }
    if (slime.splitStress > 0.18 || slime.brokenLinkRatio > 0) {
      const tangent = perpendicular(slime.facing);
      const crackLength = slime.currentDepth * 0.42;
      const segments = 7;
      this.effectGraphics.lineStyle(
        3 + slime.splitStress * 5,
        0xffd166,
        0.45 + slime.splitStress * 0.5,
      );
      this.effectGraphics.beginPath();
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments - 0.5;
        const point = add(
          slime.center,
          add(
            scale(slime.facing, t * crackLength * 2),
            scale(tangent, Math.sin(i * 2.3) * (4 + slime.splitStress * 12)),
          ),
        );
        if (i === 0) this.effectGraphics.moveTo(point.x, point.y);
        else this.effectGraphics.lineTo(point.x, point.y);
      }
      this.effectGraphics.strokePath();
    }
  }

  private drawContacts(slime: ArmySlime, color: number): void {
    for (const patch of slime.contactPatches) {
      const tangent = perpendicular(patch.normal);
      const half = patch.length * 0.32;
      const a = add(patch.center, scale(tangent, half));
      const b = add(patch.center, scale(tangent, -half));
      this.effectGraphics.lineStyle(4 + patch.pressure * 0.06, color, 0.88);
      this.effectGraphics.beginPath();
      this.effectGraphics.moveTo(a.x, a.y);
      this.effectGraphics.lineTo(b.x, b.y);
      this.effectGraphics.strokePath();
      this.effectGraphics.fillStyle(0xffffff, 0.12);
      this.effectGraphics.fillCircle(patch.center.x, patch.center.y, 8 + patch.pressure * 0.12);
    }
  }
}
