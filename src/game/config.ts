import Phaser from "phaser";
import { BattleScene } from "./BattleScene";
import { SlimeGrowthScene } from "./SlimeGrowthScene";
import { StrategyMapScene } from "./StrategyMapScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#071118",
  scene: [SlimeGrowthScene, StrategyMapScene, BattleScene],
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    activePointers: 3,
    touch: {
      capture: true,
    },
  },
};
