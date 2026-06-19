import Phaser from "phaser";
import { BattleSimulation } from "../sim/simulation";
import type { GesturePreviewState } from "../sim/types";
import { SlimeOverlay } from "../ui/SlimeOverlay";
import { GesturePreview } from "../ui/GesturePreview";
import { MobileHUD } from "../ui/MobileHUD";
import { BattleLog } from "../ui/BattleLog";
import { DebugOverlay } from "../ui/DebugOverlay";
import { TutorialOverlay } from "../ui/TutorialOverlay";
import { CameraController } from "../input/CameraController";
import { TouchInputController } from "../input/TouchInputController";

export class BattleScene extends Phaser.Scene {
  private simulation!: BattleSimulation;
  private slimeOverlay!: SlimeOverlay;
  private gesturePreview!: GesturePreview;
  private hud!: MobileHUD;
  private battleLog!: BattleLog;
  private debugOverlay!: DebugOverlay;
  private cameraController!: CameraController;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private touchController!: TouchInputController;
  private lastPlayerPosture = "neutral";
  private lastEnemyPosture = "neutral";

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.simulation = new BattleSimulation();
    this.simulation.state.paused = true;
    const { width, height } = this.simulation.bounds;
    this.cameras.main.removeBounds();
    this.cameraController = new CameraController(this.cameras.main, width, height);
    this.cameraController.fitAll(this.scale.width, this.scale.height);
    const battlefield = this.drawBattlefield(width, height);

    this.slimeOverlay = new SlimeOverlay(this);
    this.gesturePreview = new GesturePreview(this);
    this.battleLog = new BattleLog(this);
    this.debugOverlay = new DebugOverlay(this);
    this.touchController = new TouchInputController(
      this,
      this.cameraController,
      () => this.simulation.state.player,
      () => this.simulation.state.elapsed,
      (preview: GesturePreviewState) => this.gesturePreview.setState(preview),
    );
    this.hud = new MobileHUD(this, this.simulation.state, {
      togglePause: () => {
        this.simulation.state.paused = !this.simulation.state.paused;
      },
      cycleSpeed: () => this.simulation.cycleSpeed(),
      zoomIn: () => this.cameraController.zoomBy(1.18),
      zoomOut: () => this.cameraController.zoomBy(0.84),
      fitAll: () => this.cameraController.fitAll(this.scale.width, this.scale.height),
      setUiCapture: (value) => this.touchController.setUiCapture(value),
    });
    const tutorial = new TutorialOverlay(this, () => {
      this.simulation.state.paused = false;
      this.battleLog.push("戦闘開始");
    });
    const worldObjects = [
      battlefield,
      ...this.slimeOverlay.objects(),
      ...this.gesturePreview.objects(),
    ];
    const uiObjects = [
      ...this.hud.objects(),
      ...this.battleLog.objects(),
      ...this.debugOverlay.objects(),
      ...tutorial.objects(),
    ];
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, "HudCamera");
    this.uiCamera.setScroll(0, 0).setZoom(1);
    this.uiCamera.ignore(worldObjects);
    this.cameras.main.ignore(uiObjects);
    this.battleLog.push("自軍スライムを選択中");
    this.battleLog.push("形状命令には伝達遅延があります");

    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      this.uiCamera.setSize(gameSize.width, gameSize.height);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.touchController.destroy());
  }

  update(_time: number, delta: number): void {
    this.simulation.update(delta / 1000);
    const { player, enemy } = this.simulation.state;
    this.slimeOverlay.draw([player, enemy], this.time.now);
    this.gesturePreview.draw(player);
    this.hud.update();
    this.debugOverlay.update(this.simulation.state);

    if (player.posture !== this.lastPlayerPosture) {
      this.battleLog.push(`自軍：${player.posture}`);
      this.lastPlayerPosture = player.posture;
    }
    if (enemy.posture !== this.lastEnemyPosture) {
      this.battleLog.push(`敵軍：${enemy.posture}`);
      this.lastEnemyPosture = enemy.posture;
    }
  }

  private drawBattlefield(width: number, height: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics().setDepth(0);
    graphics.fillStyle(0x0a1a23, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.lineStyle(1, 0x1b3a48, 0.34);
    for (let x = 0; x <= width; x += 70) graphics.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 70) graphics.lineBetween(0, y, width, y);
    graphics.lineStyle(2, 0x315463, 0.45);
    graphics.strokeRoundedRect(28, 28, width - 56, height - 56, 24);

    for (let i = 0; i < 14; i += 1) {
      const x = 90 + ((i * 257) % (width - 180));
      const y = 90 + ((i * 173) % (height - 180));
      graphics.fillStyle(0x17313a, 0.28);
      graphics.fillCircle(x, y, 26 + (i % 4) * 12);
    }
    return graphics;
  }
}
