# Slime Battle Sim

公開版: https://yohei2000.github.io/slime-battle-sim/

Slime Battle Sim は、個別ユニットを操作するRTSではなく、軍勢そのものをスライム状の連続体として操作する戦術シミュレーションです。

ピンチアウトで軍勢を展開し、敵を包囲します。展開すると支配面積が広がりますが、戦線が薄くなり突破されやすくなります。

ピンチインで軍勢を密集させ、突破力を高めます。密集すると局所圧力は上がりますが、過密・疲労・包囲リスクが増えます。

勝敗は、広がるか、固まるか、どこで接触し、どこを包み、どこを破るかによって決まります。

## 起動

```bash
npm install
npm run dev
```

本番ビルド:

```bash
npm run build
npm run preview
```

Viteのbaseは相対パス指定なので、`dist/` をGitHub Pagesへそのまま配置できます。

## スマホ操作

- タップ: 自軍スライムを選択
- 1本指ドラッグ: 軍勢全体の進行方向と移動先を指示
- ピンチアウト: 横へ展開。ZOCと包囲力を増やす
- ピンチイン: 密集。局所密度と突破力を増やす
- ピンチインしながら敵方向へ押す: 突破命令
- 選択中スライム以外の空白をドラッグ: カメラパン
- 未選択時のピンチ: カメラズーム
- 左下の `+` / `−` / `全`: カメラ拡大、縮小、全体表示
- 上部の `Ⅱ` / `▶`: 一時停止と再開
- 上部の `×1`: `×1 → ×1.5 → ×0.5` の速度変更

形状命令には、疲労、圧力、交戦状態、結束低下、形状変化量に応じた伝達遅延があります。

## ゲームの設計思想

ゲームの中核は、次の矛盾です。

- 広がると包囲しやすいが、局所密度が落ちて中央を破られやすい
- 固まると突破しやすいが、接触正面が頭打ちになり、側面を包まれやすい
- 包囲は時間とともに士気・疲労・命令速度へ効くが、薄い包囲線は一点突破される
- 突破は短時間で形勢を変えられるが、失敗すると密集状態のまま疲労・士気・結束を失う

HUDは密度、幅、疲労、圧力、`gapRisk`、`crowding`、包囲力、突破力を常時表示します。危険が高まると「戦線の隙間」「過密継続」「包囲線が薄い」などを警告します。

## シミュレーション

各軍勢は1つの `ArmySlime` です。MVPでは自軍1体・敵軍1体ですが、シミュレーションAPIは複数のArmySlimeへ拡張できるよう責務を分離しています。

- `SlimeNode`: 輪郭、前面、側面、後方、中心を構成する制御点
- `SlimeLink`: ノード間のばね。結束に応じて形状を維持
- `SlimeParticle`: 内部の兵士表現。選択や個別命令は不可
- `ContactPatch`: 点ではなく面として接触正面、圧力、密度、frontageを保持
- `SlimeOrder`: 命令伝達遅延と実行状態を保持

毎フレーム、形状目標、流れ、ばね、分離、敵接触圧、地形境界を合成してノードを積分します。内部粒子は周辺ノードへ追従し、軍勢全体がばらばらの部隊ではなく連続した塊として動きます。

敵ZOCは侵入できない境界です。輪郭ノードがZOCへ触れると、法線方向の移動は停止し、接線方向の成分だけが残ります。これにより軍勢は相手をすり抜けず、接触正面が潰れ、側面ノードが相手の輪郭に沿って流れます。展開・包囲姿勢は接線方向へ回り込みやすく、密集・突破姿勢は正面へ圧力を蓄積します。

戦闘力は総質量だけでは決まりません。

```text
combatPower =
  activeFrontage
  × localDensity
  × morale
  × cohesion
  × posture
  × fatigue
```

接触面に出られない後方質量は15%だけ戦闘力へ加算されます。そのため、密集は突破圧力には強い一方、長時間の全面戦闘では効率が頭打ちになります。

## 敵AI

敵も個別兵士ではなくArmySlime単位で判断します。

- 相手の`gapRisk`が高い: 中央の弱点へ突破
- 相手が過密で側面へ回れる: 展開・包囲
- 自分が包囲された: 一点突破
- 士気または結束が崩れた: 後退
- 疲労が高い: 保持

AIの姿勢変更もプレイヤーと同じ命令遅延、形状変形、疲労、結束、ZOC、接触面ルールに従います。

## 構成

```text
src/
  main.ts
  game/
    BattleScene.ts
    config.ts
  sim/
    types.ts
    vector.ts
    slime.ts
    slimePhysics.ts
    slimeOrders.ts
    slimeCombat.ts
    zoc.ts
    encirclement.ts
    enemyAI.ts
    simulation.ts
  input/
    TouchInputController.ts
    PinchGestureController.ts
    DragIntentController.ts
    CameraController.ts
  ui/
    MobileHUD.ts
    SlimeOverlay.ts
    GesturePreview.ts
    BattleLog.ts
    DebugOverlay.ts
    TutorialOverlay.ts
  styles/
    main.css
```

外部画像素材は使用していません。輪郭、塗り、粒子、ZOC、接触圧、警告表示はすべてPhaserのCanvas/WebGL図形描画です。

## デバッグ

キーボードの `D` でFPS、ノード数、粒子数、現在幅・深さ、ZOC、接触面数を表示できます。
