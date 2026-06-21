export type FactionId = "player" | "verdant" | "amber" | "salt" | "glass";

export type RegionId =
  | "azure-core"
  | "thin-grass"
  | "sporewood"
  | "amber-gate"
  | "salt-lake"
  | "glass-ruins"
  | "lime-cavern";

export type TerrainType =
  | "marsh"
  | "plain"
  | "forest"
  | "cavern"
  | "salt"
  | "ruin";

export type TreatyType = "passage" | "supply" | "nonaggression";

export type DomesticOrderId = "growth" | "rest" | "cohesion" | "hardening";

export type DiplomacyActionId = "passage" | "supply" | "pressure";

export type RegionResources = {
  nutrient: number;
  spores: number;
  gel: number;
  shell: number;
  memory: number;
};

export type RegionNode = {
  id: RegionId;
  name: string;
  terrain: TerrainType;
  ownerFactionId: FactionId;
  x: number;
  y: number;
  adjacentRegionIds: RegionId[];
  resources: RegionResources;
  fortification: number;
  supplyLimit: number;
  unrest: number;
  frontPressure: number;
};

export type Treaty = {
  type: TreatyType;
  expiresTurn: number;
};

export type DiplomaticRelation = {
  factionId: FactionId;
  attitude: "war" | "hostile" | "cold" | "neutral" | "warm" | "allied";
  trust: number;
  fear: number;
  debt: number;
  treaties: Treaty[];
  grievance: string[];
};

export type Faction = {
  id: FactionId;
  name: string;
  color: number;
  accentColor: string;
  battleStyle: string;
};

export type CampaignArmy = {
  regionId: RegionId;
  mass: number;
  morale: number;
  cohesion: number;
  fatigue: number;
  toughness: number;
  commandDelay: number;
};

export type CampaignState = {
  turn: number;
  selectedRegionId: RegionId;
  resources: RegionResources;
  regions: RegionNode[];
  factions: Faction[];
  relations: DiplomaticRelation[];
  army: CampaignArmy;
  domesticUsed: boolean;
  diplomacyUsed: boolean;
  reports: string[];
};

export type ArmySeed = {
  mass: number;
  morale: number;
  cohesion: number;
  fatigue: number;
  toughness: number;
  commandDelay: number;
};

export type BattlePreview = {
  title: string;
  objective: "Hold" | "Breakthrough" | "Rout" | "Escape";
  playerInitial: ArmySeed;
  enemyInitial: ArmySeed;
  terrainNotes: string[];
  strategicNotes: string[];
};
