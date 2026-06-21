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

const GROWTH_BACKGROUND_KEY = "growth-war-college-background";
const GROWTH_SLOT_ASSET_VERSION = "20260622a";
const GROWTH_UI_ASSET_VERSION = "20260622b";
const GROWTH_COMMAND_CORE_KEY = "growth-command-core";
const GROWTH_SLOT_EMPTY_KEY = "growth-slot-empty";
const GROWTH_SLOT_ACTIVE_KEY = "growth-slot-active";
const GROWTH_SLOT_EVOLVED_KEY = "growth-slot-evolved";
const GROWTH_DOCTRINE_CARD_KEY = "growth-doctrine-card";
const GROWTH_STAT_PANEL_KEY = "growth-stat-panel";
const GROWTH_RIBBON_KEY = "growth-ribbon";
const GROWTH_COMMAND_TOKEN_KEY = "growth-command-token";
const GROWTH_GENERATED_KEYS = [
  GROWTH_COMMAND_CORE_KEY,
  GROWTH_SLOT_EMPTY_KEY,
  GROWTH_SLOT_ACTIVE_KEY,
  GROWTH_SLOT_EVOLVED_KEY,
];

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
    this.load.image(GROWTH_BACKGROUND_KEY, `assets/generated/army-growth-bg-${GROWTH_UI_ASSET_VERSION}.png`);
    GROWTH_GENERATED_KEYS.forEach((key) => {
      this.load.image(key, `assets/generated/${key}-${GROWTH_SLOT_ASSET_VERSION}.png`);
    });
    this.load.image(GROWTH_DOCTRINE_CARD_KEY, `assets/generated/${GROWTH_DOCTRINE_CARD_KEY}-${GROWTH_UI_ASSET_VERSION}.png`);
    this.load.image(GROWTH_STAT_PANEL_KEY, `assets/generated/${GROWTH_STAT_PANEL_KEY}-${GROWTH_UI_ASSET_VERSION}.png`);
    this.load.image(GROWTH_RIBBON_KEY, `assets/generated/${GROWTH_RIBBON_KEY}-${GROWTH_UI_ASSET_VERSION}.png`);
    this.load.image(GROWTH_COMMAND_TOKEN_KEY, `assets/generated/${GROWTH_COMMAND_TOKEN_KEY}-${GROWTH_UI_ASSET_VERSION}.png`);
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
    this.addHeader(width, compact, height);
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
      this.coreRect = { x: 12, y: 76, width: width - 24, height: 146 };
      this.panelRect = { x: 12, y: 232, width: width - 24, height: 132 };
      this.choiceRect = {
        x: 12,
        y: 374,
        width: width - 24,
        height: Math.max(0, height - 398),
      };
      return;
    }

    const choiceHeight = Math.min(250, Math.max(206, height * 0.37));
    const choiceY = height - choiceHeight - 24;
    const topHeight = Math.max(230, choiceY - 106);
    const coreWidth = Math.max(430, Math.min(width * 0.54, width - 380));

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
    this.addCoverImage(GROWTH_BACKGROUND_KEY, width, height, 0.98, -4);
    const graphics = this.add.graphics();
    graphics.fillStyle(0x03080d, 0.28);
    graphics.fillRect(0, 0, width, height);
    graphics.fillGradientStyle(0x02060a, 0x02060a, 0x02060a, 0x02060a, 0.55, 0.46, 0.12, 0.18);
    graphics.fillRect(0, 0, width, height);
    graphics.lineStyle(1, 0x7cecff, 0.07);
    for (let x = 0; x <= width; x += 96) graphics.lineBetween(x, 70, x, height);
    for (let y = 72; y <= height; y += 96) graphics.lineBetween(0, y, width, y);
    graphics.lineStyle(1, 0xffd166, 0.045);
    for (let i = 0; i < 12; i += 1) {
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

  private addHeader(width: number, compact: boolean, height: number): void {
    const headerHeight = compact ? 66 : 70;
    const header = this.add.rectangle(0, 0, width, headerHeight, 0x071119, 0.86).setOrigin(0);
    const headerLine = this.add.rectangle(0, headerHeight - 2, width, 2, 0xffd166, 0.38).setOrigin(0);
    const glow = this.add
      .rectangle(width * 0.46, headerHeight - 1, Math.min(width * 0.72, 680), 4, 0x7cecff, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shade = this.add.rectangle(0, height - 80, width, 80, 0x02060a, 0.2).setOrigin(0);
    this.objects.push(header, headerLine, glow, shade);
    this.addText(18, compact ? 9 : 10, "軍制成長", compact ? 24 : 28, "#fff7df", 700);
    this.addText(
      18,
      compact ? 42 : 45,
      `Army Lv.${this.growth.slimeLevel}  改革案 ${this.growth.wave}`,
      13,
      "#9df1ff",
      700,
    );

    const buttonWidth = compact ? 72 : 88;
    this.makeButton(
      "戦略へ",
      width - buttonWidth * 2 - 24,
      compact ? 18 : 20,
      buttonWidth,
      compact ? 34 : 36,
      () => this.scene.start("StrategyMapScene"),
      true,
      0x163242,
    );
    this.makeButton(
      "戦闘へ",
      width - buttonWidth - 14,
      compact ? 18 : 20,
      buttonWidth,
      compact ? 34 : 36,
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

    const coreImage = this.add
      .image(center.x, center.y, GROWTH_COMMAND_CORE_KEY)
      .setDisplaySize(radius * 2.55, radius * 1.88)
      .setAlpha(0.96)
      .setDepth(1.6);
    this.objects.push(coreImage);

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
      compact ? 12 : 13,
      "#f4fbff",
      500,
      this.coreRect.width - 36,
    );
  }

  private drawMobileSlotStrip(): void {
    this.frame(this.coreRect, "軍制スロット");
    const x = this.coreRect.x + 16;
    const y = this.coreRect.y + 38;
    const width = this.coreRect.width - 32;
    this.addText(x, y, `軍型: ${buildArchetype(this.growth)}`, 14, "#ffd166", 700, width);

    const columns = 3;
    const gap = 7;
    const pillWidth = (width - gap * (columns - 1)) / columns;
    const pillHeight = 32;
    const startY = y + 28;
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
      const slotKey = slot.evolved
        ? GROWTH_SLOT_EVOLVED_KEY
        : slot.skillId
          ? GROWTH_SLOT_ACTIVE_KEY
          : GROWTH_SLOT_EMPTY_KEY;
      const slotFrame = this.add
        .image(px + 17, py + pillHeight / 2, slotKey)
        .setDisplaySize(30, 30)
        .setAlpha(slot.skillId ? 0.95 : 0.64)
        .setDepth(4);
      if (slot.skillId) {
        this.addSkillImage(slot.skillId, px + 17, py + pillHeight / 2, 17, 0.9, 4.6);
      }
      const label = slot.skillId ? `${slotLabel(slot)} Lv.${slot.level}` : "空き";
      this.addText(
        px + 37,
        py + 8,
        label,
        12,
        definition?.accent ?? "#7f98a5",
        slot.skillId ? 700 : 500,
        pillWidth - 44,
      ).setDepth(4);
      this.objects.push(pill, slotFrame);
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

      const slotKey = slot.evolved
        ? GROWTH_SLOT_EVOLVED_KEY
        : slot.skillId
          ? GROWTH_SLOT_ACTIVE_KEY
          : GROWTH_SLOT_EMPTY_KEY;
      const frameSize = slotRadius * (slot.evolved ? 3.02 : 2.72);
      const frame = this.add
        .image(x, y, slotKey)
        .setDisplaySize(frameSize, frameSize)
        .setAlpha(slot.skillId ? 0.98 : 0.7)
        .setDepth(3.6);
      if (slot.skillId) {
        this.addSkillImage(slot.skillId, x, y, slotRadius * 1.32, 0.84, 4.6);
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
      this.objects.push(glow, frame, label);
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
    const x = this.panelRect.x + (compact ? 16 : 18);
    let y = this.panelRect.y + (compact ? 38 : 46);
    const width = this.panelRect.width - (compact ? 32 : 36);
    const stats = [
      { label: "兵力", value: projection.mass.toString(), color: 0x7cecff },
      { label: "士気", value: projection.morale.toString(), color: 0xffd166 },
      { label: "結束", value: projection.cohesion.toString(), color: 0x9aff9f },
      { label: "疲労", value: projection.fatigue.toString(), color: 0xff91aa },
      { label: "防御", value: projection.toughness.toFixed(2), color: 0xf4b45f },
      { label: "命令", value: `${projection.commandDelay.toFixed(2)}秒`, color: 0xc5bdff },
      { label: "突撃", value: projection.breakthroughPower.toString(), color: 0xffd166 },
      { label: "包囲", value: projection.envelopPower.toString(), color: 0x6fffd0 },
    ];

    const tightPanel = compact || this.panelRect.height < 300;
    if (tightPanel) {
      this.addText(x, y, buildArchetype(this.growth), 17, "#ffd166", 700, width).setDepth(3);
      y += 30;
      const columns = compact ? 4 : 3;
      const gap = 7;
      const chipWidth = (width - gap * (columns - 1)) / columns;
      stats.slice(0, compact ? 8 : 6).forEach((stat, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        this.drawStatChip(x + column * (chipWidth + gap), y + row * 32, chipWidth, 27, stat.label, stat.value, stat.color);
      });
      return;
    }

    this.addText(x, y, buildArchetype(this.growth), 20, "#ffd166", 700, width).setDepth(3);
    y += 38;
    const chipGap = 8;
    const chipColumns = 2;
    const chipWidth = (width - chipGap) / chipColumns;
    stats.forEach((stat, index) => {
      const column = index % chipColumns;
      const row = Math.floor(index / chipColumns);
      this.drawStatChip(x + column * (chipWidth + chipGap), y + row * 36, chipWidth, 30, stat.label, stat.value, stat.color);
    });
    y += 158;
    this.addText(x, y, `戦線 ${projection.zocStrength} / 分断耐性 +${projection.splitResist}`, 13, "#eafaff", 700, width).setDepth(3);
    y += 28;
    this.addText(x, y, "設計メモ", 14, "#9df1ff", 700, width).setDepth(3);
    y += 22;
    this.addText(
      x,
      y,
      "スロットは魔法ではなく、国家が整える軍制です。人間の訓練・兵站・指揮が、戦場では広がる/固まる/割れる挙動として表れます。",
      13,
      "#eafaff",
      500,
      width,
    ).setDepth(3);
    const logY = y + 68;
    if (logY + 58 <= this.panelRect.y + this.panelRect.height) {
      this.addText(x, logY, "成長ログ", 14, "#9df1ff", 700, width).setDepth(3);
      this.addText(
        x,
        logY + 24,
        this.growth.reports.map((report) => `・${report}`).join("\n"),
        12,
        "#d8f4ff",
        500,
        width,
      ).setDepth(3);
    }
  }

  private drawStatChip(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    color: number,
  ): void {
    const background = this.add
      .rectangle(x, y, width, height, 0x071119, 0.72)
      .setOrigin(0)
      .setStrokeStyle(1, color, 0.42)
      .setDepth(2.4);
    const accent = this.add
      .rectangle(x, y, 4, height, color, 0.92)
      .setOrigin(0)
      .setDepth(2.6);
    this.addText(x + 9, y + 6, label, 12, "#b8d4df", 700, Math.max(34, width * 0.42)).setDepth(3);
    this.addText(x + width - 10, y + 5, value, height < 30 ? 13 : 14, "#fff7df", 700)
      .setOrigin(1, 0)
      .setDepth(3);
    this.objects.push(background, accent);
  }

  private drawChoices(compact: boolean): void {
    this.frame(this.choiceRect, "軍制候補");
    const x = this.choiceRect.x + (compact ? 12 : 16);
    const y = this.choiceRect.y + (compact ? 42 : 48);
    const width = this.choiceRect.width - (compact ? 24 : 32);
    const cardGap = compact ? 10 : 14;
    const cardWidth = compact ? width : (width - cardGap * 2) / 3;
    const cardHeight = compact
      ? Math.max(88, (this.choiceRect.height - 48 - cardGap * 2) / 3)
      : this.choiceRect.height - 54;

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

    this.makeTokenButton(
      `再提案 ${this.growth.rerolls}`,
      this.choiceRect.x + this.choiceRect.width - (compact ? 54 : 64),
      this.choiceRect.y + (compact ? 23 : 25),
      compact ? 46 : 54,
      () => {
        this.growth = rerollChoices(this.growth);
        this.redraw();
      },
      this.growth.rerolls > 0,
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
    const artSize = compact ? Math.min(62, height - 20) : Math.min(104, height - 42);
    const leftPad = compact ? 84 : 118;
    const textWidth = Math.max(116, width - leftPad - (compact ? 22 : 28));
    const textColor = "#172934";
    const mutedText = "#38515c";
    const cardImage = this.add
      .image(x + width / 2, y + height / 2, GROWTH_DOCTRINE_CARD_KEY)
      .setDisplaySize(width + (compact ? 10 : 18), height + (compact ? 18 : 30))
      .setAlpha(0.98)
      .setDepth(3.8);
    const parchmentVeil = this.add
      .rectangle(x + leftPad - 10, y + 16, width - leftPad - 4, height - 30, 0xf0dcb0, 0.2)
      .setOrigin(0)
      .setDepth(4.1);
    const background = this.add
      .rectangle(x, y, width, height, 0x102632, 0.08)
      .setOrigin(0)
      .setStrokeStyle(choice.kind === "evolve" ? 3 : 2, choice.kind === "evolve" ? 0xffd166 : definition.color, 0.72)
      .setInteractive({ useHandCursor: true })
      .setDepth(5.8);
    const stripe = this.add
      .rectangle(x + 10, y + 16, 4, height - 32, definition.color, 0.72)
      .setOrigin(0)
      .setDepth(5.2);
    const glow = this.add
      .rectangle(x + width / 2, y + height / 2, width + 20, height + 16, definition.color, choice.kind === "evolve" ? 0.2 : 0.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3);
    const artBack = this.add
      .circle(x + (compact ? 46 : 60), y + height / 2, artSize * 0.58, definition.color, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4.8);
    this.addSkillImage(
      choice.skillId,
      x + (compact ? 46 : 60),
      y + height / 2,
      artSize,
      compact ? 0.94 : 0.96,
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
    background.on("pointerdown", () => background.setFillStyle(0xfff0c8, 0.18));
    background.on("pointerout", () => background.setFillStyle(0x102632, 0.08));
    background.on("pointerup", () => {
      this.growth = applySkillChoice(this.growth, choice.skillId);
      this.redraw();
    });

    const dense = compact && height < 112;
    const textX = x + leftPad;
    this.addText(textX, y + (compact ? 12 : 18), `${choiceKindLabel(choice)} / ${definition.organ}`, 12, definition.accent, 700, textWidth).setDepth(6);
    this.addText(textX, y + (compact ? 31 : 42), definition.name, dense ? 15 : compact ? 16 : 18, textColor, 700, textWidth).setDepth(6);

    const lineStart = y + (compact ? (dense ? 58 : 64) : 76);
    const lineGap = compact ? 18 : 22;
    this.addChoiceLine(textX, lineStart, "国家", definition.stateText, textWidth, compact, definition.accent, mutedText);
    if (dense) {
      this.addChoiceLine(textX, lineStart + lineGap, "戦場", definition.behaviorText, textWidth, compact, definition.accent, mutedText);
    } else {
      this.addChoiceLine(textX, lineStart + lineGap, "運用", definition.operationText, textWidth, compact, definition.accent, mutedText);
      this.addChoiceLine(textX, lineStart + lineGap * 2, "戦場", definition.behaviorText, textWidth, compact, definition.accent, mutedText);
      if (!compact || height >= 150) {
        this.addChoiceLine(textX, lineStart + lineGap * 3, "弱点", definition.weaknessText, textWidth, compact, "#9f334a", mutedText);
      }
    }
    this.objects.push(glow, cardImage, parchmentVeil, background, stripe, artBack);
  }

  private addChoiceLine(
    x: number,
    y: number,
    label: string,
    text: string,
    width: number,
    compact: boolean,
    labelColor: string,
    textColor = "#cdefff",
  ): void {
    this.addText(x, y, label, 12, labelColor, 700, 42).setDepth(6);
    this.addText(x + (compact ? 42 : 46), y, text, compact ? 12 : 13, textColor, 500, width - 48).setDepth(6);
  }

  private frame(rect: Rect, title: string): void {
    if (this.textures.exists(GROWTH_STAT_PANEL_KEY)) {
      const panel = this.add
        .image(rect.x + rect.width / 2, rect.y + rect.height / 2, GROWTH_STAT_PANEL_KEY)
        .setDisplaySize(rect.width + 26, rect.height + 28)
        .setAlpha(0.78)
        .setDepth(0);
      this.objects.push(panel);
    }
    const frame = this.add
      .rectangle(rect.x, rect.y, rect.width, rect.height, 0x0a1a23, 0.66)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2b5363, 0.86);
    this.objects.push(frame);
    const ribbonWidth = Math.min(Math.max(150, title.length * 30 + 86), Math.min(rect.width - 28, 310));
    if (this.textures.exists(GROWTH_RIBBON_KEY)) {
      const ribbon = this.add
        .image(rect.x + 14 + ribbonWidth / 2, rect.y + 19, GROWTH_RIBBON_KEY)
        .setDisplaySize(ribbonWidth, 34)
        .setAlpha(0.92)
        .setDepth(1.2);
      this.objects.push(ribbon);
      this.addText(rect.x + 34, rect.y + 10, title, 15, "#fff7df", 700, ribbonWidth - 40).setDepth(1.6);
      return;
    }
    this.addText(rect.x + 14, rect.y + 11, title, 15, "#eafaff", 700, rect.width - 28);
  }

  private makeTokenButton(
    label: string,
    x: number,
    y: number,
    size: number,
    onClick: () => void,
    enabled = true,
  ): void {
    const hitArea = this.add
      .circle(x, y, size * 0.5, 0x071119, 0.04)
      .setStrokeStyle(1, enabled ? 0xffd166 : 0x425462, enabled ? 0.5 : 0.28)
      .setDepth(8);
    const token = this.add
      .image(x, y, GROWTH_COMMAND_TOKEN_KEY)
      .setDisplaySize(size, size)
      .setAlpha(enabled ? 0.96 : 0.5)
      .setDepth(8.4);
    const text = this.add
      .text(x, y + 1, label, {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: size < 50 ? "12px" : "13px",
        color: enabled ? "#fff7df" : "#78909c",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(9);
    text.setShadow(0, 2, "#001018", 4, true, true);

    if (enabled) {
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => token.setScale(0.96));
      hitArea.on("pointerout", () => token.setScale(1));
      hitArea.on("pointerup", () => {
        token.setScale(1);
        onClick();
      });
    }

    this.objects.push(hitArea, token, text);
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
        fontSize: width < 72 ? "12px" : "13px",
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
    const readableSize = Math.max(size, 12);
    const object = this.add.text(x, y, text, {
      fontFamily: "Inter, Noto Sans JP, sans-serif",
      fontSize: `${readableSize}px`,
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
