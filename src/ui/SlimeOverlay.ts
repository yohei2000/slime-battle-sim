import Phaser from "phaser";
import type { ArmySlime, SlimeNode, Vector2Like } from "../sim/types";
import { getBoundaryNodes } from "../sim/slime";
import {
  shortNodeName,
  stressCause,
  stressLinks,
  type StressLinkInfo,
} from "../sim/stressDiagnostics";
import {
  add,
  clamp,
  lerp,
  normalize,
  perpendicular,
  scale,
  sub,
} from "../sim/vector";
import { getZocBoundaryPoints } from "../sim/zoc";

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
  private readonly scene: Phaser.Scene;
  private readonly zocGraphics: Phaser.GameObjects.Graphics;
  private readonly bodyGraphics: Phaser.GameObjects.Graphics;
  private readonly particleGraphics: Phaser.GameObjects.Graphics;
  private readonly effectGraphics: Phaser.GameObjects.Graphics;
  private readonly labelLayer: Phaser.GameObjects.Container;
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly detailLabelLayer: Phaser.GameObjects.Container;
  private causeLabel?: Phaser.GameObjects.Text;
  private stressDetail = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.zocGraphics = scene.add.graphics().setDepth(2);
    this.bodyGraphics = scene.add.graphics().setDepth(4);
    this.particleGraphics = scene.add.graphics().setDepth(5);
    this.effectGraphics = scene.add.graphics().setDepth(6);
    this.labelLayer = scene.add.container(0, 0).setDepth(8);
    this.detailLabelLayer = scene.add.container(0, 0).setDepth(9);
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [
      this.zocGraphics,
      this.bodyGraphics,
      this.particleGraphics,
      this.effectGraphics,
      this.labelLayer,
      this.detailLabelLayer,
    ];
  }

  setStressDetail(enabled: boolean): void {
    this.stressDetail = enabled;
    this.detailLabelLayer.setVisible(enabled);
  }

  draw(slimes: ArmySlime[], time: number): void {
    this.zocGraphics.clear();
    this.bodyGraphics.clear();
    this.particleGraphics.clear();
    this.effectGraphics.clear();
    this.causeLabel?.setVisible(false);
    for (const slime of slimes) this.drawSlime(slime, time);
    this.updateLabels(slimes);
  }

  private drawSlime(slime: ArmySlime, time: number): void {
    const color = COLORS[slime.side];
    const boundary = getBoundaryNodes(slime);
    const rawPoints = boundary.map((node) => ({ ...node.position }));
    const points = smoothClosed(rawPoints);
    const zocPoints = getZocBoundaryPoints(slime);

    this.zocGraphics.fillStyle(color.zoc, 0.055);
    this.zocGraphics.lineStyle(1.5, color.zoc, 0.2);
    drawPolygon(this.zocGraphics, zocPoints);

    this.bodyGraphics.fillStyle(color.fill, 0.2 + Math.min(0.24, slime.currentDensity * 0.1));
    this.bodyGraphics.lineStyle(
      slime.isSelected ? 5 : 3,
      slime.isRouting ? 0xffd166 : color.edge,
      slime.isSelected ? 0.98 : 0.75,
    );
    drawPolygon(this.bodyGraphics, points);
    this.drawNodeDensity(slime, color.fill);
    this.drawStressNetwork(slime, time);

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

  private drawNodeDensity(slime: ArmySlime, fillColor: number): void {
    for (const node of slime.nodes) {
      const isCore = node.id.endsWith("-core");
      const isInterior = node.role === "interior";
      const radius =
        (isCore ? 21 : isInterior ? 15 : 10) *
        (0.82 + slime.currentDensity * 0.18);
      const pressureAlpha = clamp(node.localPressure / 160, 0, 0.16);
      const densityAlpha =
        (isCore ? 0.16 : isInterior ? 0.105 : 0.055) +
        slime.currentDensity * 0.035 +
        pressureAlpha;
      this.bodyGraphics.fillStyle(fillColor, densityAlpha);
      this.bodyGraphics.fillCircle(node.position.x, node.position.y, radius);
    }
  }

  private stressColor(loadRatio: number): number {
    if (loadRatio >= 1) return 0xff405d;
    if (loadRatio >= 0.7) return 0xff8c42;
    if (loadRatio >= 0.4) return 0xffd166;
    return 0x47d7c8;
  }

  private drawStressNetwork(slime: ArmySlime, time: number): void {
    const infos = stressLinks(slime);
    const visible = infos.filter(
      (info) =>
        info.nodeA &&
        info.nodeB &&
        !info.link.broken &&
        (this.stressDetail || slime.isSelected || info.loadRatio >= 0.7),
    );

    for (const info of visible) {
      const a = info.nodeA!.position;
      const b = info.nodeB!.position;
      const load = info.loadRatio;
      const color = this.stressColor(load);
      const pulse = load >= 1 ? 0.34 + Math.sin(time * 0.014) * 0.1 : 0.26;
      const alpha =
        slime.isSelected || this.stressDetail ? pulse : pulse * 0.68;
      const width = 0.65 + Math.min(2, load * 1.15);
      const segmentCount = 8;
      const damage = 1 - info.link.integrity;

      for (let i = 0; i < segmentCount; i += 1) {
        if (damage > 0.08 && i % Math.max(2, Math.round(5 - damage * 4)) === 1)
          continue;
        const start = lerp(a, b, i / segmentCount);
        const end = lerp(a, b, (i + 0.78) / segmentCount);
        this.effectGraphics.lineStyle(width, color, alpha);
        this.effectGraphics.lineBetween(start.x, start.y, end.x, end.y);
      }

      if (load >= 0.7) {
        const midpoint = lerp(a, b, 0.5);
        this.effectGraphics.fillStyle(
          color,
          0.025 + Math.min(0.07, load * 0.035),
        );
        this.effectGraphics.fillCircle(
          midpoint.x,
          midpoint.y,
          9 + Math.min(10, load * 5),
        );
        this.drawPressureArrow(slime, midpoint, color, load);
      }
    }

    for (const info of infos.filter((candidate) => candidate.link.broken)) {
      if (!info.nodeA || !info.nodeB) continue;
      const midpoint = lerp(info.nodeA.position, info.nodeB.position, 0.5);
      const aEnd = lerp(info.nodeA.position, midpoint, 0.72);
      const bEnd = lerp(info.nodeB.position, midpoint, 0.72);
      this.effectGraphics.lineStyle(2.2, 0xff405d, 0.7);
      this.effectGraphics.lineBetween(
        info.nodeA.position.x,
        info.nodeA.position.y,
        aEnd.x,
        aEnd.y,
      );
      this.effectGraphics.lineBetween(
        info.nodeB.position.x,
        info.nodeB.position.y,
        bEnd.x,
        bEnd.y,
      );
      this.effectGraphics.fillStyle(0x07131d, 0.95);
      this.effectGraphics.fillCircle(midpoint.x, midpoint.y, 3.5);
    }

    const critical = infos[0];
    if (
      critical?.nodeA &&
      critical.nodeB &&
      critical.loadRatio >= 0.7 &&
      slime.splitStress < 0.18
    ) {
      this.drawPredictedFracture(slime, critical, time);
    }
    if (this.stressDetail && slime.isSelected) {
      this.drawDetailedStressLabels(slime, infos);
    }
  }

  private drawPressureArrow(
    slime: ArmySlime,
    midpoint: Vector2Like,
    color: number,
    loadRatio: number,
  ): void {
    const patch = slime.contactPatches.reduce<
      ArmySlime["contactPatches"][number] | undefined
    >((nearest, candidate) => {
      if (!nearest) return candidate;
      const current = Math.hypot(
        candidate.center.x - midpoint.x,
        candidate.center.y - midpoint.y,
      );
      const best = Math.hypot(
        nearest.center.x - midpoint.x,
        nearest.center.y - midpoint.y,
      );
      return current < best ? candidate : nearest;
    }, undefined);
    if (!patch) return;
    const inward = scale(normalize(patch.normal), -1);
    const start = add(midpoint, scale(inward, -30));
    const end = add(midpoint, scale(inward, -5));
    const side = perpendicular(inward);
    this.effectGraphics.lineStyle(
      0.8 + Math.min(1.5, loadRatio * 0.8),
      color,
      0.55,
    );
    this.effectGraphics.lineBetween(start.x, start.y, end.x, end.y);
    this.effectGraphics.fillStyle(color, 0.9);
    this.effectGraphics.fillTriangle(
      end.x,
      end.y,
      end.x - inward.x * 7 + side.x * 3.5,
      end.y - inward.y * 7 + side.y * 3.5,
      end.x - inward.x * 7 - side.x * 3.5,
      end.y - inward.y * 7 - side.y * 3.5,
    );
  }

  private drawPredictedFracture(
    slime: ArmySlime,
    critical: StressLinkInfo,
    time: number,
  ): void {
    const center = lerp(critical.nodeA!.position, critical.nodeB!.position, 0.5);
    const pressureDirection =
      slime.contactPatches[0]?.normal ??
      normalize(sub(center, slime.center));
    const direction = perpendicular(pressureDirection);
    const length = Math.min(slime.currentWidth, slime.currentDepth) * 0.62;
    const pulse = 0.2 + Math.sin(time * 0.009) * 0.06;
    const segments = 8;
    this.effectGraphics.lineStyle(1, 0xffd166, pulse);
    for (let i = 0; i < segments; i += 2) {
      const a = add(center, scale(direction, (i / segments - 0.5) * length));
      const b = add(
        center,
        scale(direction, ((i + 1) / segments - 0.5) * length),
      );
      this.effectGraphics.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  private drawDetailedStressLabels(
    slime: ArmySlime,
    infos: StressLinkInfo[],
  ): void {
    const inverseZoom = 1 / Math.max(0.12, this.scene.cameras.main.zoom);
    const display = infos
      .filter((info) => info.nodeA && info.nodeB)
      .slice(0, 3);
    const cause = display[0];
    if (display.length > 0 && cause) {
      let label = this.causeLabel;
      if (!label) {
        label = this.scene.add
          .text(0, 0, "", {
            fontFamily: "Inter, Noto Sans JP, sans-serif",
            fontSize: "11px",
            fontStyle: "bold",
            color: "#fff2c2",
            backgroundColor: "#07131dee",
            padding: { x: 6, y: 4 },
          })
          .setOrigin(0.5)
          .setResolution(2);
        this.labelLayer.add(label);
        this.causeLabel = label;
      }
      const lines = display.map(
        (info) =>
          `${shortNodeName(info.link.nodeAId)}-${shortNodeName(info.link.nodeBId)}  負荷${Math.round(info.loadRatio * 100)}%  耐久${Math.round(info.link.integrity * 100)}%`,
      );
      const view = this.scene.cameras.main.worldView;
      const panelX = clamp(
        slime.center.x,
        view.left + 82 * inverseZoom,
        view.right - 82 * inverseZoom,
      );
      const panelY = clamp(
        slime.center.y + slime.currentWidth * 0.58,
        view.top + 65 * inverseZoom,
        view.bottom - 55 * inverseZoom,
      );
      label
        .setText(`応力詳細\n${lines.join("\n")}\n主因：${stressCause(slime, cause)}`)
        .setPosition(panelX, panelY)
        .setScale(inverseZoom)
        .setVisible(true);
    }
  }

  private updateLabels(slimes: ArmySlime[]): void {
    const activeIds = new Set(slimes.map((slime) => slime.id));
    for (const [id, label] of this.labels) {
      if (activeIds.has(id)) continue;
      label.destroy();
      this.labels.delete(id);
    }

    const inverseZoom = 1 / Math.max(0.12, this.scene.cameras.main.zoom);
    for (const slime of slimes) {
      let label = this.labels.get(slime.id);
      if (!label) {
        label = this.scene.add
          .text(0, 0, "", {
            fontFamily: "Inter, Noto Sans JP, sans-serif",
            fontSize: "14px",
            fontStyle: "bold",
            color: "#ffffff",
            backgroundColor: "#07131ddd",
            padding: { x: 7, y: 4 },
            stroke: "#07131d",
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1)
          .setResolution(2);
        this.labelLayer.add(label);
        this.labels.set(slime.id, label);
      }

      const top = Math.min(
        ...getBoundaryNodes(slime).map((node) => node.position.y),
      );
      const moraleColor =
        slime.isRouting || slime.morale <= 25
          ? "#ffd166"
          : slime.morale <= 40
            ? "#ffb86b"
            : slime.side === "player"
              ? "#b8f4ff"
              : "#ffd0da";
      label
        .setText(
          `${slime.isRouting ? "敗走  " : ""}兵 ${Math.round(slime.mass)}  士気 ${Math.round(slime.morale)}`,
        )
        .setColor(moraleColor)
        .setOrigin(0.5, 1)
        .setPosition(
          clamp(
            slime.center.x,
            this.scene.cameras.main.worldView.left + 55 * inverseZoom,
            this.scene.cameras.main.worldView.right - 55 * inverseZoom,
          ),
          top - 12 * inverseZoom,
        )
        .setScale(inverseZoom);
    }
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
    if (slime.gapRisk > 0.55 && Math.sin(time * 0.006) > -0.35) {
      this.effectGraphics.lineStyle(1.8, 0xffd166, 0.32);
      nodes
        .filter((node) => node.role === "front" || node.role === "left" || node.role === "right")
        .forEach((node, index) => {
          if (index % 2 !== 0) return;
          this.effectGraphics.strokeCircle(
            node.position.x,
            node.position.y,
            7 + slime.gapRisk * 8,
          );
        });
    }
    if (slime.crowding > 0.18) {
      this.effectGraphics.fillStyle(0xff9f43, 0.08 + slime.crowding * 0.12);
      this.effectGraphics.fillCircle(slime.center.x, slime.center.y, 58 + slime.crowding * 30);
    }
    if (slime.splitStress > 0.18 || slime.brokenLinkRatio > 0) {
      const crackDirection = perpendicular(slime.fractureNormal);
      const wobbleDirection = slime.fractureNormal;
      const crackLength =
        Math.min(slime.currentWidth, slime.currentDepth) *
        (0.18 + slime.fractureConcentration * 0.42);
      const segments = 7;
      this.effectGraphics.lineStyle(
        3 + slime.splitStress * 5,
        slime.fractureLinkCount >= 2 ? 0xff5d73 : 0xffd166,
        0.45 + slime.splitStress * 0.5,
      );
      this.effectGraphics.beginPath();
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments - 0.5;
        const point = add(
          slime.fractureCenter,
          add(
            scale(crackDirection, t * crackLength * 2),
            scale(
              wobbleDirection,
              Math.sin(i * 2.3) * (3 + slime.splitStress * 10),
            ),
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
