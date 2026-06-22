export type SlimeSkillId =
  | "membrane-ripple"
  | "boring-tendril"
  | "spore-core"
  | "nerve-gel"
  | "shell-grains"
  | "absorption-vacuole"
  | "zoc-ring";

export type SkillSlotState = {
  index: number;
  skillId?: SlimeSkillId;
  level: number;
  evolved: boolean;
};

export type BattleGrowthModifier = {
  mass: number;
  morale: number;
  cohesion: number;
  fatigue: number;
  toughness: number;
  commandDelay: number;
  breakthroughPower: number;
  envelopPower: number;
  zocStrength: number;
  splitResist: number;
};

export type SlimeSkillDefinition = {
  id: SlimeSkillId;
  name: string;
  shortName: string;
  organ: string;
  artKey: string;
  color: number;
  accent: string;
  maxLevel: number;
  stateText: string;
  operationText: string;
  behaviorText: string;
  weaknessText: string;
  effectPerLevel: Partial<BattleGrowthModifier>;
  evolvesWith?: SlimeSkillId;
  evolvedName?: string;
  evolvedText?: string;
  evolvedBonus?: Partial<BattleGrowthModifier>;
};

export type SkillChoice = {
  skillId: SlimeSkillId;
  kind: "new" | "level" | "evolve";
};

export type SlimeGrowthState = {
  slimeLevel: number;
  wave: number;
  rerolls: number;
  slots: SkillSlotState[];
  choices: SkillChoice[];
  reports: string[];
};

export const EMPTY_MODIFIER: BattleGrowthModifier = {
  mass: 0,
  morale: 0,
  cohesion: 0,
  fatigue: 0,
  toughness: 0,
  commandDelay: 0,
  breakthroughPower: 0,
  envelopPower: 0,
  zocStrength: 0,
  splitResist: 0,
};

export const SKILL_DEFINITIONS: SlimeSkillDefinition[] = [
  {
    id: "membrane-ripple",
    name: "散兵展開教範",
    shortName: "散兵",
    organ: "歩兵教練",
    artKey: "skill-membrane-ripple-20260621b",
    color: 0x35d8ff,
    accent: "#7cecff",
    maxLevel: 5,
    stateText: "訓練所と下士官学校を整備。",
    operationText: "分隊長が間隔を読み横隊を保つ。",
    behaviorText: "薄い散兵線で側面を包む。",
    weaknessText: "伝令が弱いと薄部から割れる。",
    effectPerLevel: { envelopPower: 5, cohesion: 2, zocStrength: 2 },
    evolvesWith: "nerve-gel",
    evolvedName: "自律分隊網",
    evolvedText: "分隊長の判断が横へ伝わり、命令を待たず薄い包囲線を補う。",
    evolvedBonus: { envelopPower: 10, commandDelay: -0.12, splitResist: 8 },
  },
  {
    id: "boring-tendril",
    name: "突撃工兵隊",
    shortName: "工兵",
    organ: "工兵学校",
    artKey: "skill-boring-tendril-20260621b",
    color: 0xffd166,
    accent: "#ffd166",
    maxLevel: 5,
    stateText: "鉱夫・架橋職人・爆薬係を常備。",
    operationText: "障害を壊し突破路へ兵を入れる。",
    behaviorText: "一点に縦隊を刺し、敵面を割る。",
    weaknessText: "失敗時は前列だけ孤立。",
    effectPerLevel: { breakthroughPower: 7, fatigue: 1, morale: 1 },
    evolvesWith: "shell-grains",
    evolvedName: "破城縦隊",
    evolvedText: "工兵、盾兵、予備隊が一列に連なり、戦線へ杭のように刺さる。",
    evolvedBonus: { breakthroughPower: 16, toughness: 0.03, fatigue: 2 },
  },
  {
    id: "spore-core",
    name: "兵站補充制",
    shortName: "補充",
    organ: "兵站局",
    artKey: "skill-spore-core-20260621b",
    color: 0x63d471,
    accent: "#9aff9f",
    maxLevel: 5,
    stateText: "徴募・糧秣・予備隊名簿を統合。",
    operationText: "欠けた隊列へ兵と物資を送る。",
    behaviorText: "削られても厚みと圧力を戻す。",
    weaknessText: "補給線切断で一気に鈍る。",
    effectPerLevel: { mass: 4, morale: 2, fatigue: -1 },
    evolvesWith: "absorption-vacuole",
    evolvedName: "継戦補給網",
    evolvedText: "荷馬車、救護、予備兵が一体で動き、崩れた戦列を戦場で継ぎ足す。",
    evolvedBonus: { mass: 12, morale: 6, cohesion: 4 },
  },
  {
    id: "nerve-gel",
    name: "参謀伝令網",
    shortName: "伝令",
    organ: "参謀本部",
    artKey: "skill-nerve-gel-20260621b",
    color: 0x9c8dff,
    accent: "#c5bdff",
    maxLevel: 5,
    stateText: "参謀本部・旗号・騎馬伝令を常設。",
    operationText: "目的と退路を短命令で共有。",
    behaviorText: "輪郭が早く向き直り包囲維持。",
    weaknessText: "指揮所攪乱で判断が遅れる。",
    effectPerLevel: { commandDelay: -0.05, cohesion: 2, zocStrength: 1 },
    evolvesWith: "membrane-ripple",
    evolvedName: "任務指揮",
    evolvedText: "目的だけを共有し、部隊が局地判断で半拍早く形を変える。",
    evolvedBonus: { commandDelay: -0.18, cohesion: 6, envelopPower: 5 },
  },
  {
    id: "shell-grains",
    name: "隊列規律",
    shortName: "隊列",
    organ: "軍紀",
    artKey: "skill-shell-grains-20260621b",
    color: 0xf4b45f,
    accent: "#ffd18a",
    maxLevel: 5,
    stateText: "軍紀・盾列訓練・交代位置を法制化。",
    operationText: "号令で詰め、割れ目へ予備を入れる。",
    behaviorText: "塊のまま押し返し分断に耐える。",
    weaknessText: "展開と命令変更が遅い。",
    effectPerLevel: { toughness: 0.025, splitResist: 4, commandDelay: 0.015 },
    evolvesWith: "boring-tendril",
    evolvedName: "予備隊交代制",
    evolvedText: "割れた箇所へ予備隊が入り、次の裂け目を止める。",
    evolvedBonus: { toughness: 0.08, splitResist: 12, morale: 3 },
  },
  {
    id: "absorption-vacuole",
    name: "野戦救護班",
    shortName: "救護",
    organ: "衛生隊",
    artKey: "skill-absorption-vacuole-20260621b",
    color: 0xff91aa,
    accent: "#ff91aa",
    maxLevel: 5,
    stateText: "軍医・担架兵・後送路を部隊化。",
    operationText: "軽傷者を戻し重傷者を後送。",
    behaviorText: "前線の穴が塞がり崩れにくい。",
    weaknessText: "追撃戦では救護が遅れる。",
    effectPerLevel: { mass: 3, fatigue: -2, morale: 1 },
    evolvesWith: "spore-core",
    evolvedName: "後送補充線",
    evolvedText: "救護所と補充所がつながり、敗走寸前の部隊へ人員を戻す。",
    evolvedBonus: { mass: 10, fatigue: -8, morale: 4 },
  },
  {
    id: "zoc-ring",
    name: "戦線管制班",
    shortName: "管制",
    organ: "戦線司令",
    artKey: "skill-zoc-ring-20260621b",
    color: 0x2bd6a3,
    accent: "#6fffd0",
    maxLevel: 5,
    stateText: "前哨線・側面警戒・予備隊を標準化。",
    operationText: "抜け道へ小隊を置き逃走を鈍らせる。",
    behaviorText: "軍の外縁を閉じ包囲を維持。",
    weaknessText: "正面突破力は伸びにくい。",
    effectPerLevel: { zocStrength: 5, envelopPower: 3, cohesion: 1 },
    evolvesWith: "membrane-ripple",
    evolvedName: "包囲管制網",
    evolvedText: "散兵線と予備隊が同期し、薄い包囲線でも逃げ道をふさぐ。",
    evolvedBonus: { zocStrength: 14, envelopPower: 8, splitResist: 5 },
  },
];

export function createInitialGrowthState(): SlimeGrowthState {
  const state: SlimeGrowthState = {
    slimeLevel: 1,
    wave: 1,
    rerolls: 2,
    slots: Array.from({ length: 6 }, (_, index) => ({
      index,
      level: 0,
      evolved: false,
    })),
    choices: [],
    reports: ["軍制はまだ白紙です", "3つの軍制候補から1つを選びます"],
  };
  return { ...state, choices: generateChoices(state) };
}

export function rerollChoices(state: SlimeGrowthState): SlimeGrowthState {
  if (state.rerolls <= 0) {
    return withReport(state, "追加提案を出せる参謀がいません");
  }
  const next = {
    ...state,
    rerolls: state.rerolls - 1,
    wave: state.wave + 1,
  };
  return {
    ...next,
    choices: generateChoices(next),
    reports: pushReport(next, "軍制候補を再提案しました"),
  };
}

export function applySkillChoice(
  state: SlimeGrowthState,
  skillId: SlimeSkillId,
): SlimeGrowthState {
  const definition = skillDefinition(skillId);
  const slotIndex = state.slots.findIndex((slot) => slot.skillId === skillId);
  const nextSlots = state.slots.map((slot) => ({ ...slot }));
  let report = "";

  if (slotIndex >= 0) {
    const slot = nextSlots[slotIndex];
    if (slot.level >= definition.maxLevel) {
      if (canEvolve(nextSlots, definition)) {
        slot.evolved = true;
        report = `${definition.name} が ${definition.evolvedName ?? "改制形"} へ改制`;
      } else {
        report = `${definition.name} は上限です。連携する軍制が必要です`;
      }
    } else {
      slot.level += 1;
      report = `${definition.name} Lv.${slot.level}`;
      if (slot.level >= definition.maxLevel && canEvolve(nextSlots, definition)) {
        slot.evolved = true;
        report = `${definition.name} が ${definition.evolvedName ?? "改制形"} へ改制`;
      }
    }
  } else {
    const emptyIndex = nextSlots.findIndex((slot) => !slot.skillId);
    if (emptyIndex < 0) {
      return withReport(state, "空きスロットがありません");
    }
    nextSlots[emptyIndex] = {
      ...nextSlots[emptyIndex],
      skillId,
      level: 1,
      evolved: false,
    };
    report = `${definition.name} を教範枠${emptyIndex + 1}に採用`;
  }

  const next = {
    ...state,
    slimeLevel: state.slimeLevel + 1,
    wave: state.wave + 1,
    slots: nextSlots,
  };
  return {
    ...next,
    choices: generateChoices(next),
    reports: pushReport(next, report),
  };
}

export function aggregateModifier(state: SlimeGrowthState): BattleGrowthModifier {
  return state.slots.reduce((total, slot) => {
    if (!slot.skillId || slot.level <= 0) return total;
    const definition = skillDefinition(slot.skillId);
    const perLevel = multiplyModifier(definition.effectPerLevel, slot.level);
    const evolved = slot.evolved ? definition.evolvedBonus ?? {} : {};
    return addModifier(addModifier(total, perLevel), evolved);
  }, { ...EMPTY_MODIFIER });
}

export function battleProjection(state: SlimeGrowthState) {
  const modifier = aggregateModifier(state);
  return {
    mass: Math.round(100 + modifier.mass),
    morale: Math.round(84 + modifier.morale),
    cohesion: Math.round(86 + modifier.cohesion),
    fatigue: Math.max(0, Math.round(12 + modifier.fatigue)),
    toughness: round2(0.68 + modifier.toughness),
    commandDelay: round2(Math.max(0.08, 0.4 + modifier.commandDelay)),
    breakthroughPower: Math.round(50 + modifier.breakthroughPower),
    envelopPower: Math.round(50 + modifier.envelopPower),
    zocStrength: Math.round(100 + modifier.zocStrength),
    splitResist: Math.round(modifier.splitResist),
  };
}

export function buildArchetype(state: SlimeGrowthState): string {
  const projection = battleProjection(state);
  if (projection.breakthroughPower >= projection.envelopPower + 18) return "突破縦隊型";
  if (projection.envelopPower >= projection.breakthroughPower + 14) return "包囲機動型";
  if (projection.toughness >= 0.86 || projection.splitResist >= 28) return "防御規律型";
  if (projection.commandDelay <= 0.18) return "任務指揮型";
  if (projection.mass >= 130) return "補充圧力型";
  return "未編成軍団";
}

export function skillDefinition(skillId: SlimeSkillId): SlimeSkillDefinition {
  const definition = SKILL_DEFINITIONS.find((candidate) => candidate.id === skillId);
  if (!definition) throw new Error(`Unknown skill: ${skillId}`);
  return definition;
}

export function slotLabel(slot: SkillSlotState): string {
  if (!slot.skillId) return "空き";
  const definition = skillDefinition(slot.skillId);
  return slot.evolved ? definition.evolvedName ?? definition.name : definition.shortName;
}

export function choiceKindLabel(choice: SkillChoice): string {
  if (choice.kind === "new") return "新規軍制";
  if (choice.kind === "evolve") return "改制";
  return "強化";
}

function generateChoices(state: SlimeGrowthState): SkillChoice[] {
  const pool = choicePool(state);
  const choices: SkillChoice[] = [];
  const start = (state.wave * 3 + state.slimeLevel) % Math.max(1, pool.length);
  for (let offset = 0; choices.length < 3 && offset < pool.length + 3; offset += 1) {
    const candidate = pool[(start + offset * 2) % pool.length];
    if (!candidate) break;
    if (choices.some((choice) => choice.skillId === candidate.skillId)) continue;
    choices.push(candidate);
  }
  return choices;
}

function choicePool(state: SlimeGrowthState): SkillChoice[] {
  const choices: SkillChoice[] = [];
  const ownedIds = state.slots
    .map((slot) => slot.skillId)
    .filter((skillId): skillId is SlimeSkillId => Boolean(skillId));
  const hasEmptySlot = state.slots.some((slot) => !slot.skillId);

  for (const skillId of ownedIds) {
    const definition = skillDefinition(skillId);
    const slot = state.slots.find((candidate) => candidate.skillId === skillId);
    if (!slot) continue;
    if (slot.level >= definition.maxLevel && !slot.evolved && canEvolve(state.slots, definition)) {
      choices.push({ skillId, kind: "evolve" });
    } else if (slot.level < definition.maxLevel) {
      choices.push({ skillId, kind: "level" });
    }
  }

  if (hasEmptySlot) {
    for (const definition of SKILL_DEFINITIONS) {
      if (!ownedIds.includes(definition.id)) {
        choices.push({ skillId: definition.id, kind: "new" });
      }
    }
  }

  return choices.length ? choices : ownedIds.map((skillId) => ({ skillId, kind: "level" }));
}

function canEvolve(slots: SkillSlotState[], definition: SlimeSkillDefinition): boolean {
  if (!definition.evolvesWith) return false;
  const partner = slots.find((slot) => slot.skillId === definition.evolvesWith);
  return Boolean(partner && partner.level > 0);
}

function withReport(state: SlimeGrowthState, report: string): SlimeGrowthState {
  return { ...state, reports: pushReport(state, report) };
}

function pushReport(state: SlimeGrowthState, report: string): string[] {
  return [report, ...state.reports].slice(0, 5);
}

function addModifier(
  left: BattleGrowthModifier,
  right: Partial<BattleGrowthModifier>,
): BattleGrowthModifier {
  return {
    mass: left.mass + (right.mass ?? 0),
    morale: left.morale + (right.morale ?? 0),
    cohesion: left.cohesion + (right.cohesion ?? 0),
    fatigue: left.fatigue + (right.fatigue ?? 0),
    toughness: left.toughness + (right.toughness ?? 0),
    commandDelay: left.commandDelay + (right.commandDelay ?? 0),
    breakthroughPower: left.breakthroughPower + (right.breakthroughPower ?? 0),
    envelopPower: left.envelopPower + (right.envelopPower ?? 0),
    zocStrength: left.zocStrength + (right.zocStrength ?? 0),
    splitResist: left.splitResist + (right.splitResist ?? 0),
  };
}

function multiplyModifier(
  modifier: Partial<BattleGrowthModifier>,
  multiplier: number,
): Partial<BattleGrowthModifier> {
  return Object.fromEntries(
    Object.entries(modifier).map(([key, value]) => [key, value * multiplier]),
  ) as Partial<BattleGrowthModifier>;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
