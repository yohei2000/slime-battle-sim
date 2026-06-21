import Phaser from "phaser";
import {
  applySkillChoice,
  battleProjection,
  buildArchetype,
  choiceKindLabel,
  createInitialGrowthState,
  rerollChoices,
  SKILL_DEFINITIONS,
  skillDefinition,
  slotLabel,
} from "../growth/slimeSkills";
import type { SkillChoice, SkillSlotState, SlimeGrowthState, SlimeSkillId } from "../growth/slimeSkills";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const GROWTH_BACKGROUND_KEY = "growth-generated-background";

export class SlimeGrowthScene extends Phaser.Scene {
  private growth: SlimeGrowthState = createInitialGrowthState();
  private objects: Phaser.GameObjects.GameObject[] = [];
  private animatedGraphics?: Phaser.GameObjects.Graphics;
  private animatedCoreCenter = { x: 0, y: 0 };
  private animatedCoreRadius = 0;
  private animatedSlotPoints: Array<{
    x: number;
    y: number;
    color: number;
    active: boolean;
    level: number;
  }> = [];
  private coreRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private panelRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private choiceRect: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    super("SlimeGrowthScene");
  }

  preload(): void {
    this.load.image(GROWTH_BACKGROUND_KEY, "assets/generated/growth-bg.png");
    SKILL_DEFINITIONS.forEach((definition) => {
      this.load.image(definition.artKey, `assets/generated/${definition.artKey}.png`);
    });
  }

  create(): void {
    this.scale.on("resize", this.redraw, this);
    this.redraw();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.redraw, this);
      this.clearObjects();
    });
  }

  update(time: number): void {
    if (!this.animatedGraphics) return;
    const t = time * 0.001;
    const graphics = this.animatedGraphics;
    const center = this.animatedCoreCenter;
    const radius = this.animatedCoreRadius;
    graphics.clear();
    graphics.setBlendMode(Phaser.BlendModes.ADD);

    for (let i = 0; i < 4; i += 1) {
      const pulse = 0.5 + Math.sin(t * 1.4 + i * 1.7) * 0.5;
      graphics.lineStyle(1 + i * 0.45, i % 2 === 0 ? 0x7cecff : 0x9aff9f, 0.12 + pulse * 0.12);
      graphics.strokeEllipse(
        center.x,
        center.y,
        radius * (2.15 + i * 0.22 + pulse * 0.08),
        radius * (1.66 + i * 0.12 + pulse * 0.05),
      );
    }

    this.animatedSlotPoints.forEach((point, index) => {
      const pulse = 0.5 + Math.sin(t * 2.2 + index * 0.9) * 0.5;
      const alpha = point.active ? 0.18 + pulse * 0.32 : 0.04 + pulse * 0.06;
      graphics.lineStyle(point.active ? 2.5 : 1.2, point.color, alpha);
      graphics.lineBetween(center.x, center.y, point.x, point.y);

      const travel = (t * (0.16 + point.level * 0.018) + index * 0.17) % 1;
      const sparkX = Phaser.Math.Linear(center.x, point.x, travel);
      const sparkY = Phaser.Math.Linear(center.y, point.y, travel);
      graphics.fillStyle(point.active ? point.color : 0x7cecff, point.active ? 0.35 + pulse * 0.42 : 0.1);
      graphics.fillCircle(sparkX, sparkY, point.active ? 3.2 + point.level * 0.35 : 1.7);
    });
  }

  private redraw(): void {
    this.clearObjects();
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 760;

    this.addBackground(width, height);
    this.addHeader(width, compact);
    this.layout(width, height, compact);
    if (compact) {
      this.drawMobileSlotStrip();
    } else {
      this.drawCore(false);
    }
    this.drawPanel(compact);
    this.drawChoices(compact);
  }

  private layout(width: number, height: number, compact: boolean): void {
    if (compact) {
      this.coreRect = { x: 12, y: 74, width: width - 24, height: 104 };
      this.panelRect = { x: 12, y: 186, width: width - 24, height: 94 };
      this.choiceRect = {
        x: 12,
        y: 288,
        width: width - 24,
        height: Math.max(0, height - 312),
      };
      return;
    }

    const choiceHeight = Math.min(196, Math.max(164, height * 0.34));
    const choiceY = height - choiceHeight - 22;
    const topHeight = Math.max(210, choiceY - 100);
    const coreWidth = Math.max(420, Math.min(width * 0.58, width - 320));

    this.coreRect = {
      x: 22,
      y: 86,
      width: coreWidth,
      height: topHeight,
    };
    this.choiceRect = {
      x: 22,
      y: choiceY,
      width: width - 44,
      height: choiceHeight,
    };
    this.panelRect = {
      x: this.coreRect.x + this.coreRect.width + 20,
      y: 86,
      width: width - (this.coreRect.x + this.coreRect.width + 42),
      height: topHeight,
    };
  }

  private addBackground(width: number, height: number): void {
    this.addCoverImage(GROWTH_BACKGROUND_KEY, width, height, 0.95, -4);
    const graphics = this.add.graphics();
    graphics.fillStyle(0x071118, 0.18);
    graphics.fillRect(0, 0, width, height);
    graphics.lineStyle(1, 0x163342, 0.16);
    for (let x = 0; x <= width; x += 64) graphics.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 64) graphics.lineBetween(0, y, width, y);
    graphics.lineStyle(1, 0x2b5363, 0.08);
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 193) % width;
      graphics.lineBetween(x, 64, x + 140, height);
    }
    this.objects.push(graphics);
    this.addWarRoomBackdrop(width, height);
  }

  private addWarRoomBackdrop(width: number, height: number): void {
    const operationZones = [
      { x: width * 0.16, y: height * 0.22, w: width * 0.48, h: height * 0.28, c: 0x174e5f, a: 0.14 },
      { x: width * 0.78, y: height * 0.34, w: width * 0.42, h: height * 0.3, c: 0x2bd6a3, a: 0.055 },
      { x: width * 0.52, y: height * 0.76, w: width * 0.68, h: height * 0.22, c: 0x35d8ff, a: 0.05 },
    ];

    operationZones.forEach((zone, index) => {
      const ellipse = this.add
        .ellipse(zone.x, zone.y, zone.w, zone.h, zone.c, zone.a)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(0.2);
      this.tweens.add({
        targets: ellipse,
        alpha: zone.a * 1.7,
        scaleX: 1.04 + index * 0.015,
        scaleY: 0.96 - index * 0.01,
        duration: 4200 + index * 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.objects.push(ellipse);
    });

    for (let i = 0; i < 18; i += 1) {
      const y = 96 + ((i * 53) % Math.max(1, height - 130));
      const x = 24 + ((i * 131) % Math.max(1, width - 64));
      const line = this.add
        .rectangle(x, y, 42 + (i % 5) * 10, 2, i % 3 === 0 ? 0x7cecff : 0xffd166, 0.12)
        .setOrigin(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(0.4);
      this.tweens.add({
        targets: line,
        x: x + 18 + (i % 4) * 8,
        alpha: 0.26,
        duration: 2800 + (i % 6) * 520,
        delay: (i % 5) * 220,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.objects.push(line);
    }
  }

  private addHeader(width: number, compact: boolean): void {
    const header = this.add.rectangle(0, 0, width, 64, 0x0b1a23, 0.88).setOrigin(0);
    this.objects.push(header);
    this.addText(18, 10, "軍制成長", compact ? 22 : 25, "#eafaff", 700);
    this.addText(
      18,
      40,
      `Army Lv.${this.growth.slimeLevel}  改革案 ${this.growth.wave}`,
      12,
      "#7cecff",
      700,
    );

    const buttonWidth = compact ? 66 : 82;
    this.makeButton(
      "戦略へ",
      width - buttonWidth * 2 - 24,
      17,
      buttonWidth,
      34,
      () => this.scene.start("StrategyMapScene"),
      true,
      0x163242,
    );
    this.makeButton(
      "戦闘へ",
      width - buttonWidth - 14,
      17,
      buttonWidth,
      34,
      () => this.scene.start("BattleScene"),
      true,
      0x23424d,
    );
  }

  private drawCore(compact: boolean): void {
    this.frame(this.coreRect, "軍制スロット");
    this.animatedSlotPoints = [];
    const graphics = this.add.graphics().setDepth(1);
    const center = {
      x: this.coreRect.x + this.coreRect.width * 0.5,
      y: this.coreRect.y + this.coreRect.height * (compact ? 0.46 : 0.5),
    };
    const radius = Math.min(this.coreRect.width, this.coreRect.height) * (compact ? 0.28 : 0.31);
    this.animatedCoreCenter = center;
    this.animatedCoreRadius = radius;

    graphics.fillStyle(0x0b2230, 0.78);
    graphics.fillEllipse(center.x, center.y, radius * 2.18, radius * 1.66);
    graphics.lineStyle(3, 0x7cecff, 0.28);
    graphics.strokeEllipse(center.x, center.y, radius * 2.18, radius * 1.66);
    graphics.lineStyle(2, 0x9aff9f, 0.18);
    graphics.strokeEllipse(center.x - radius * 0.05, center.y + radius * 0.02, radius * 1.58, radius * 1.08);
    graphics.lineStyle(2, 0xffd166, 0.16);
    graphics.strokeEllipse(center.x + radius * 0.08, center.y - radius * 0.03, radius * 1.24, radius * 0.78);

    for (let lane = -2; lane <= 2; lane += 1) {
      const y = center.y + lane * radius * 0.16;
      graphics.lineStyle(2, lane === 0 ? 0xffd166 : 0x7cecff, lane === 0 ? 0.28 : 0.16);
      graphics.lineBetween(center.x - radius * 0.72, y, center.x + radius * 0.72, y + lane * 3);
    }

    for (let i = 0; i < 20; i += 1) {
      const column = i % 5;
      const row = Math.floor(i / 5);
      const px = center.x - radius * 0.47 + column * radius * 0.24 + (row % 2) * radius * 0.06;
      const py = center.y - radius * 0.28 + row * radius * 0.18;
      graphics.fillStyle(row % 2 === 0 ? 0xd8f4ff : 0x7cecff, 0.28);
      graphics.fillRect(px, py, radius * 0.07, radius * 0.035);
    }

    this.objects.push(graphics);
    this.drawSlots(center, radius, compact);
    this.animatedGraphics = this.add.graphics().setDepth(2.8);
    this.objects.push(this.animatedGraphics);
    this.addCoreHighlights(center, radius);
    this.addText(
      this.coreRect.x + 18,
      this.coreRect.y + this.coreRect.height - (compact ? 46 : 54),
      `軍型: ${buildArchetype(this.growth)}\n候補を選ぶたび、軍制スロットが採用または強化されます`,
      compact ? 10 : 12,
      "#d8f4ff",
      500,
      this.coreRect.width - 36,
    );
  }

  private drawMobileSlotStrip(): void {
    this.frame(this.coreRect, "軍制スロット");
    const x = this.coreRect.x + 14;
    const y = this.coreRect.y + 34;
    const width = this.coreRect.width - 28;
    this.addText(x, y, `軍型: ${buildArchetype(this.growth)}`, 10, "#ffd166", 700, width);

    const columns = 3;
    const gap = 7;
    const pillWidth = (width - gap * (columns - 1)) / columns;
    const pillHeight = 22;
    const startY = y + 23;
    this.growth.slots.forEach((slot) => {
      const column = slot.index % columns;
      const row = Math.floor(slot.index / columns);
      const px = x + column * (pillWidth + gap);
      const py = startY + row * (pillHeight + 7);
      const definition = slot.skillId ? skillDefinition(slot.skillId) : undefined;
      const color = definition?.color ?? 0x2b5363;
      const fill = slot.skillId ? 0x102632 : 0x091722;
      const pill = this.add
        .rectangle(px, py, pillWidth, pillHeight, fill, slot.skillId ? 0.86 : 0.66)
        .setOrigin(0)
        .setStrokeStyle(slot.evolved ? 2 : 1, slot.evolved ? 0xffd166 : color, slot.skillId ? 0.82 : 0.42)
        .setDepth(3);
      if (slot.skillId) {
        this.addSkillImage(slot.skillId, px + 12, py + pillHeight / 2, 17, 0.86, 4);
      }
      const label = slot.skillId ? `${slotLabel(slot)} Lv.${slot.level}` : "空き";
      this.addText(
        px + (slot.skillId ? 25 : 6),
        py + 5,
        label,
        8,
        definition?.accent ?? "#7f98a5",
        slot.skillId ? 700 : 500,
        pillWidth - (slot.skillId ? 31 : 12),
      ).setDepth(4);
      this.objects.push(pill);
    });
  }

  private addCoreHighlights(center: { x: number; y: number }, radius: number): void {
    const halo = this.add
      .ellipse(center.x, center.y, radius * 2.36, radius * 1.84, 0x7cecff, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2.2);
    const forwardLine = this.add
      .rectangle(center.x + radius * 0.05, center.y - radius * 0.08, radius * 1.12, radius * 0.1, 0x9aff9f, 0.18)
      .setRotation(-0.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2.3);
    const reserveLine = this.add
      .rectangle(center.x - radius * 0.12, center.y + radius * 0.16, radius * 0.86, radius * 0.08, 0x35d8ff, 0.16)
      .setRotation(0.06)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2.3);

    this.tweens.add({
      targets: halo,
      alpha: 0.18,
      scaleX: 1.08,
      scaleY: 1.05,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: [forwardLine, reserveLine],
      alpha: { from: 0.15, to: 0.34 },
      scaleX: { from: 0.98, to: 1.08 },
      scaleY: { from: 0.92, to: 1.08 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.objects.push(halo, forwardLine, reserveLine);
  }

  private drawSlots(
    center: { x: number; y: number },
    radius: number,
    compact: boolean,
  ): void {
    const graphics = this.add.graphics().setDepth(2);
    const slotRadius = compact ? 23 : 28;
    const orbitX = radius * (compact ? 1.52 : 1.72);
    const orbitY = radius * (compact ? 1.12 : 1.24);

    this.growth.slots.forEach((slot) => {
      const angle = -Math.PI / 2 + (slot.index / this.growth.slots.length) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * orbitX;
      const y = center.y + Math.sin(angle) * orbitY;
      const definition = slot.skillId ? skillDefinition(slot.skillId) : undefined;
      const color = definition?.color ?? 0x2b5363;
      this.animatedSlotPoints.push({
        x,
        y,
        color,
        active: Boolean(slot.skillId),
        level: slot.level,
      });
      graphics.lineStyle(2, color, slot.skillId ? 0.52 : 0.24);
      graphics.lineBetween(center.x, center.y, x, y);

      const outer = this.add
        .circle(x, y, slotRadius + 5, 0x071118, 0.88)
        .setStrokeStyle(slot.evolved ? 4 : 2, slot.evolved ? 0xffd166 : color, slot.skillId ? 0.88 : 0.42)
        .setDepth(3);
      const inner = this.add
        .circle(x, y, slotRadius, color, slot.skillId ? 0.82 : 0.22)
        .setStrokeStyle(2, 0xeafaff, slot.skillId ? 0.4 : 0.16)
        .setDepth(4);
      if (slot.skillId) {
        this.addSkillImage(slot.skillId, x, y, slotRadius * 1.42, 0.78, 4.6);
      }
      const glow = this.add
        .circle(x, y, slotRadius + 12, color, slot.skillId ? 0.16 : 0.04)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(2.9);
      this.tweens.add({
        targets: glow,
        alpha: slot.skillId ? 0.34 : 0.1,
        scale: slot.skillId ? 1.16 : 1.08,
        duration: 1500 + slot.index * 130,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: [outer, inner],
        scale: slot.skillId ? 1.06 : 1.025,
        duration: 2100 + slot.index * 180,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      const label = this.addText(
        x - slotRadius - 20,
        y + slotRadius + 8,
        `${slotLabel(slot)}\n${slot.level ? `Lv.${slot.level}` : "未定着"}`,
        compact ? 9 : 10,
        definition?.accent ?? "#7f98a5",
        slot.skillId ? 700 : 500,
        slotRadius * 2 + 40,
      );
      label.setAlign("center").setDepth(5);
      this.drawLevelPips(x, y + slotRadius - 4, slot, definition?.maxLevel ?? 5, color);
      this.objects.push(glow, outer, inner, label);
    });
    this.objects.push(graphics);
  }

  private drawLevelPips(
    x: number,
    y: number,
    slot: SkillSlotState,
    maxLevel: number,
    color: number,
  ): void {
    const graphics = this.add.graphics().setDepth(6);
    const start = x - (maxLevel - 1) * 4;
    for (let i = 0; i < maxLevel; i += 1) {
      graphics.fillStyle(i < slot.level ? color : 0x1b3440, i < slot.level ? 0.94 : 0.72);
      graphics.fillCircle(start + i * 8, y, 2.6);
    }
    this.objects.push(graphics);
  }

  private drawPanel(compact: boolean): void {
    this.frame(this.panelRect, "戦闘反映");
    const projection = battleProjection(this.growth);
    const x = this.panelRect.x + 14;
    let y = this.panelRect.y + (compact ? 32 : 38);
    const width = this.panelRect.width - 28;

    const tightPanel = compact || this.panelRect.height < 300;
    if (tightPanel) {
      this.addText(
        x,
        y,
        `現在型: ${buildArchetype(this.growth)}\n` +
        `兵力 ${projection.mass}  士気 ${projection.morale}  結束 ${projection.cohesion}\n` +
          `疲労 ${projection.fatigue}  防御 ${projection.toughness.toFixed(2)}  命令 ${projection.commandDelay.toFixed(2)}秒\n` +
          `突撃 ${projection.breakthroughPower}  包囲 ${projection.envelopPower}  戦線 ${projection.zocStrength}`,
        compact ? 9 : 11,
        "#eafaff",
        600,
        width,
      );
      return;
    }

    this.addText(x, y, `現在型: ${buildArchetype(this.growth)}`, 14, "#ffd166", 700, width);
    y += 30;
    this.addText(
      x,
      y,
      `兵力 ${projection.mass}    士気 ${projection.morale}    結束 ${projection.cohesion}\n` +
        `疲労 ${projection.fatigue}    防御 ${projection.toughness.toFixed(2)}    命令 ${projection.commandDelay.toFixed(2)}秒\n` +
        `突撃 ${projection.breakthroughPower}    包囲 ${projection.envelopPower}    戦線 ${projection.zocStrength}\n` +
        `分断耐性 +${projection.splitResist}`,
      12,
      "#eafaff",
      600,
      width,
    );
    y += 92;
    this.addText(x, y, "設計メモ", 13, "#7cecff", 700, width);
    y += 22;
    this.addText(
      x,
      y,
      "スロットは魔法ではなく、国家が整える軍制です。人間の訓練・兵站・指揮が、戦場では広がる/固まる/割れる挙動として表れます。",
      12,
      "#bad7e4",
      500,
      width,
    );
    y += 72;
    this.addText(x, y, "成長ログ", 13, "#7cecff", 700, width);
    this.addText(
      x,
      y + 24,
      this.growth.reports.map((report) => `・${report}`).join("\n"),
      11,
      "#d8f4ff",
      500,
      width,
    );
  }

  private drawChoices(compact: boolean): void {
    this.frame(this.choiceRect, "軍制候補");
    const x = this.choiceRect.x + 14;
    const y = this.choiceRect.y + 36;
    const width = this.choiceRect.width - 28;
    const cardGap = compact ? 8 : 12;
    const cardWidth = compact ? width : (width - cardGap * 2) / 3;
    const cardHeight = compact
      ? Math.max(58, (this.choiceRect.height - 38 - cardGap * 2) / 3)
      : this.choiceRect.height - 38;

    this.growth.choices.forEach((choice, index) => {
      this.drawChoiceCard(
        choice,
        compact ? x : x + index * (cardWidth + cardGap),
        compact ? y + index * (cardHeight + cardGap) : y,
        cardWidth,
        cardHeight,
        compact,
      );
    });

    this.makeButton(
      `再提案 ${this.growth.rerolls}`,
      this.choiceRect.x + this.choiceRect.width - 102,
      this.choiceRect.y + 8,
      88,
      26,
      () => {
        this.growth = rerollChoices(this.growth);
        this.redraw();
      },
      this.growth.rerolls > 0,
      0x163242,
    );
  }

  private drawChoiceCard(
    choice: SkillChoice,
    x: number,
    y: number,
    width: number,
    height: number,
    compact: boolean,
  ): void {
    const definition = skillDefinition(choice.skillId);
    const artSize = compact ? Math.min(58, height - 12) : Math.min(118, height - 28);
    const textWidth = Math.max(96, width - artSize - (compact ? 44 : 72));
    const background = this.add
      .rectangle(x, y, width, height, 0x102632, 0.82)
      .setOrigin(0)
      .setStrokeStyle(choice.kind === "evolve" ? 3 : 2, choice.kind === "evolve" ? 0xffd166 : definition.color, 0.82)
      .setInteractive({ useHandCursor: true })
      .setDepth(4);
    const stripe = this.add
      .rectangle(x, y, 5, height, definition.color, 0.94)
      .setOrigin(0)
      .setDepth(5);
    const glow = this.add
      .rectangle(x + width / 2, y + height / 2, width + 12, height + 10, definition.color, choice.kind === "evolve" ? 0.18 : 0.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3);
    const insignia = this.add
      .rectangle(x + width - 28, y + 16, compact ? 18 : 22, compact ? 12 : 14, definition.color, 0.52)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(6);
    this.addSkillImage(
      choice.skillId,
      x + width - artSize / 2 - (compact ? 12 : 24),
      y + height / 2,
      artSize,
      compact ? 0.82 : 0.9,
      5.4,
    );
    this.tweens.add({
      targets: glow,
      alpha: choice.kind === "evolve" ? 0.34 : 0.16,
      scaleX: 1.012,
      scaleY: 1.04,
      duration: 1800 + width,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: insignia,
      alpha: 0.92,
      scaleX: 1.18,
      scaleY: 1.12,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    background.on("pointerdown", () => background.setFillStyle(0x183b4a, 0.92));
    background.on("pointerout", () => background.setFillStyle(0x102632, 0.82));
    background.on("pointerup", () => {
      this.growth = applySkillChoice(this.growth, choice.skillId);
      this.redraw();
    });

    const dense = compact && height < 96;
    this.addText(x + 14, y + 8, `${choiceKindLabel(choice)} / ${definition.organ}`, compact ? 8 : 10, definition.accent, 700, textWidth).setDepth(6);
    this.addText(x + 14, y + (compact ? 21 : 25), definition.name, dense ? 11 : compact ? 13 : 15, "#eafaff", 700, textWidth).setDepth(6);

    const lineStart = y + (compact ? (dense ? 39 : 42) : 48);
    const lineGap = compact ? (dense ? 12 : 13) : 16;
    this.addChoiceLine(x + 14, lineStart, "国家", definition.stateText, textWidth, compact, definition.accent);
    if (dense) {
      this.addChoiceLine(x + 14, lineStart + lineGap, "戦場", definition.behaviorText, textWidth, compact, definition.accent);
    } else {
      this.addChoiceLine(x + 14, lineStart + lineGap, "運用", definition.operationText, textWidth, compact, definition.accent);
      this.addChoiceLine(x + 14, lineStart + lineGap * 2, "戦場", definition.behaviorText, textWidth, compact, definition.accent);
      this.addChoiceLine(x + 14, lineStart + lineGap * 3, "弱点", definition.weaknessText, textWidth, compact, "#ffb3c4");
    }
    this.objects.push(glow, background, stripe, insignia);
  }

  private addChoiceLine(
    x: number,
    y: number,
    label: string,
    text: string,
    width: number,
    compact: boolean,
    labelColor: string,
  ): void {
    this.addText(x, y, label, compact ? 8 : 9, labelColor, 700, 34).setDepth(6);
    this.addText(x + (compact ? 32 : 36), y, text, compact ? 8 : 9, "#cdefff", 500, width - 38).setDepth(6);
  }

  private frame(rect: Rect, title: string): void {
    const frame = this.add
      .rectangle(rect.x, rect.y, rect.width, rect.height, 0x0a1a23, 0.74)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2b5363, 0.86);
    this.objects.push(frame);
    this.addText(rect.x + 14, rect.y + 11, title, 15, "#eafaff", 700, rect.width - 28);
  }

  private makeButton(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: () => void,
    enabled = true,
    fillColor = 0x163242,
  ): TextButton {
    const background = this.add
      .rectangle(x, y, width, height, enabled ? fillColor : 0x18232a, enabled ? 0.96 : 0.58)
      .setOrigin(0)
      .setStrokeStyle(2, enabled ? 0x7cecff : 0x425462, enabled ? 0.66 : 0.34)
      .setDepth(10);
    const text = this.add
      .text(x + width / 2, y + height / 2, label, {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: width < 72 ? "11px" : "12px",
        color: enabled ? "#eafaff" : "#78909c",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(11);

    if (enabled) {
      background.setInteractive({ useHandCursor: true });
      background.on("pointerdown", () => background.setFillStyle(0x28566f, 1));
      background.on("pointerout", () => background.setFillStyle(fillColor, 0.96));
      background.on("pointerup", () => {
        background.setFillStyle(fillColor, 0.96);
        onClick();
      });
    }

    this.objects.push(background, text);
    return { background, label: text };
  }

  private addText(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
    weight: number,
    wrapWidth?: number,
  ): Phaser.GameObjects.Text {
    const object = this.add.text(x, y, text, {
      fontFamily: "Inter, Noto Sans JP, sans-serif",
      fontSize: `${size}px`,
      color,
      fontStyle: weight >= 700 ? "bold" : "normal",
      lineSpacing: 3,
      wordWrap: wrapWidth ? { width: wrapWidth, useAdvancedWrap: true } : undefined,
    });
    object.setShadow(0, 2, "#001018", 4, true, true);
    this.objects.push(object);
    return object;
  }

  private addCoverImage(
    textureKey: string,
    width: number,
    height: number,
    alpha: number,
    depth: number,
  ): void {
    if (!this.textures.exists(textureKey)) return;
    const texture = this.textures.get(textureKey);
    const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = source.width || width;
    const sourceHeight = source.height || height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const image = this.add
      .image(width / 2, height / 2, textureKey)
      .setDisplaySize(sourceWidth * scale, sourceHeight * scale)
      .setAlpha(alpha)
      .setDepth(depth);
    this.objects.push(image);
  }

  private addSkillImage(
    skillId: SlimeSkillId,
    x: number,
    y: number,
    size: number,
    alpha: number,
    depth: number,
  ): void {
    const definition = skillDefinition(skillId);
    if (!this.textures.exists(definition.artKey)) return;
    const image = this.add
      .image(x, y, definition.artKey)
      .setDisplaySize(size, size)
      .setAlpha(alpha)
      .setDepth(depth);
    this.objects.push(image);
  }

  private clearObjects(): void {
    this.tweens.killAll();
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
    this.animatedGraphics = undefined;
    this.animatedSlotPoints = [];
  }
}
