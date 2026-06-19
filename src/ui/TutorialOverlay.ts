import Phaser from "phaser";

export class TutorialOverlay {
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onStart: () => void) {
    const shade = scene.add.rectangle(0, 0, 10, 10, 0x02080d, 0.82).setOrigin(0);
    const panel = scene.add.rectangle(0, 0, 430, 340, 0x0b202d, 0.98).setStrokeStyle(2, 0x7cecff, 0.7);
    const title = scene.add
      .text(0, -132, "SLIME BATTLE SIM", {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: "24px",
        color: "#a9f2ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const body = scene.add
      .text(
        0,
        -80,
        [
          "軍勢は、兵士の集合ではなく一つの流体です。",
          "",
          "1本指ドラッグ　軍勢全体を流す",
          "ピンチアウト　展開して包囲する",
          "ピンチイン　密集して突破力を上げる",
          "密集＋敵方向へ押す　突破命令",
          "空白ドラッグ　カメラ移動",
          "",
          "広がれば薄くなり、固まれば包まれます。",
        ].join("\n"),
        {
          fontFamily: "Inter, Noto Sans JP, sans-serif",
          fontSize: "15px",
          color: "#e7f8ff",
          align: "left",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5, 0);
    const button = scene.add
      .rectangle(0, 132, 210, 48, 0x1eaacb, 1)
      .setStrokeStyle(2, 0xbaf5ff, 0.8)
      .setInteractive({ useHandCursor: true });
    const buttonText = scene.add
      .text(0, 132, "戦場を開始", {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: "17px",
        color: "#04141c",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.container = scene.add
      .container(0, 0, [shade, panel, title, body, button, buttonText])
      .setScrollFactor(0)
      .setDepth(200);
    const layout = (gameSize: { width: number; height: number }) => {
      shade.setSize(gameSize.width, gameSize.height);
      panel.setSize(Math.min(430, gameSize.width - 30), 340);
      this.container.setPosition(gameSize.width * 0.5, gameSize.height * 0.5);
      shade.setPosition(-gameSize.width * 0.5, -gameSize.height * 0.5);
      body.setWordWrapWidth(Math.min(385, gameSize.width - 62));
    };
    layout({ width: scene.scale.width, height: scene.scale.height });
    scene.scale.on("resize", layout);
    button.on("pointerup", () => {
      this.container.destroy(true);
      scene.scale.off("resize", layout);
      onStart();
    });
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [this.container];
  }
}
