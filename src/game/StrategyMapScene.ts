import Phaser from "phaser";
import {
  applyDiplomacyAction,
  applyDomesticOrder,
  battlePreview,
  canUseDiplomacyAction,
  canUseDomesticOrder,
  createInitialCampaignState,
  endTurn,
  factionById,
  relationForFactionId,
  resourceText,
  selectRegion,
  selectedRegion,
  targetFactionForSelectedRegion,
  terrainLabel,
} from "../campaign/campaignState";
import type {
  BattlePreview,
  CampaignState,
  DiplomacyActionId,
  DomesticOrderId,
  RegionNode,
} from "../campaign/types";

type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const DOMESTIC_ACTIONS: Array<{ id: DomesticOrderId; label: string }> = [
  { id: "growth", label: "補充" },
  { id: "rest", label: "休整" },
  { id: "cohesion", label: "結束" },
  { id: "hardening", label: "防備" },
];

const DIPLOMACY_ACTIONS: Array<{ id: DiplomacyActionId; label: string }> = [
  { id: "passage", label: "通行" },
  { id: "supply", label: "補給" },
  { id: "pressure", label: "威圧" },
];

const STRATEGY_BACKGROUND_KEY = "strategy-generated-background";

export class StrategyMapScene extends Phaser.Scene {
  private state: CampaignState = createInitialCampaignState();
  private objects: Phaser.GameObjects.GameObject[] = [];
  private mapRect: LayoutRect = { x: 0, y: 0, width: 0, height: 0 };
  private panelRect: LayoutRect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    super("StrategyMapScene");
  }

  preload(): void {
    this.load.image(STRATEGY_BACKGROUND_KEY, "assets/generated/ai-strategy-bg-20260621.png");
  }

  create(): void {
    this.scale.on("resize", this.redraw, this);
    this.redraw();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.redraw, this);
      this.clearObjects();
    });
  }

  private redraw(): void {
    this.clearObjects();
    const width = this.scale.width;
    const height = this.scale.height;
    const isWide = width >= 760;

    this.addBackground(width, height);
    this.addHeader(width);

    if (isWide) {
      this.mapRect = {
        x: 22,
        y: 86,
        width: Math.max(420, width * 0.61),
        height: height - 112,
      };
      this.panelRect = {
        x: this.mapRect.x + this.mapRect.width + 20,
        y: 86,
        width: width - (this.mapRect.x + this.mapRect.width + 42),
        height: height - 112,
      };
    } else {
      this.mapRect = {
        x: 14,
        y: 78,
        width: width - 28,
        height: Math.max(260, Math.min(330, height * 0.36)),
      };
      this.panelRect = {
        x: 14,
        y: this.mapRect.y + this.mapRect.height + 14,
        width: width - 28,
        height: height - (this.mapRect.y + this.mapRect.height + 28),
      };
    }

    this.addMapFrame();
    this.drawRoutes();
    this.drawRegions();
    this.drawPanel(isWide);
  }

  private addBackground(width: number, height: number): void {
    this.addCoverImage(STRATEGY_BACKGROUND_KEY, width, height, 0.92, -4);
    const graphics = this.add.graphics();
    graphics.fillStyle(0x071118, 0.12);
    graphics.fillRect(0, 0, width, height);
    graphics.lineStyle(1, 0x163342, 0.14);
    for (let x = 0; x <= width; x += 72) graphics.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 72) graphics.lineBetween(0, y, width, y);
    this.objects.push(graphics);
  }

  private addHeader(width: number): void {
    const header = this.add.rectangle(0, 0, width, 64, 0x0b1a23, 0.88).setOrigin(0);
    this.objects.push(header);

    this.addText(18, 12, "戦略マップ", 24, "#eafaff", 700);
    const compactHeader = width < 580;
    this.addText(
      18,
      42,
      compactHeader
        ? `T${this.state.turn}  糧${this.state.resources.nutrient} 偵${this.state.resources.spores} 工${this.state.resources.gel} 甲${this.state.resources.shell} 記${this.state.resources.memory}`
        : `Turn ${this.state.turn}`,
      compactHeader ? 10 : 13,
      "#7cecff",
      700,
      compactHeader ? Math.max(180, width - 170) : undefined,
    );
    const compactResources =
      compactHeader
        ? `糧${this.state.resources.nutrient} 偵${this.state.resources.spores} 工${this.state.resources.gel}\n甲${this.state.resources.shell} 記${this.state.resources.memory}`
        : resourceText(this.state.resources);
    if (!compactHeader) {
      this.addText(
        Math.min(190, width * 0.38),
        18,
        compactResources,
        13,
        "#cdefff",
        600,
        Math.max(180, width - 210),
      );
    }

    const buttonWidth = width < 580 ? 62 : 82;
    this.makeButton(
      "成長",
      width - buttonWidth * 2 - 24,
      17,
      buttonWidth,
      34,
      () => this.scene.start("SlimeGrowthScene"),
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

  private addMapFrame(): void {
    const frame = this.add
      .rectangle(
        this.mapRect.x,
        this.mapRect.y,
        this.mapRect.width,
        this.mapRect.height,
        0x0a1a23,
        0.76,
      )
      .setOrigin(0)
      .setStrokeStyle(2, 0x2b5363, 0.86);
    this.objects.push(frame);

    const title = this.addText(
      this.mapRect.x + 14,
      this.mapRect.y + 12,
      "境界圧力と補給路",
      15,
      "#eafaff",
      700,
    );
    title.setDepth(4);
  }

  private drawRoutes(): void {
    const graphics = this.add.graphics().setDepth(1);
    const drawn = new Set<string>();
    this.state.regions.forEach((region) => {
      const from = this.regionPoint(region);
      region.adjacentRegionIds.forEach((adjacentId) => {
        const adjacent = this.state.regions.find((candidate) => candidate.id === adjacentId);
        if (!adjacent) return;
        const key = [region.id, adjacent.id].sort().join("|");
        if (drawn.has(key)) return;
        drawn.add(key);
        const to = this.regionPoint(adjacent);
        const isPlayerRoute =
          region.ownerFactionId === "player" || adjacent.ownerFactionId === "player";
        graphics.lineStyle(3, isPlayerRoute ? 0x2f8eac : 0x31424b, isPlayerRoute ? 0.58 : 0.42);
        graphics.lineBetween(from.x, from.y, to.x, to.y);
      });
    });
    this.objects.push(graphics);
  }

  private drawRegions(): void {
    const compactMap = this.scale.width < 520;
    this.state.regions.forEach((region) => {
      const point = this.regionPoint(region);
      const faction = factionById(this.state, region.ownerFactionId);
      const selected = region.id === this.state.selectedRegionId;
      const radius = selected ? 24 : 20;
      const outer = this.add
        .circle(point.x, point.y, radius + 6, 0x071118, 0.84)
        .setStrokeStyle(selected ? 4 : 2, selected ? 0xffd166 : faction.color, selected ? 0.95 : 0.6)
        .setDepth(2);
      const node = this.add
        .circle(point.x, point.y, radius, faction.color, region.ownerFactionId === "player" ? 0.9 : 0.72)
        .setStrokeStyle(2, 0xeafaff, selected ? 0.85 : 0.34)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      node.on("pointerup", () => {
        this.state = selectRegion(this.state, region.id);
        this.redraw();
      });

      const pressureColor =
        region.frontPressure > 44 ? "#ff91aa" : region.frontPressure > 25 ? "#ffd166" : "#7cecff";
      const labelText =
        compactMap && !selected
          ? `${region.name}\n圧${region.frontPressure}%`
          : `${region.name}\n${terrainLabel(region.terrain)}  圧${region.frontPressure}%`;
      const label = this.addText(
        point.x - 54,
        point.y + radius + 10,
        labelText,
        compactMap ? 10 : 11,
        pressureColor,
        selected ? 700 : 500,
        108,
      );
      label.setAlign("center").setDepth(4);
      this.objects.push(outer, node, label);
    });
  }

  private drawPanel(isWide: boolean): void {
    const panel = this.add
      .rectangle(
        this.panelRect.x,
        this.panelRect.y,
        this.panelRect.width,
        this.panelRect.height,
        0x0b1a23,
        0.78,
      )
      .setOrigin(0)
      .setStrokeStyle(2, 0x2b5363, 0.84);
    this.objects.push(panel);

    const selected = selectedRegion(this.state);
    const owner = factionById(this.state, selected.ownerFactionId);
    const relation = relationForFactionId(this.state, selected.ownerFactionId);
    const diplomacyTarget = targetFactionForSelectedRegion(this.state);
    const preview = battlePreview(this.state);
    const x = this.panelRect.x + 14;
    let y = this.panelRect.y + 14;
    const contentWidth = this.panelRect.width - 28;
    const compact = !isWide || this.panelRect.height < 560;

    this.addText(x, y, selected.name, compact ? 18 : 20, "#eafaff", 700, contentWidth);
    if (compact) {
      this.makeButton(
        "ターン終了",
        this.panelRect.x + this.panelRect.width - 112,
        this.panelRect.y + 12,
        94,
        32,
        () => {
          this.state = endTurn(this.state);
          this.redraw();
        },
        true,
        0x23424d,
      );
    }
    y += compact ? 26 : 30;
    this.addText(
      x,
      y,
      `${terrainLabel(selected.terrain)} / 支配 ${owner.name} / 前線圧力 ${selected.frontPressure}%`,
      12,
      owner.accentColor,
      700,
      contentWidth,
    );
    y += compact ? 34 : 42;

    this.addText(x, y, "軍団", 13, "#7cecff", 700);
    y += 20;
    this.addText(
      x,
      y,
      `兵力 ${this.state.army.mass}  士気 ${this.state.army.morale}  結束 ${this.state.army.cohesion}\n` +
        `疲労 ${this.state.army.fatigue}  防御 ${this.state.army.toughness.toFixed(2)}  命令 ${this.state.army.commandDelay.toFixed(1)}秒`,
      compact ? 11 : 12,
      "#d8f4ff",
      500,
      contentWidth,
    );
    y += compact ? 42 : 54;

    this.addText(x, y, "内政", 13, "#7cecff", 700);
    y += 22;
    this.drawButtonRow(
      x,
      y,
      contentWidth,
      DOMESTIC_ACTIONS,
      (action) => canUseDomesticOrder(this.state, action.id),
      (action) => {
        this.state = applyDomesticOrder(this.state, action.id);
        this.redraw();
      },
    );
    y += compact ? 38 : 42;

    const relationLine =
      diplomacyTarget && diplomacyTarget.id !== "player"
        ? this.relationLine(diplomacyTarget.id)
        : "外交対象なし";
    this.addText(x, y, `外交: ${relationLine}`, 13, "#7cecff", 700, contentWidth);
    y += 22;
    this.drawButtonRow(
      x,
      y,
      contentWidth,
      DIPLOMACY_ACTIONS,
      (action) => canUseDiplomacyAction(this.state, action.id) && Boolean(diplomacyTarget),
      (action) => {
        this.state = applyDiplomacyAction(this.state, action.id);
        this.redraw();
      },
    );
    y += compact ? 38 : 42;

    this.addText(x, y, "戦闘プレビュー", 13, "#ffd166", 700);
    y += 20;
    this.addPreviewText(x, y, contentWidth, preview, compact);
    y += compact ? 80 : 126;

    const treatyText = relation?.treaties.length
      ? relation.treaties
          .map((treaty) => `${this.treatyLabel(treaty.type)} T${treaty.expiresTurn}まで`)
          .join(" / ")
      : "条約なし";
    if (compact) {
      this.addText(x, y, `条約: ${treatyText}`, 10, "#bad7e4", 500, contentWidth);
      y += 20;
    } else {
      this.addText(x, y, `地域資源: ${resourceText(selected.resources)}\n条約: ${treatyText}`, 11, "#bad7e4", 500, contentWidth);
      y += 52;
    }

    const logTop = compact
      ? this.panelRect.y + this.panelRect.height - 78
      : Math.min(y, this.panelRect.y + this.panelRect.height - 118);
    this.addText(x, logTop, "レポート", 12, "#7cecff", 700);
    this.addText(
      x,
      logTop + 18,
      this.state.reports.slice(0, compact ? 3 : 5).map((report) => `・${report}`).join("\n"),
      compact ? 10 : 11,
      "#d8f4ff",
      500,
      contentWidth,
    );

    if (!compact) {
      this.makeButton(
        "ターン終了",
        this.panelRect.x + this.panelRect.width - 126,
        this.panelRect.y + this.panelRect.height - 48,
        104,
        34,
        () => {
          this.state = endTurn(this.state);
          this.redraw();
        },
        true,
        0x23424d,
      );
    }
  }

  private addPreviewText(
    x: number,
    y: number,
    width: number,
    preview: BattlePreview,
    compact: boolean,
  ): void {
    const text =
      `${preview.title} / 目的 ${preview.objective}\n` +
      `自軍 兵${preview.playerInitial.mass} 士${preview.playerInitial.morale} 結${preview.playerInitial.cohesion} 疲${preview.playerInitial.fatigue}\n` +
      `敵軍 兵${preview.enemyInitial.mass} 士${preview.enemyInitial.morale} 結${preview.enemyInitial.cohesion} 疲${preview.enemyInitial.fatigue}\n` +
      (compact
        ? `${preview.terrainNotes[0]}\n${preview.strategicNotes[0]}`
        : `${preview.terrainNotes[0]}\n${preview.strategicNotes.slice(0, 4).join(" / ")}`);
    this.addText(x, y, text, compact ? 10 : 11, "#eefaff", 500, width);
  }

  private drawButtonRow<T extends { label: string }>(
    x: number,
    y: number,
    width: number,
    actions: T[],
    enabled: (action: T) => boolean,
    onClick: (action: T) => void,
  ): void {
    const gap = 8;
    const columns = width < 320 ? 2 : actions.length;
    const buttonWidth = Math.floor((width - gap * (columns - 1)) / columns);
    actions.forEach((action, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      this.makeButton(
        action.label,
        x + column * (buttonWidth + gap),
        y + row * 36,
        buttonWidth,
        30,
        () => onClick(action),
        enabled(action),
        0x163242,
      );
    });
  }

  private relationLine(factionId: string): string {
    const faction = this.state.factions.find((candidate) => candidate.id === factionId);
    const relation = this.state.relations.find((candidate) => candidate.factionId === factionId);
    if (!faction || !relation) return "不明";
    const treaties = relation.treaties.map((treaty) => this.treatyLabel(treaty.type)).join("/");
    return `${faction.name}  信頼${relation.trust} 恐怖${relation.fear} 借り${relation.debt}${treaties ? `  ${treaties}` : ""}`;
  }

  private treatyLabel(type: string): string {
    if (type === "passage") return "通行";
    if (type === "supply") return "補給";
    return "不可侵";
  }

  private regionPoint(region: RegionNode): { x: number; y: number } {
    return {
      x: this.mapRect.x + this.mapRect.width * region.x,
      y: this.mapRect.y + this.mapRect.height * region.y,
    };
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
      .rectangle(x, y, width, height, enabled ? fillColor : 0x18232a, enabled ? 0.96 : 0.6)
      .setOrigin(0)
      .setStrokeStyle(2, enabled ? 0x7cecff : 0x425462, enabled ? 0.62 : 0.32);
    const text = this.add
      .text(x + width / 2, y + height / 2, label, {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: width < 54 ? "10px" : "12px",
        color: enabled ? "#eafaff" : "#78909c",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

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

  private clearObjects(): void {
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
  }
}
