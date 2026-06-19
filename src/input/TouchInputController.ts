import Phaser from "phaser";
import type { ArmySlime, GesturePreviewState, Vector2Like } from "../sim/types";
import { pointInsideSlime } from "../sim/slime";
import { distance } from "../sim/vector";
import { CameraController } from "./CameraController";
import { DragIntentController } from "./DragIntentController";
import { PinchGestureController } from "./PinchGestureController";

type PointerRecord = {
  pointer: Phaser.Input.Pointer;
  startScreen: Vector2Like;
  lastScreen: Vector2Like;
  startWorld: Vector2Like;
  tactical: boolean;
};

export class TouchInputController {
  private readonly pointers = new Map<number, PointerRecord>();
  private readonly drag = new DragIntentController();
  private readonly pinch = new PinchGestureController();
  private preview: GesturePreviewState = { active: false, mode: "none" };
  private ignoreInput = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cameraController: CameraController,
    private readonly getPlayer: () => ArmySlime,
    private readonly getNow: () => number,
    private readonly onPreview: (preview: GesturePreviewState) => void,
  ) {
    scene.input.addPointer(2);
    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  setUiCapture(value: boolean): void {
    this.ignoreInput = value;
  }

  private world(pointer: Phaser.Input.Pointer): Vector2Like {
    return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.ignoreInput) return;
    const world = this.world(pointer);
    const slime = this.getPlayer();
    const tactical = slime.isSelected && pointInsideSlime(slime, world, 75);
    this.pointers.set(pointer.id, {
      pointer,
      startScreen: { x: pointer.x, y: pointer.y },
      lastScreen: { x: pointer.x, y: pointer.y },
      startWorld: world,
      tactical,
    });

    if (this.pointers.size === 1 && tactical) this.drag.begin(world);
    if (this.pointers.size === 2) {
      const records = [...this.pointers.values()];
      if (slime.isSelected && records.some((record) => record.tactical)) {
        this.drag.reset();
        this.pinch.begin(this.world(records[0].pointer), this.world(records[1].pointer));
      }
    }
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const record = this.pointers.get(pointer.id);
    if (!record || !pointer.isDown || this.ignoreInput) return;
    const screen = { x: pointer.x, y: pointer.y };
    const slime = this.getPlayer();

    if (this.pointers.size >= 2) {
      const records = [...this.pointers.values()].slice(0, 2);
      if (slime.isSelected && records.some((item) => item.tactical)) {
        this.preview = this.pinch.move(
          this.world(records[0].pointer),
          this.world(records[1].pointer),
          slime,
        );
        this.onPreview(this.preview);
      } else {
        const previousDistance = distance(records[0].lastScreen, records[1].lastScreen);
        const currentDistance = distance(
          { x: records[0].pointer.x, y: records[0].pointer.y },
          { x: records[1].pointer.x, y: records[1].pointer.y },
        );
        if (previousDistance > 5) {
          this.cameraController.zoomBy(currentDistance / previousDistance, {
            x: (records[0].pointer.x + records[1].pointer.x) * 0.5,
            y: (records[0].pointer.y + records[1].pointer.y) * 0.5,
          });
        }
      }
    } else if (record.tactical && slime.isSelected) {
      this.preview = this.drag.move(this.world(pointer));
      this.onPreview(this.preview);
    } else {
      this.cameraController.panByScreenDelta({
        x: screen.x - record.lastScreen.x,
        y: screen.y - record.lastScreen.y,
      });
    }
    record.lastScreen = screen;
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const record = this.pointers.get(pointer.id);
    if (!record) return;
    const slime = this.getPlayer();
    const wasMulti = this.pointers.size >= 2;

    if (wasMulti && slime.isSelected) {
      this.pinch.commit(slime, this.getNow());
    } else if (record.tactical && slime.isSelected) {
      const dragged = this.drag.commit(slime, this.getNow());
      if (!dragged && distance(record.startScreen, { x: pointer.x, y: pointer.y }) < 14) {
        slime.isSelected = true;
      }
    } else if (distance(record.startScreen, { x: pointer.x, y: pointer.y }) < 14) {
      slime.isSelected = pointInsideSlime(slime, this.world(pointer), 20);
    }

    this.pointers.delete(pointer.id);
    if (this.pointers.size < 2) this.pinch.reset();
    this.preview = { active: false, mode: "none" };
    this.onPreview(this.preview);
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onDown, this);
    this.scene.input.off("pointermove", this.onMove, this);
    this.scene.input.off("pointerup", this.onUp, this);
    this.scene.input.off("pointerupoutside", this.onUp, this);
  }
}
