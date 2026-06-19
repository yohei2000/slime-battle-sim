import Phaser from "phaser";
import type { BattleState } from "../sim/types";

export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(10, 160, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#a7f3d0",
        backgroundColor: "#00120dcc",
        padding: { x: 8, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(130)
      .setVisible(false);
    scene.input.keyboard?.on("keydown-D", () => {
      this.visible = !this.visible;
      this.text.setVisible(this.visible);
    });
  }

  update(state: BattleState): void {
    if (!this.visible) return;
    const { player, enemy } = state;
    this.text.setText(
      [
        `fps ${this.text.scene.game.loop.actualFps.toFixed(1)}`,
        `player nodes ${player.nodes.length} particles ${player.particles.length}`,
        `P w/d ${player.currentWidth.toFixed(1)}/${player.currentDepth.toFixed(1)} zoc ${player.zocStrength.toFixed(2)}`,
        `E w/d ${enemy.currentWidth.toFixed(1)}/${enemy.currentDepth.toFixed(1)} zoc ${enemy.zocStrength.toFixed(2)}`,
        `contacts ${player.contactPatches.length} / ${enemy.contactPatches.length}`,
      ].join("\n"),
    );
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [this.text];
  }
}
