import type {
  BattlePreview,
  CampaignArmy,
  CampaignState,
  DiplomacyActionId,
  DiplomaticRelation,
  DomesticOrderId,
  Faction,
  FactionId,
  RegionId,
  RegionNode,
  RegionResources,
  TerrainType,
  TreatyType,
} from "./types";

const TERRAIN_LABELS: Record<TerrainType, string> = {
  marsh: "湿地",
  plain: "草原",
  forest: "胞子森",
  cavern: "石灰洞",
  salt: "塩湖",
  ruin: "廃墟",
};

const DOMESTIC_COSTS: Record<DomesticOrderId, Partial<RegionResources>> = {
  growth: { nutrient: 4, spores: 1 },
  rest: { nutrient: 2 },
  cohesion: { gel: 2, memory: 1 },
  hardening: { shell: 2, gel: 1 },
};

const DIPLOMACY_COSTS: Record<DiplomacyActionId, Partial<RegionResources>> = {
  passage: { spores: 1, memory: 1 },
  supply: { nutrient: 2, gel: 1 },
  pressure: {},
};

export function createInitialCampaignState(): CampaignState {
  const factions: Faction[] = [
    {
      id: "player",
      name: "Azure Tide",
      color: 0x35d8ff,
      accentColor: "#7cecff",
      battleStyle: "包囲と粘り",
    },
    {
      id: "verdant",
      name: "Verdant Brood",
      color: 0x63d471,
      accentColor: "#9aff9f",
      battleStyle: "増殖重視",
    },
    {
      id: "amber",
      name: "Amber Compact",
      color: 0xf4b45f,
      accentColor: "#ffd18a",
      battleStyle: "防衛と条約",
    },
    {
      id: "salt",
      name: "Salt Choir",
      color: 0xf15d6a,
      accentColor: "#ff91aa",
      battleStyle: "突破と消耗戦",
    },
    {
      id: "glass",
      name: "Glass Remnant",
      color: 0x9c8dff,
      accentColor: "#c5bdff",
      battleStyle: "硬質少数",
    },
  ];

  const regions: RegionNode[] = [
    {
      id: "azure-core",
      name: "蒼核湿地",
      terrain: "marsh",
      ownerFactionId: "player",
      x: 0.18,
      y: 0.52,
      adjacentRegionIds: ["thin-grass", "sporewood"],
      resources: { nutrient: 3, spores: 0, gel: 3, shell: 0, memory: 1 },
      fortification: 18,
      supplyLimit: 120,
      unrest: 4,
      frontPressure: 12,
    },
    {
      id: "thin-grass",
      name: "薄膜草原",
      terrain: "plain",
      ownerFactionId: "player",
      x: 0.34,
      y: 0.74,
      adjacentRegionIds: ["azure-core", "sporewood", "lime-cavern"],
      resources: { nutrient: 2, spores: 1, gel: 1, shell: 0, memory: 0 },
      fortification: 8,
      supplyLimit: 108,
      unrest: 7,
      frontPressure: 16,
    },
    {
      id: "sporewood",
      name: "胞子森",
      terrain: "forest",
      ownerFactionId: "verdant",
      x: 0.43,
      y: 0.47,
      adjacentRegionIds: ["azure-core", "thin-grass", "amber-gate", "salt-lake"],
      resources: { nutrient: 4, spores: 3, gel: 0, shell: 0, memory: 1 },
      fortification: 10,
      supplyLimit: 96,
      unrest: 12,
      frontPressure: 34,
    },
    {
      id: "amber-gate",
      name: "琥珀関門",
      terrain: "cavern",
      ownerFactionId: "amber",
      x: 0.52,
      y: 0.25,
      adjacentRegionIds: ["sporewood", "glass-ruins"],
      resources: { nutrient: 1, spores: 0, gel: 2, shell: 2, memory: 2 },
      fortification: 34,
      supplyLimit: 72,
      unrest: 5,
      frontPressure: 18,
    },
    {
      id: "salt-lake",
      name: "塩湖縁",
      terrain: "salt",
      ownerFactionId: "salt",
      x: 0.68,
      y: 0.61,
      adjacentRegionIds: ["sporewood", "lime-cavern", "glass-ruins"],
      resources: { nutrient: 0, spores: 0, gel: 1, shell: 3, memory: 0 },
      fortification: 12,
      supplyLimit: 68,
      unrest: 18,
      frontPressure: 48,
    },
    {
      id: "glass-ruins",
      name: "硝子廃墟",
      terrain: "ruin",
      ownerFactionId: "glass",
      x: 0.82,
      y: 0.32,
      adjacentRegionIds: ["amber-gate", "salt-lake"],
      resources: { nutrient: 0, spores: 0, gel: 1, shell: 3, memory: 4 },
      fortification: 22,
      supplyLimit: 64,
      unrest: 9,
      frontPressure: 26,
    },
    {
      id: "lime-cavern",
      name: "石灰洞",
      terrain: "cavern",
      ownerFactionId: "salt",
      x: 0.56,
      y: 0.82,
      adjacentRegionIds: ["thin-grass", "salt-lake"],
      resources: { nutrient: 1, spores: 0, gel: 2, shell: 2, memory: 0 },
      fortification: 28,
      supplyLimit: 70,
      unrest: 10,
      frontPressure: 39,
    },
  ];

  return {
    turn: 1,
    selectedRegionId: "sporewood",
    resources: { nutrient: 10, spores: 6, gel: 5, shell: 3, memory: 4 },
    regions,
    factions,
    relations: [
      relation("verdant", "warm", 54, 12),
      relation("amber", "neutral", 48, 10),
      relation("salt", "hostile", 18, 28),
      relation("glass", "cold", 34, 16),
    ],
    army: {
      regionId: "azure-core",
      mass: 100,
      morale: 84,
      cohesion: 86,
      fatigue: 12,
      toughness: 0.68,
      commandDelay: 0.4,
    },
    domesticUsed: false,
    diplomacyUsed: false,
    reports: [
      "戦略マップを展開しました",
      "胞子森では Verdant Brood が境界を押しています",
      "内政と外交を1手ずつ試せます",
    ],
  };
}

export function selectRegion(state: CampaignState, regionId: RegionId): CampaignState {
  return {
    ...state,
    selectedRegionId: regionId,
    reports: pushReport(state, `${regionById(state, regionId).name} を確認中`),
  };
}

export function applyDomesticOrder(
  state: CampaignState,
  orderId: DomesticOrderId,
): CampaignState {
  if (state.domesticUsed) {
    return withReport(state, "内政命令はこのターンすでに実行済みです");
  }
  const cost = DOMESTIC_COSTS[orderId];
  if (!canPay(state.resources, cost)) {
    return withReport(state, "資源が足りません");
  }

  const army = { ...state.army };
  const resources = pay(state.resources, cost);
  let report = "";

  if (orderId === "growth") {
    army.mass += 8;
    army.cohesion = clamp(army.cohesion - 6, 0, 100);
    army.fatigue = clamp(army.fatigue + 3, 0, 100);
    army.commandDelay = round1(army.commandDelay + 0.08);
    report = "増殖槽を開放: 質量+8、結束と即応性が低下";
  }
  if (orderId === "rest") {
    army.fatigue = clamp(army.fatigue - 14, 0, 100);
    army.morale = clamp(army.morale + 2, 0, 100);
    army.commandDelay = round1(Math.max(0.1, army.commandDelay - 0.04));
    report = "休眠回復: 疲労を大きく下げ、命令伝達も少し安定";
  }
  if (orderId === "cohesion") {
    army.cohesion = clamp(army.cohesion + 8, 0, 100);
    army.morale = clamp(army.morale + 5, 0, 100);
    army.commandDelay = round1(Math.max(0.1, army.commandDelay - 0.1));
    report = "結束儀式: 士気と結束を上げ、包囲維持に強くなる";
  }
  if (orderId === "hardening") {
    army.toughness = round2(clamp(army.toughness + 0.04, 0.42, 0.9));
    army.fatigue = clamp(army.fatigue + 2, 0, 100);
    army.commandDelay = round1(army.commandDelay + 0.05);
    report = "外殻硬化: 靱性が上がるが、少し重くなる";
  }

  return {
    ...state,
    resources,
    army,
    domesticUsed: true,
    reports: pushReport(state, report),
  };
}

export function applyDiplomacyAction(
  state: CampaignState,
  actionId: DiplomacyActionId,
): CampaignState {
  if (state.diplomacyUsed) {
    return withReport(state, "外交行動はこのターンすでに実行済みです");
  }

  const targetFaction = targetFactionForSelectedRegion(state);
  if (!targetFaction || targetFaction.id === "player") {
    return withReport(state, "この地域には外交対象がいません");
  }
  const cost = DIPLOMACY_COSTS[actionId];
  if (!canPay(state.resources, cost)) {
    return withReport(state, "外交に必要な資源が足りません");
  }

  const resources = pay(state.resources, cost);
  const relations = state.relations.map((relation) => {
    if (relation.factionId !== targetFaction.id) return relation;
    if (actionId === "passage") {
      return addTreaty(
        {
          ...relation,
          trust: clamp(relation.trust + 8, 0, 100),
          debt: relation.debt + 1,
        },
        "passage",
        state.turn + 4,
      );
    }
    if (actionId === "supply") {
      return addTreaty(
        {
          ...relation,
          trust: clamp(relation.trust + 5, 0, 100),
          debt: relation.debt + 2,
        },
        "supply",
        state.turn + 3,
      );
    }
    return {
      ...relation,
      trust: clamp(relation.trust - 5, 0, 100),
      fear: clamp(relation.fear + 10, 0, 100),
      grievance: [...relation.grievance, `T${state.turn}: 境界で威圧`].slice(-3),
    };
  });

  const regions = state.regions.map((region) => {
    if (region.ownerFactionId !== targetFaction.id || actionId !== "pressure") {
      return region;
    }
    return {
      ...region,
      frontPressure: clamp(region.frontPressure - 8, 0, 100),
      unrest: clamp(region.unrest + 4, 0, 100),
    };
  });

  const label =
    actionId === "passage"
      ? "通行条約を打診"
      : actionId === "supply"
        ? "補給協定を締結"
        : "境界威圧を実行";

  return {
    ...state,
    resources,
    regions,
    relations,
    diplomacyUsed: true,
    reports: pushReport(state, `${targetFaction.name}: ${label}`),
  };
}

export function endTurn(state: CampaignState): CampaignState {
  const collected = state.regions
    .filter((region) => region.ownerFactionId === "player")
    .reduce(
      (total, region) => addResources(total, region.resources),
      state.resources,
    );

  const relations = state.relations.map((relation) => ({
    ...relation,
    treaties: relation.treaties.filter((treaty) => treaty.expiresTurn > state.turn + 1),
    fear: clamp(relation.fear - 1, 0, 100),
  }));

  const regions = state.regions.map((region, index) => {
    const hostileBorder = region.adjacentRegionIds.some((id) => {
      const adjacent = regionById(state, id);
      return adjacent.ownerFactionId === "salt" || adjacent.ownerFactionId === "glass";
    });
    const treatyEase = relationForFactionId(state, region.ownerFactionId)?.treaties.length ?? 0;
    const pressureDelta =
      region.ownerFactionId === "player"
        ? hostileBorder
          ? 3
          : -2
        : region.ownerFactionId === "salt"
          ? 6
          : region.ownerFactionId === "verdant"
            ? 2
            : 1;
    return {
      ...region,
      frontPressure: clamp(
        region.frontPressure +
          pressureDelta -
          Math.floor(region.fortification / 18) -
          treatyEase * 2 +
          ((state.turn + index) % 3 === 0 ? 2 : 0),
        0,
        100,
      ),
      unrest: clamp(region.unrest + (region.ownerFactionId === "player" ? -1 : 1), 0, 100),
    };
  });

  const hasSupplyTreaty = state.relations.some((relation) =>
    relation.treaties.some((treaty) => treaty.type === "supply"),
  );
  const army: CampaignArmy = {
    ...state.army,
    morale: clamp(state.army.morale + 1, 0, 100),
    cohesion: clamp(state.army.cohesion + 1, 0, 100),
    fatigue: clamp(state.army.fatigue - (hasSupplyTreaty ? 6 : 4), 0, 100),
  };

  return {
    ...state,
    turn: state.turn + 1,
    resources: collected,
    regions,
    relations,
    army,
    domesticUsed: false,
    diplomacyUsed: false,
    reports: pushReport(
      state,
      `ターン${state.turn + 1}: 自領から資源を回収し、前線圧力が更新されました`,
    ),
  };
}

export function battlePreview(state: CampaignState): BattlePreview {
  const region = selectedRegion(state);
  const owner = factionById(state, region.ownerFactionId);
  const relation = relationForFactionId(state, region.ownerFactionId);
  const hasSupply = Boolean(relation?.treaties.some((treaty) => treaty.type === "supply"));
  const hasPassage = Boolean(relation?.treaties.some((treaty) => treaty.type === "passage"));
  const terrainNotes = terrainBattleNotes(region.terrain);
  const playerInitial = {
    mass: state.army.mass,
    morale: clamp(state.army.morale + (hasPassage ? 2 : 0), 0, 100),
    cohesion: clamp(state.army.cohesion + (region.terrain === "forest" ? 3 : 0), 0, 100),
    fatigue: clamp(
      state.army.fatigue +
        (region.terrain === "salt" ? 8 : 0) -
        (hasSupply ? 5 : 0),
      0,
      100,
    ),
    toughness: state.army.toughness,
    commandDelay: round1(Math.max(0.1, state.army.commandDelay - (hasPassage ? 0.08 : 0))),
  };
  const enemyInitial = enemySeedForFaction(owner.id, region);

  const objective =
    region.ownerFactionId === "player"
      ? "Hold"
      : region.frontPressure >= 42
        ? "Breakthrough"
        : "Rout";

  return {
    title:
      region.ownerFactionId === "player"
        ? `${region.name} 防衛`
        : `${region.name} 侵攻`,
    objective,
    playerInitial,
    enemyInitial,
    terrainNotes,
    strategicNotes: [
      `${owner.name}: ${owner.battleStyle}`,
      `前線圧力 ${region.frontPressure}%`,
      hasSupply ? "補給協定により初期疲労-5" : "補給協定なし",
      hasPassage ? "通行条約により命令遅延が軽い" : "通行条約なし",
    ],
  };
}

export function selectedRegion(state: CampaignState): RegionNode {
  return regionById(state, state.selectedRegionId);
}

export function factionById(state: CampaignState, factionId: FactionId): Faction {
  const faction = state.factions.find((candidate) => candidate.id === factionId);
  if (!faction) throw new Error(`Unknown faction: ${factionId}`);
  return faction;
}

export function relationForFactionId(
  state: CampaignState,
  factionId: FactionId,
): DiplomaticRelation | undefined {
  return state.relations.find((relation) => relation.factionId === factionId);
}

export function targetFactionForSelectedRegion(state: CampaignState): Faction | undefined {
  const selected = selectedRegion(state);
  if (selected.ownerFactionId !== "player") return factionById(state, selected.ownerFactionId);

  const adjacent = selected.adjacentRegionIds
    .map((id) => regionById(state, id))
    .filter((region) => region.ownerFactionId !== "player")
    .sort((a, b) => b.frontPressure - a.frontPressure)[0];
  return adjacent ? factionById(state, adjacent.ownerFactionId) : undefined;
}

export function terrainLabel(terrain: TerrainType): string {
  return TERRAIN_LABELS[terrain];
}

export function canUseDomesticOrder(state: CampaignState, orderId: DomesticOrderId): boolean {
  return !state.domesticUsed && canPay(state.resources, DOMESTIC_COSTS[orderId]);
}

export function canUseDiplomacyAction(
  state: CampaignState,
  actionId: DiplomacyActionId,
): boolean {
  return !state.diplomacyUsed && canPay(state.resources, DIPLOMACY_COSTS[actionId]);
}

export function resourceText(resources: RegionResources): string {
  return `栄養 ${resources.nutrient}  胞子 ${resources.spores}  粘液 ${resources.gel}  外殻 ${resources.shell}  記憶 ${resources.memory}`;
}

function relation(
  factionId: FactionId,
  attitude: DiplomaticRelation["attitude"],
  trust: number,
  fear: number,
): DiplomaticRelation {
  return {
    factionId,
    attitude,
    trust,
    fear,
    debt: 0,
    treaties: [],
    grievance: [],
  };
}

function enemySeedForFaction(factionId: FactionId, region: RegionNode) {
  const pressure = region.frontPressure / 100;
  if (factionId === "salt") {
    return {
      mass: Math.round(92 + pressure * 26),
      morale: Math.round(78 + pressure * 10),
      cohesion: Math.round(72 + pressure * 8),
      fatigue: Math.round(12 + pressure * 8),
      toughness: 0.7,
      commandDelay: 0.45,
    };
  }
  if (factionId === "glass") {
    return {
      mass: 76,
      morale: 76,
      cohesion: 88,
      fatigue: 10,
      toughness: 0.82,
      commandDelay: 0.55,
    };
  }
  if (factionId === "amber") {
    return {
      mass: 90,
      morale: 86,
      cohesion: 88,
      fatigue: 8,
      toughness: 0.74,
      commandDelay: 0.36,
    };
  }
  return {
    mass: Math.round(108 + pressure * 18),
    morale: 72,
    cohesion: 68,
    fatigue: 14,
    toughness: 0.64,
    commandDelay: 0.62,
  };
}

function terrainBattleNotes(terrain: TerrainType): string[] {
  if (terrain === "marsh") return ["湿地: 粘性が上がり、突破が鈍る"];
  if (terrain === "forest") return ["胞子森: 結束が戻りやすいが、接触線が乱れやすい"];
  if (terrain === "cavern") return ["石灰洞: 戦線幅が狭く、包囲が難しい"];
  if (terrain === "salt") return ["塩湖: 初期疲労が増え、長期戦が危険"];
  if (terrain === "ruin") return ["廃墟: 外殻と記憶資源が多く、硬い敵が出やすい"];
  return ["草原: 幅を取りやすく、包囲と突破の両方が起きる"];
}

function regionById(state: CampaignState, regionId: RegionId): RegionNode {
  const region = state.regions.find((candidate) => candidate.id === regionId);
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  return region;
}

function canPay(resources: RegionResources, cost: Partial<RegionResources>): boolean {
  return (
    resources.nutrient >= (cost.nutrient ?? 0) &&
    resources.spores >= (cost.spores ?? 0) &&
    resources.gel >= (cost.gel ?? 0) &&
    resources.shell >= (cost.shell ?? 0) &&
    resources.memory >= (cost.memory ?? 0)
  );
}

function pay(resources: RegionResources, cost: Partial<RegionResources>): RegionResources {
  return {
    nutrient: resources.nutrient - (cost.nutrient ?? 0),
    spores: resources.spores - (cost.spores ?? 0),
    gel: resources.gel - (cost.gel ?? 0),
    shell: resources.shell - (cost.shell ?? 0),
    memory: resources.memory - (cost.memory ?? 0),
  };
}

function addResources(left: RegionResources, right: RegionResources): RegionResources {
  return {
    nutrient: left.nutrient + right.nutrient,
    spores: left.spores + right.spores,
    gel: left.gel + right.gel,
    shell: left.shell + right.shell,
    memory: left.memory + right.memory,
  };
}

function addTreaty(
  relation: DiplomaticRelation,
  treatyType: TreatyType,
  expiresTurn: number,
): DiplomaticRelation {
  const treaties = relation.treaties.filter((treaty) => treaty.type !== treatyType);
  return {
    ...relation,
    treaties: [...treaties, { type: treatyType, expiresTurn }],
  };
}

function withReport(state: CampaignState, report: string): CampaignState {
  return { ...state, reports: pushReport(state, report) };
}

function pushReport(state: CampaignState, report: string): string[] {
  return [report, ...state.reports].slice(0, 5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
