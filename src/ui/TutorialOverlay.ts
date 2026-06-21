import Phaser from "phaser";

export class TutorialOverlay {
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onStart: () => void) {
    const shade = scene.add.rectangle(0, 0, 10, 10, 0x02080d, 0.82).setOrigin(0);
    const panel = scene.add.rectangle(0, 0, 430, 350, 0x0b202d, 0.98).setStrokeStyle(2, 0x7cecff, 0.7);
    const title = scene.add
      .text(0, -140, "弾性軍団演習", {
        fontFamily: "Inter, Noto Sans JP, sans-serif",
        fontSize: "24px",
        color: "#a9f2ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const body = scene.add
      .text(
        0,
        -100,
        [
          "兵士を個別に動かさず、",
          "軍全体の形を命令します。",
          "1本指ドラッグ　前進・後退・側面展開",
          "ピンチアウト　戦線を広げて包囲",
          "ピンチイン　密集して突破",
          "2本指回転　戦線角度を変更",
          "片翼だけ前へ　右翼・左翼を押し出す",
          "空白ドラッグ　戦場カメラ移動",
          "密度・結束・疲労を見ながら軍形を保ちます。",
        ].join("\n"),
        {
          fontFamily: "Inter, Noto Sans JP, sans-serif",
          fontSize: "14px",
          color: "#e7f8ff",
          align: "left",
          lineSpacing: 5,
        },
      )
      .setOrigin(0, 0);
    const button = scene.add
      .rectangle(0, 142, 210, 48, 0x1eaacb, 1)
      .setStrokeStyle(2, 0xbaf5ff, 0.8)
      .setInteractive({ useHandCursor: true });
    const buttonText = scene.add
      .text(0, 142, "演習を開始", {
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
      panel.setSize(Math.min(430, gameSize.width - 30), 350);
      this.container.setPosition(gameSize.width * 0.5, gameSize.height * 0.5);
      shade.setPosition(-gameSize.width * 0.5, -gameSize.height * 0.5);
      const bodyWidth = Math.min(360, gameSize.width - 70);
      body.setPosition(-bodyWidth * 0.5, -104);
      body.setWordWrapWidth(bodyWidth);
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
