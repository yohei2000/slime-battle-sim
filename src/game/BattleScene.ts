import Phaser from "phaser";
import { BattleSimulation } from "../sim/simulation";
import type { GesturePreviewState } from "../sim/types";
import { SlimeOverlay } from "../ui/SlimeOverlay";
import { GesturePreview } from "../ui/GesturePreview";
import { MobileHUD } from "../ui/MobileHUD";
import { BattleLog } from "../ui/BattleLog";
import { DebugOverlay } from "../ui/DebugOverlay";
import { TutorialOverlay } from "../ui/TutorialOverlay";
import { BattleResultOverlay } from "../ui/BattleResultOverlay";
import { CameraController } from "../input/CameraController";
import { TouchInputController } from "../input/TouchInputController";
import type { BattleResultPayload } from "./battleResult";

export class BattleScene extends Phaser.Scene {
  private simulation!: BattleSimulation;
  private slimeOverlay!: SlimeOverlay;
  private gesturePreview!: GesturePreview;
  private hud!: MobileHUD;
  private battleLog!: BattleLog;
  private debugOverlay!: DebugOverlay;
  private resultOverlay!: BattleResultOverlay;
  private cameraController!: CameraController;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private touchController!: TouchInputController;
  private resultReturnEvent?: Phaser.Time.TimerEvent;
  private resultPayload?: BattleResultPayload;
  private lastPlayerPosture = "neutral";
  private lastEnemyPosture = "neutral";
  private stressDetail = false;
  private lastStressBand = 0;
  private resultShown = false;
  private returningToStrategy = false;
  private resultShownAtMs = 0;

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
    this.resultOverlay = new BattleResultOverlay(this, () => this.returnToStrategy());
    this.touchController = new TouchInputController(
      this,
      this.cameraController,
      () => this.simulation.state.playerSlimes,
      () => this.simulation.state.enemySlimes,
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
      toggleStress: () => {
        this.stressDetail = !this.stressDetail;
        this.slimeOverlay.setStressDetail(this.stressDetail);
      },
      stressDetailEnabled: () => this.stressDetail,
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
      ...this.gesturePreview.uiObjects(),
      ...this.hud.objects(),
      ...this.battleLog.objects(),
      ...this.debugOverlay.objects(),
      ...this.resultOverlay.objects(),
      ...tutorial.objects(),
    ];
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, "HudCamera");
    this.uiCamera.setScroll(0, 0).setZoom(1);
    this.uiCamera.ignore(worldObjects);
    this.cameras.main.ignore(uiObjects);
    this.battleLog.push("自軍スライムを選択中");
    this.battleLog.push("自軍命令は即時反映されます");

    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      this.uiCamera.setSize(gameSize.width, gameSize.height);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.resultReturnEvent?.remove(false);
      this.resultOverlay.destroy();
      this.touchController.destroy();
    });
  }

  update(_time: number, delta: number): void {
    this.simulation.update(delta / 1000);
    const { enemy, playerSlimes, enemySlimes } = this.simulation.state;
    const player =
      playerSlimes.find((slime) => slime.isSelected) ??
      this.simulation.state.player;
    this.slimeOverlay.draw([...playerSlimes, ...enemySlimes], this.time.now);
    this.gesturePreview.draw(player);
    this.hud.update();
    this.debugOverlay.update(this.simulation.state);
    this.handleBattleResult();

    if (player.posture !== this.lastPlayerPosture) {
      this.battleLog.push(`自軍：${player.posture}`);
      this.lastPlayerPosture = player.posture;
    }
    if (enemy.posture !== this.lastEnemyPosture) {
      this.battleLog.push(`敵軍：${enemy.posture}`);
      this.lastEnemyPosture = enemy.posture;
    }
    const stressRatio =
      player.peakLocalStress / Math.max(0.08, player.effectiveToughness);
    const stressBand =
      player.splitStress > 0.45 ? 3 : stressRatio >= 1 ? 2 : stressRatio >= 0.7 ? 1 : 0;
    if (stressBand > this.lastStressBand) {
      this.battleLog.push(
        stressBand === 3
          ? "亀裂が連結：分裂危険"
          : stressBand === 2
            ? "局所応力が靱性を超過"
            : "高負荷リンクを検出",
      );
    }
    this.lastStressBand = stressBand;
  }

  private handleBattleResult(): void {
    const { winner, winnerAt, playerSlimes, enemySlimes, elapsed } = this.simulation.state;
    if (!winner || winnerAt === undefined) return;

    if (!this.resultShown) {
      this.resultShown = true;
      this.resultShownAtMs = this.time.now;
      this.resultPayload = {
        outcome: winner,
        elapsedSeconds: elapsed,
        playerMorale: this.averageMorale(playerSlimes),
        enemyMorale: this.averageMorale(enemySlimes),
        playerSlimeCount: playerSlimes.length,
        enemySlimeCount: enemySlimes.length,
        finishedAt: Date.now(),
      };
      this.resultOverlay.show(this.resultPayload);
      this.battleLog.push(
        winner === "player"
          ? "戦闘終了：勝利"
          : winner === "enemy"
            ? "戦闘終了：敗北"
            : "戦闘終了：痛み分け",
      );
      this.touchController.setUiCapture(true);
      this.resultReturnEvent = this.time.delayedCall(4000, () => this.returnToStrategy());
    }

    this.resultOverlay.setCountdown(4 - (this.time.now - this.resultShownAtMs) / 1000);
  }

  private returnToStrategy(): void {
    if (this.returningToStrategy) return;
    this.returningToStrategy = true;
    this.resultReturnEvent?.remove(false);
    this.scene.start("StrategyMapScene", {
      battleResult: this.resultPayload,
    });
  }

  private averageMorale(slimes: Array<{ morale: number }>): number {
    if (!slimes.length) return 0;
    return slimes.reduce((total, slime) => total + slime.morale, 0) / slimes.length;
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

    graphics.lineStyle(1, 0x23434d, 0.16);
    for (let i = 0; i < 18; i += 1) {
      const x = 90 + ((i * 257) % (width - 180));
      const y = 90 + ((i * 173) % (height - 180));
      const length = 16 + (i % 4) * 5;
      graphics.lineBetween(x - length, y - 4, x + length, y + 4);
      graphics.lineBetween(x - length * 0.7, y + 7, x + length * 0.55, y + 12);
    }
    return graphics;
  }
}
