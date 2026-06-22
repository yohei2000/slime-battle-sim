# Slime Battle Sim — スライム挙動仕様書

> 世界観の正本は [世界観ガイド](worldview-guide.md) です。この文書の `Slime` / `ArmySlime` は内部実装名です。ユーザー向けには「軍塊」「弾性軍制」「結束線」「制御点」などの人間国家の軍事語彙へ置き換えます。

- 文書種別: ゲーム挙動・シミュレーション仕様
- 対象実装: `src/sim/`、`src/input/`、`src/ui/SlimeOverlay.ts`
- 基準日: 2026-06-20
- 状態: 現行実装準拠

## 1. この文書の目的

本作の中核は、複数の個別ユニットを動かすことではなく、軍勢全体を一つの連続体 `ArmySlime` として変形・移動させることにある。

この文書では、以下を一つの仕様として定義する。

- スライムを構成するデータ
- プレイヤーが操作できる形状パラメーター
- ノード、ばね、密度、粘性による変形
- 敵ZOCとの衝突、輪郭沿いの滑走
- 接触面、戦闘力、包囲、突破
- HUD・描画へ反映される値
- 現在は型だけ存在し、挙動へ直接使われていない値

数式と初期値は、特記がない限り現行コードを正として記載する。ゲームデザイン上の理想仕様と現行実装が異なる場合は、「現行実装」と「拡張候補」を分けて書く。

## 2. 設計原則

### 2.1 操作対象

プレイヤーが操作する対象は `ArmySlime` であり、`SlimeNode` や `SlimeParticle` を直接選択・命令することはできない。

プレイヤーが直接変更する意図は次の7要素である。

1. 中心位置
2. 進行方向
3. 幅
4. 奥行き
5. 密度
6. 左右翼の前進差
7. 姿勢

### 2.2 形状変化の基本トレードオフ

| 操作 | 得るもの | 失うもの |
|---|---|---|
| 展開 | 幅、ZOC面積、包囲力 | 密度、中央の強度、形状安定性 |
| 密集 | 密度、局所圧力、突破力 | 接触正面の効率、疲労、対包囲耐性 |
| 包囲前進 | 幅を保った前進、側面接触 | 中央密度、包囲線の厚さ |
| 突破 | 正面圧力、shock、短時間の戦闘力 | 疲労、結束、側面安全性 |
| 戦線回転 | 接触角、正面方向の変更 | 命令時間、旋回中の形状遅れ |
| 片翼前進 | 非対称な接触面、側面圧力 | 前進した翼の孤立、張力 |

### 2.3 衝突原則

敵スライムのZOCは侵入不可境界である。

- 敵ZOCへ近づくと、外向き法線方向の反発を受ける。
- 敵ZOCへ入った輪郭ノードは、境界外へ射影される。
- 敵方向へ向かう速度成分は除去される。
- 接線方向の速度は残り、相手の輪郭に沿って流れる。
- 展開・包囲姿勢は接線方向へ流れやすい。
- 突破姿勢は接線方向へ流れにくく、正面へ圧力を蓄積する。

したがって、突破は「相手を物理的にすり抜ける」行動ではない。現行実装では、接触圧と戦闘結果によって相手を崩す行動として扱う。

## 3. 座標・時間・値域

### 3.1 座標系

- ワールドサイズ: `1000 × 650`
- 初期中心: 自軍 `(300, 325)`、敵軍 `(700, 325)`
- 接触後の変形を主体とするため、長距離行軍用の余白は持たせない
- X正方向: 画面右
- Y正方向: 画面下
- `facing`: 長さ1の正規化ベクトル
- `perpendicular(facing)`: 左右方向の基準ベクトル

左翼・右翼はスライム自身の `facing` を基準に決まり、画面上の左右とは一致しない場合がある。

### 3.2 時間

- シミュレーション単位: 秒
- 1フレームの最大実時間: `0.033秒`
- 実際の `dt`: `min(rawDt, 0.033) × speed`
- ゲーム速度: `0.5 / 1.0 / 1.5`

### 3.3 主な値域

| 種別 | 基本値域 |
|---|---:|
| 士気・結束・疲労・圧力 | 0–100 |
| `gapRisk`、`encirclement`、突破力、包囲力 | 0–1 |
| 密度 | 0.55–1.82 |
| ZOC半径 | 動的。最大88 |
| ノード速度 | 最大120 world units/sec |

## 4. スライム構造

```text
ArmySlime
├─ 20 × 外周SlimeNode
├─ 14 × 中間層SlimeNode
├─ 8 × 内層SlimeNode
├─ 1 × 中心SlimeNode
├─ SlimeLink
│  ├─ 同一層の隣接リンク
│  ├─ 外周–中間層の局所近傍リンク
│  ├─ 中間層–内層の局所近傍リンク
│  └─ 内層–中心の短距離リンク
├─ 128 × SlimeParticle
├─ ContactPatch[]
└─ SlimeOrder?
```

### 4.1 ArmySlime

軍勢全体の状態、目標形状、戦闘状態を保持する。

### 4.2 SlimeNode

実際の輪郭形状を構成する物理点である。

| role | 用途 |
|---|---|
| `front` | 正面。突破圧力と局所圧力が高い |
| `left` | 左翼。左翼前進の対象 |
| `right` | 右翼。右翼前進の対象 |
| `rear` | 後方 |
| `interior` | 中間層、内層、中心。内部メッシュを構成 |

輪郭ノードの役割は初期角度から決定され、シミュレーション中に動的変更されない。

各ノードは初期形状内の正規化座標 `shapeU` / `shapeV` を持つ。外周は半径1.0、中間層は0.68、内層は0.36、中心は0である。形状変更時は全層ノードの目標位置をこの座標から再計算する。

### 4.3 SlimeLink

ノード間のばねであり、形状維持と変形遅延を担当する。

各リンクは `integrity`、`stress`、`localPressure`、`recoveryDelay`、`broken` を持つ。外周から中心までを一本で結ぶ長距離リンクは存在しない。これにより、前面へ加わった敵圧は近傍メッシュへ限定して伝わり、反対側へ同じ応力が即時発生しない。

初期リンク:

| リンク | stiffness | damping | integrity | broken |
|---|---:|---:|---:|---|
| 外周の隣接ノード | 0.82 | 0.72 | 1.0 | false |
| 中間層の隣接ノード | 0.66 | 0.72 | 1.0 | false |
| 内層の隣接ノード | 0.54 | 0.72 | 1.0 | false |
| 外周–中間層の近傍2点 | 0.58 | 0.72 | 1.0 | false |
| 中間層–内層の近傍2点 | 0.48 | 0.72 | 1.0 | false |
| 内層–中心 | 0.38 | 0.72 | 1.0 | false |

初期構造は43ノード、118リンクで構成する。層間リンクは角度が近い2点だけへ接続し、網目状の三角形・四角形セルを形成する。

### 4.4 SlimeParticle

128個の表示用兵士粒子である。

- ゲーム判断の主体ではない。
- 全メッシュノードから最寄りのノードをアンカーとして追従する。
- 正弦波による局所的な徘徊を加える。
- 個別選択、個別命令、個別戦闘は行わない。

## 5. 初期値

### 5.1 形状・物理

| パラメーター | 初期値 | 区分 | 説明 |
|---|---:|---|---|
| `desiredWidth` | 250 | 入力 | 目標の横幅 |
| `desiredDepth` | 180 | 入力 | 目標の前後長 |
| `desiredDensity` | 1.0 | 入力・保留 | 命令値として保持するが、現行の物理密度は面積から再計算 |
| `desiredLeftWingAdvance` | 0 | 入力 | 左翼の追加前進量 |
| `desiredRightWingAdvance` | 0 | 入力 | 右翼の追加前進量 |
| `baseWidth` | 250 | 基準値 | 密度・張力の基準幅 |
| `baseDepth` | 180 | 基準値 | 密度とばね目標の基準奥行き |
| `currentWidth` | 250 | 派生 | 現在の輪郭幅 |
| `currentDepth` | 180 | 派生 | 現在の輪郭奥行き |
| `currentDensity` | 1.0 | 派生 | 現在の幾何密度 |
| `mass` | 100 | 状態 | 戦闘力計算用の総質量 |
| `elasticity` | 0.86 | 調整値 | 目標形状へ戻る強さ |
| `viscosity` | 0.82 | 調整値 | 速度減衰。小さいほど粘く止まりやすい |
| `tension` | 0 | 派生 | 過伸展と低結束による張力 |

### 5.2 戦闘・心理

| パラメーター | 自軍初期値 | 敵軍初期値 | 区分 |
|---|---:|---:|---|
| `morale` | 84 | 82 | 状態 |
| `cohesion` | 86 | 86 | 状態 |
| `fatigue` | 8 | 8 | 状態 |
| `pressure` | 0 | 0 | 状態 |
| `crowding` | 0 | 0 | 派生 |
| `gapRisk` | 0.08 | 0.08 | 派生 |
| `zocStrength` | 1 | 1 | 派生 |
| `zocRadius` | 42 | 42 | 派生 |
| `encirclement` | 0 | 0 | 状態 |
| `breakthroughPower` | 0.5 | 0.5 | 派生 |
| `envelopPower` | 0.5 | 0.5 | 派生 |
| `shockTimer` | 0 | 0 | 状態 |
| `linkIntegrity` | 1 | 1 | 派生 |
| `brokenLinkRatio` | 0 | 0 | 派生 |
| `toughness` | 0.68 | 0.68 | 基礎 |
| `effectiveToughness` | 0.68 | 0.68 | 派生 |
| `peakLocalStress` | 0 | 0 | 派生 |
| `fractureConcentration` | 0 | 0 | 派生 |
| `splitStress` | 0 | 0 | 状態 |
| `splitGeneration` | 0 | 0 | 状態 |
| `splitCooldown` | 0 | 0 | 状態 |

### 5.3 ノード

| パラメーター | 輪郭 | 中心 |
|---|---:|---:|
| `mass` | 1 | 2.5 |
| `localDensity` | 1 | 1 |
| `localPressure` | 0 | 0 |
| `localMorale` | 82 | 84 |
| `localCohesion` | 82 | 88 |

## 6. ArmySlimeパラメーター一覧

### 6.1 識別・運動

| パラメーター | 区分 | 挙動への影響 |
|---|---|---|
| `id` | 識別 | ノード、粒子、接触面IDの名前空間 |
| `side` | 識別 | 自軍・敵軍の色、選択可否、AI制御 |
| `center` | 派生状態 | 全ノード位置の平均 |
| `velocity` | 派生状態 | 前フレーム中心との差分 / `dt` |
| `facing` | 状態 | 現在の正面方向 |
| `posture` | 入力状態 | 形状、戦闘、ZOC、移動の補正 |

### 6.2 目標形状

| パラメーター | 区分 | 挙動への影響 |
|---|---|---|
| `desiredCenter` | 入力 | 全体の移動先 |
| `desiredDirection` | 入力 | 戦線の向き、目標輪郭の座標軸 |
| `desiredWidth` | 入力 | 左右方向の目標直径 |
| `desiredDepth` | 入力 | 前後方向の目標直径 |
| `desiredDensity` | 入力・保留 | 命令データとして保持。現行では物理密度を直接決めない |
| `desiredLeftWingAdvance` | 入力 | 左側ノードを前進させる |
| `desiredRightWingAdvance` | 入力 | 右側ノードを前進させる |
| `baseWidth` | 基準 | 生成時の自然幅。分裂後は子スライムの幅へ更新 |
| `baseDepth` | 基準 | 生成時の自然奥行き |

### 6.3 現在形状

| パラメーター | 区分 | 挙動への影響 |
|---|---|---|
| `currentWidth` | 派生 | ZOC半径、包囲力、gapRisk |
| `currentDepth` | 派生 | 密度、表示、突破方向の形 |
| `currentDensity` | 派生 | crowding、ZOC、戦闘、突破力 |
| `tension` | 派生 | gapRisk、ZOC連続性、輪郭の震え |
| `crowding` | 派生 | 疲労・結束悪化、命令遅延 |
| `gapRisk` | 派生 | AIの突破判断、警告、包囲線連続性 |

### 6.4 戦闘状態

| パラメーター | 区分 | 挙動への影響 |
|---|---|---|
| `mass` | 状態 | frontline/rear mass、戦闘力 |
| `morale` | 状態 | 戦闘力、ZOC、敗北条件 |
| `cohesion` | 状態 | ばね強度、戦闘力、ZOC、敗北条件 |
| `fatigue` | 状態 | 戦闘力、命令遅延、ringIntegrity |
| `pressure` | 状態 | 命令遅延、gapRisk、HUD |
| `zocStrength` | 派生 | ZOC反発、containment |
| `zocRadius` | 派生 | 侵入不可境界の厚さ |
| `encirclement` | 状態 | 包囲段階、士気・疲労への継続効果 |
| `breakthroughPower` | 派生 | 接触反発への抵抗、HUD |
| `envelopPower` | 派生 | HUD上の包囲能力 |
| `shockTimer` | 状態 | 突破直後の戦闘力補正 |
| `linkIntegrity` | 派生 | 未切断リンクの平均耐久度 |
| `brokenLinkRatio` | 派生 | 全リンクに占める切断済みリンクの割合 |
| `toughness` | 基礎 | 材料としての靱性。局所応力に耐える基準値 |
| `effectiveToughness` | 派生 | cohesionとmoraleを加味した現在の実効靱性 |
| `peakLocalStress` | 派生 | 全リンク中で最大の局所応力 |
| `fractureConcentration` | 派生 | 近接する損傷リンク群の集中度 |
| `splitStress` | 状態 | 局所亀裂が分裂面へ連結する進行度 |
| `splitGeneration` | 状態 | 何回目の分裂で生成されたか |
| `splitCooldown` | 状態 | 分裂直後の再分裂禁止時間 |

### 6.5 フラグ・制御

| パラメーター | 区分 | 用途 |
|---|---|---|
| `isSelected` | UI状態 | 戦術ジェスチャー対象 |
| `isEngaged` | 派生 | 接触面が1つ以上存在する |
| `isEncircling` | 派生 | 敵の包囲値が0.22超 |
| `isEncircled` | 派生 | 自身の包囲値が0.62超 |
| `isRouting` | 状態 | 士気崩壊による強制敗走中か |
| `routedAt` | 状態 | 敗走を開始したシミュレーション時刻 |
| `contactPatches` | 派生 | 現在の接触面 |
| `activeOrder` | 制御 | 伝達中・実行中の命令 |
| `commandDelay` | 派生 | 最新命令の伝達時間 |
| `aiThinkAt` | 制御 | 次回AI判断時刻 |

## 7. 姿勢仕様

| posture | 目標形状・物理 | 戦闘補正 | ZOC補正 |
|---|---|---:|---:|
| `neutral` | 通常形状 | 1.00 | 通常 |
| `spread` | 幅増加、奥行き低下 | 0.86 | 局所強度0.78、半径増加 |
| `envelop` | 展開＋両翼を前方へ湾曲 | 1.08 | 局所強度0.78、半径増加 |
| `contract` | 幅低下、奥行き増加 | 1.18 | 局所強度1.18 |
| `breakthrough` | 正面ノードを奥行きの20%追加前進 | 1.42 | 局所強度1.28 |
| `hold` | 現行では専用形状補正なし | 1.00 | 通常 |
| `retreat` | 現行では専用形状補正なし。目標位置で後退 | 1.00 | 通常 |

`envelop` の翼湾曲:

```text
forward += abs(sin(angle)) × desiredDepth × 0.34
```

`breakthrough` の正面突出:

```text
if cos(angle) > 0.45:
  forward += desiredDepth × 0.20
```

## 8. 形状生成

各輪郭ノード `i` に対し、初期順序を角度へ変換する。

```text
angle = i / boundaryNodeCount × 2π
```

基本楕円:

```text
forward  = cos(angle) × desiredDepth × 0.5
sideways = sin(angle) × desiredWidth × 0.5
```

左翼・右翼前進:

```text
leftWeight  = clamp01(sin(angle))
rightWeight = clamp01(-sin(angle))
wingFrontBias = 0.35 + max(0, cos(angle)) × 0.65

forward += (
  desiredLeftWingAdvance  × leftWeight
  + desiredRightWingAdvance × rightWeight
) × wingFrontBias
```

最終目標位置:

```text
targetPosition =
  desiredCenter
  + desiredDirection × forward
  + perpendicular(desiredDirection) × sideways
```

### 8.1 片翼前進の意味

片翼前進は、左または右のノード群を一律に平行移動するのではない。

- 側面中央ほど対象翼の重みが高い。
- 前方寄りノードほど前進効果が強い。
- 後方寄りノードにも35%の効果を残し、輪郭が切れないようにする。
- ばねと結束力により周囲ノードも追従する。

## 9. プレイヤー入力から形状命令への変換

### 9.1 1本指ドラッグ

成立条件:

```text
dragDistance >= 22
```

移動距離:

```text
travel = min(290, dragDistance × 1.2)
```

効果:

- `desiredCenter` をドラッグ方向へ移動
- `desiredDirection` をドラッグ方向へ変更
- 左右翼前進量を0へ戻す

### 9.2 二本指入力で測る値

| 値 | 定義 |
|---|---|
| `scale` | 現在の二指間距離 / 開始時二指間距離 |
| `rotation` | 開始時二指ベクトルから現在ベクトルへの符号付き角度 |
| `centroidMotion` | 二指重心の移動 |
| `forwardMotion` | `centroidMotion · facing` |
| `leftForward` | 左側の指が前進した量 |
| `rightForward` | 右側の指が前進した量 |
| `wingDifference` | `leftForward - rightForward` |

`scale` は `0.56–1.62` に制限する。

### 9.3 ジェスチャー判定優先順位

判定は次の順で行う。

1. 戦線回転
2. 片翼前進
3. 包囲前進
4. 突破
5. 単純展開または単純密集

### 9.4 戦線回転

成立条件:

```text
abs(rotation) > 0.20 rad  // 約11.5°
0.82 < scale < 1.22
abs(forwardMotion) < 42
両指の移動量が16を超える
両指の移動量比が3未満
```

効果:

```text
targetDirection = rotate(facing, rotation)
```

- 幅と奥行きは現在の目標値を維持する。
- `facing` は即時回転せず、毎フレーム補間される。

```text
facing = normalize(lerp(facing, desiredDirection, clamp01(dt × 2.2)))
```

### 9.5 片翼前進

成立条件:

```text
戦線回転ではない
0.84 < scale < 1.18
abs(wingDifference) > 30
max(leftForward, rightForward) > 28
```

前進量:

```text
wingAdvance = clamp(abs(wingDifference) × 1.25, 35, 135)
```

### 9.6 包囲前進

成立条件:

```text
scale > 1.06
forwardMotion > 22
```

効果:

- 姿勢を `envelop` にする。
- 幅を増やす。
- 奥行きを減らす。
- 二指重心の前進方向へ全体を移動する。

### 9.7 突破

成立条件:

```text
scale < 0.94
forwardMotion > 22
```

効果:

- 姿勢を `breakthrough` にする。
- 幅を減らす。
- 奥行きを増やす。
- 二指重心の前進方向へ全体を移動する。
- 命令実行時に `shockTimer = 2.4秒`。

### 9.8 ピンチによる目標形状

```text
targetWidth = clamp(currentWidth × scale, 145, 450)

targetDepth = clamp(
  currentDepth / scale^0.72,
  110,
  290
)
```

前進距離:

```text
advance = min(240, max(70, forwardMotion × 1.55))
```

## 10. 命令遅延

命令は即時実行されず、`transmitting` 状態を経る。

形状変化量:

```text
shapeChange =
  abs(targetWidth - currentWidth) / 180
  + abs(targetDepth - currentDepth) / 150
  + distance(targetCenter, center) / 550
  + (abs(leftWingAdvance) + abs(rightWingAdvance)) / 260
  + (1 - dot(normalize(targetDirection), normalize(facing))) × 0.8
```

遅延:

```text
commandDelay = clamp(
  0.22
  + fatigue × 0.005
  + pressure × 0.004
  + (isEngaged ? 0.32 : 0)
  + (100 - cohesion) × 0.007
  + shapeChange × 0.85
  + crowding × 0.55,
  0.18,
  2.8
)
```

命令実行時間:

| 命令 | 実行状態を維持する時間 |
|---|---:|
| `breakthrough` | 2.5秒 |
| その他 | 0.8秒 |

## 11. 1フレームの更新順

BattleSimulation:

```text
1. player order更新
2. enemy order更新
3. enemy AI判断
4. player側の戦闘解決
5. enemy側の戦闘解決
6. player slime物理更新
7. enemy slime物理更新
8. playerによるenemy包囲更新
9. enemyによるplayer包囲更新
10. 全スライムの分裂ストレス更新と分裂処理
11. 選択中スライム・代表敵スライム更新
12. 勝敗判定
```

各ArmySlimeの物理更新:

```text
1. updateDesiredShape
2. applyOrderForces
3. applySpringForces
4. applyDensityForces
5. applyZocForces
6. applyTerrainForces
7. integrateNodes
8. enforceZocBoundary
9. enforceCohesionEnvelope
10. updateParticles
11. updateDerivedStats
```

分裂後は `playerSlimes[]` と `enemySlimes[]` の各ArmySlimeについて、最寄りの敵ArmySlimeを対象として戦闘・物理・包囲を更新する。

## 12. 力と積分

### 12.1 移動力

```text
flow = desiredCenter - center
flowSpeed = min(length(flow), breakthrough ? 115 : 78)
flowForce = normalize(flow) × flowSpeed × 0.025
```

### 12.2 目標形状力

```text
shapeForce =
  (targetPosition - position)
  × 0.055
  × elasticity
```

### 12.3 ばね力

目標リンク長は、両端ノードの `shapeU` / `shapeV` から算出した目標位置間距離を使う。これにより外周だけでなく内部メッシュも展開・密集・翼前進へ追従する。

```text
targetLength = clamp(
  distance(nodeA.targetPosition, nodeB.targetPosition),
  restLength × 0.58,
  restLength × 1.72
)
stretch = currentLength - targetLength
cohesionStrength = 0.25 + cohesion / 125

magnitude =
  stretch × stiffness × cohesionStrength × integrity × 0.022
  + relativeVelocity × damping × 0.08
```

`cohesion` が低下すると、ばねによる復元力が弱くなる。

#### 12.3.1 リンク耐久度

リンクは幅や伸長率だけでは損傷しない。敵との接触面および敵ZOCから受ける局所圧力を、リンク両端のノードから取得する。

```text
endpointPressure =
  max(nodeAEnemyPressure, nodeBEnemyPressure) × 0.70
  + average(nodeAEnemyPressure, nodeBEnemyPressure) × 0.30

strainAmplifier =
  0.78 + max(0, structuralStrain - 0.92) × 0.92

fatigueAmplifier =
  0.82 + fatigue / 145

stressTarget =
  endpointPressure
  × strainAmplifier
  × fatigueAmplifier
```

伸びは敵圧による応力を増幅するが、`endpointPressure = 0` なら `stressTarget = 0` であり、展開幅だけを原因とする破断は発生しない。

実効靱性:

```text
effectiveToughness =
  toughness
  × (0.55 + cohesion × 0.0045)
  × (0.72 + morale × 0.0028)
```

局所応力が実効靱性を超えた時間だけ耐久度を失う。

```text
if stress > effectiveToughness:
  recoveryDelay = 2.2
  integrity -=
    (stress - effectiveToughness)
    × 1.00
    × (1 + (100 - cohesion) / 120)
    × dt
```

過負荷が解消されると `recoveryDelay` を毎秒1ずつ減らす。待ち時間終了後、圧力がほぼ消え、応力が靱性の58%未満まで抜けた未切断リンクは自然修復する。

```text
repairFactor =
  (0.35 + cohesion / 140)
  × (0.45 + morale / 180)
  × (isEngaged ? 0.72 : 1.0)

integrity += 0.075 × repairFactor × dt
```

高士気・高結束かつ非交戦なら回復が速く、交戦継続中は72%へ低下する。再び過負荷を受けた場合は待ち時間を2.2秒へ戻す。

```text
if integrity <= 0:
  integrity = 0
  broken = true
```

`broken = true` になったリンクはばね力を発生せず、自然回復もしない。完全切断前も、ばね力には `integrity` が乗算されるため徐々に結合が弱くなる。

### 12.4 ノード分離力

ノード間距離が42未満の場合:

```text
push = normalize(delta) × (42 - gap) × 0.018
```

### 12.5 速度積分

```text
velocity += force × dt × 60 / node.mass
velocity *= viscosity^(dt × 3.5)
velocity = limitLength(velocity, 120)
position += velocity × dt
```

### 12.6 結束エンベロープ

輪郭ノードが異常に伸び続けないための最大半径:

```text
maxRadius = max(
  125,
  max(desiredWidth, desiredDepth)
  × (spread/envelop ? 0.76 : 0.68)
)
```

最大半径を超えたノードは境界へ戻し、外向き速度を除去する。

## 13. ZOC仕様

### 13.1 ZOC強度

全体値:

```text
moraleFactor  = 0.45 + morale / 180
cohesionFactor = 0.40 + cohesion / 165
densityFactor = 0.60 + min(1.6, currentDensity) × 0.38
spreadFactor  = spread/envelop ? 0.82 : 1.08

zocStrength =
  moraleFactor
  × cohesionFactor
  × densityFactor
  × spreadFactor
```

### 13.2 ZOC半径

```text
zocRadius = min(
  88,
  34
  + currentWidth × 0.05
  + (spread/envelop ? 24 : 4)
)
```

展開するとZOC面積は増えるが、局所強度は下がる。

### 13.3 局所ZOC

```text
localZoc =
  zocStrength
  × (0.45 + morale / 180)
  × (0.35 + cohesion / 150)
  × (0.55 + localDensity × 0.45)
  × postureFactor
  × facingFactor
```

姿勢係数:

| posture | factor |
|---|---:|
| `breakthrough` | 1.28 |
| `contract` | 1.18 |
| `spread` / `envelop` | 0.78 |
| その他 | 1.00 |

方向係数:

```text
facingFactor =
  0.65 + max(0, dot(facing, towardTarget)) × 0.45
```

### 13.4 ZOC接近時の滑走

ZOC境界から38以内に入ると力を受ける。

```text
influenceDistance = clearance + 38
proximity = (influenceDistance - distance) / 38
```

接線流量:

```text
tangentFlow =
  desiredFlow
  - normal × dot(desiredFlow, normal)
```

滑走係数:

| posture | slideFactor |
|---|---:|
| `spread` / `envelop` | 0.055 |
| `breakthrough` | 0.018 |
| その他 | 0.035 |

### 13.5 ZOC侵入補正

ZOC内部の輪郭ノードは、1フレーム最大18だけ境界外へ戻す。

補正後:

- 接線速度を90%維持
- 外向き法線速度を35%維持
- 内向き法線速度を除去

接触中に `desiredCenter` が敵の向こう側を指している場合、法線方向の要求移動を最大10に制限し、接線方向の移動を残す。

## 14. 現在形状と派生値

### 14.1 幅・奥行き

全輪郭ノードを現在の `facing` とその垂線へ射影し、最大値と最小値の差を取る。

### 14.2 密度

```text
currentDensity = clamp(
  (baseWidth × baseDepth)
  / max(
      baseWidth × baseDepth × 0.245,
      currentWidth × currentDepth
    ),
  0.55,
  1.82
)
```

この密度は総質量を面積で割った近似であり、粒子数からは計算しない。

### 14.3 張力

```text
tension = clamp01(
  max(0, currentWidth / baseWidth - 1) × 0.9
  + (100 - cohesion) / 210
)
```

### 14.4 隙間リスク

```text
overExtension = clamp01(
  (currentWidth - baseWidth × 1.14)
  / (baseWidth × 0.72)
)
lowDensity = clamp01((1.05 - currentDensity) / 0.45)
lowCohesion = clamp01((72 - cohesion) / 72)

gapRisk = clamp01(
  overExtension × 0.58
  + lowDensity × 0.32
  + lowCohesion × 0.28
  + pressure / 100 × 0.18
)
```

### 14.5 過密

```text
crowding = max(0, currentDensity / 1.22 - 1)
```

過密中:

```text
fatigue += crowding × 5 × dt
cohesion -= crowding × 6 × dt
```

### 14.6 突破力

```text
breakthroughPower = clamp01(
  currentDensity × 0.34
  + morale / 330
  + cohesion / 420
  + (posture == breakthrough ? 0.20 : 0)
)
```

### 14.7 包囲力

```text
envelopPower = clamp01(
  currentWidth / 520
  + zocRadius / 190
  + cohesion / 420
  - gapRisk × 0.28
)
```

### 14.8 自然回復・減衰

| 値 | 条件 | 変化 |
|---|---|---:|
| pressure | 交戦中 | `-0.5 × dt` |
| pressure | 非交戦 | `-7 × dt` |
| fatigue | 非交戦かつ非突破 | `-0.7 × dt` |
| cohesion | 非交戦かつcrowding<0.05 | `+0.45 × dt` |
| morale | 非交戦かつ非包囲 | `+0.22 × dt` |

## 15. 接触面

接触候補:

```text
threshold = enemy.zocRadius + 18
```

自軍の各輪郭ノードについて、敵輪郭への最短距離がthreshold未満なら接触ペアへ追加する。

現行実装は、全接触ペアを1つの `ContactPatch` にまとめる。

| ContactPatch値 | 計算 |
|---|---|
| `center` | 接触ノード位置の平均 |
| `normal` | 自軍中心から敵中心への方向 |
| `length` | 自軍接触ノード数 × 18 |
| `pressure` | 局所ZOCと距離から計算し、最終的に×58 |
| `ownFrontage` | 自軍接触ノード数 / 自軍輪郭ノード数 |
| `enemyFrontage` | 敵接触ノード種類数 / 敵輪郭ノード数 |

## 16. 戦闘

### 16.1 有効質量

```text
frontlineMass =
  mass × clamp(frontage, 0.06, 0.72)

rearMass = mass - frontlineMass

activePower =
  frontlineMass
  + rearMass × 0.15
```

密集しても、接触面に出られない後方質量は15%しか戦闘力へ寄与しない。

### 16.2 戦闘力

```text
combatPower =
  activePower
  × density
  × (0.35 + morale / 145)
  × (0.30 + cohesion / 135)
  × postureFactor
  × shock
  × (1 - fatigue / 155)
```

姿勢係数:

| posture | factor |
|---|---:|
| `breakthrough` | 1.42 |
| `contract` | 1.18 |
| `envelop` | 1.08 |
| `spread` | 0.86 |
| その他 | 1.00 |

`shockTimer > 0` の場合:

```text
shock = 1.25
```

### 16.3 接触中の状態変化

自軍戦闘力を `ownPower`、敵戦闘力を `enemyPower` とする。

```text
ratio = (ownPower + 1) / (enemyPower + 1)
intensity = min(1.5, patch.pressure / 50)
```

```text
pressure += enemyPower / (ownPower + enemyPower) × 42 × dt
fatigue += (1.1 + intensity × 1.8) × dt
cohesion -= max(0, 1 / ratio - 0.7) × 1.45 × dt
morale -= max(0, 0.88 / ratio - 0.62) × 1.05 × dt
```

### 16.4 接触反発

```text
ownPower =
  breakthroughPower
  × (posture == breakthrough ? 1.6 : 1)

enemyContainment =
  enemy.zocStrength
  × (0.65 + enemy.currentDensity × 0.35)
```

敵のcontainmentが上回る場合、自軍中心方向へ押し戻す。

## 17. 包囲

### 17.1 flankAccess

```text
frontal = abs(dot(defender.facing, directionToAttacker))
widthAdvantage =
  attacker.currentWidth / max(100, defender.currentWidth)

flankAccess = clamp01(
  (1 - frontal) × 0.45
  + (widthAdvantage - 0.75) × 0.65
)
```

### 17.2 ringIntegrity

```text
averageDensity = min(1.5, currentDensity) / 1.5
cohesionFactor = cohesion / 100
reserveSupport = clamp01(1 - fatigue / 145)
commandCoverage = clamp01(1 - commandDelay / 4)

ringIntegrity = clamp01(
  averageDensity
  × zocContinuity
  × cohesionFactor
  × reserveSupport
  × commandCoverage
  × 1.8
)
```

ZOC連続性:

```text
zocContinuity = clamp01(
  1
  - gapRisk × 0.72
  - max(0, tension - 0.5) × 0.35
)
```

### 17.3 包囲進行

```text
reach =
  attacker.currentWidth × 0.6
  + defender.currentWidth × 0.28
```

姿勢ボーナス:

| posture | bonus |
|---|---:|
| `envelop` | 0.75 |
| `spread` | 0.38 |
| その他 | 0 |

範囲内の場合:

```text
gain =
  postureBonus
  × flankAccess
  × ringIntegrity
  × 0.16
```

範囲外またはgainが0の場合:

```text
encirclement -= 0.045 × dt
```

包囲値が0.35を超えると:

```text
morale -= encirclement × 1.2 × dt
fatigue += encirclement × 0.8 × dt
commandDelay += encirclement × 0.04 × dt
```

包囲段階:

| encirclement | 段階 |
|---:|---|
| 0–0.14 | 未包囲 |
| 0.14–0.36 | 側面圧力 |
| 0.36–0.62 | 半包囲 |
| 0.62–0.86 | 包囲 |
| 0.86–1.00 | 圧縮包囲 |

## 18. 包囲下の突破

自身が `breakthrough` かつ敵による包囲値が0.3を超える場合:

```text
breakoutPower =
  currentDensity
  × (shockTimer > 0 ? 1.5 : 1.1)
  × morale / 100
  × cohesion / 100
  × 1.12
  × 1.35
```

```text
containmentPower =
  enemy.currentDensity
  × enemy.zocStrength
  × enemy.cohesion / 100
  × enemy.ringIntegrity
```

成功:

```text
encirclement -= 0.28 × dt
```

失敗:

```text
fatigue += 3.4 × dt
cohesion -= 2.6 × dt
morale -= 1.8 × dt
```

## 19. 敵AI

判断間隔:

```text
1.2 + random(0, 0.7) 秒
```

優先順位:

1. `cohesion < 35` または `morale < 30` → 後退
2. 自身が包囲中 → 突破
3. プレイヤーの `gapRisk > 0.48` → 突破
4. プレイヤー密度 `> 1.23` かつ `flankAccess > 0.18` → 包囲
5. 自軍士気が8以上高く、敵士気 `< 48` → 包囲
6. 自軍疲労 `> 68` → 保持
7. その他 → 展開または密集をランダム選択

AI目標形状:

| 姿勢 | width | depth | density |
|---|---:|---:|---:|
| 突破・密集 | 170 | 245 | 1.42 |
| 展開・包囲 | 390 | 128 | 0.76 |
| その他 | 250 | 180 | 1.00 |

現行AIは戦線回転・片翼前進を使用しない。

## 20. 局所応力、リンク切断、分裂

### 20.1 分裂の目的

分裂は「広げすぎたから自動的に割れる」現象ではない。敵から押された場所へ局所的に応力が集中し、現在の靱性を超え続けた結果として起きる。

展開した軍勢は密度・cohesionが下がりやすいため、同じ敵圧でも実効靱性が不足しやすい。ただし、敵圧がなければどれだけ幅を広げてもリンク損傷は発生しない。

### 20.2 分裂可能条件

```text
splitGeneration < 2
mass >= 42
splitCooldown <= 0
```

最大2世代まで分裂できる。質量が42未満の小スライムはそれ以上分裂しない。

### 20.3 局所損傷の集約

```text
damagedLink =
  broken
  or integrity < 0.82

clusterRadius =
  max(54, min(currentWidth, currentDepth) × 0.42)
```

各損傷リンクの中点を求め、半径内にある損傷リンクを亀裂クラスターとして集約する。全体に散った軽微な損傷では分裂せず、近い位置で複数リンクが切れることが必要になる。

### 20.4 亀裂集中度

```text
severity =
  broken ? 1 : 1 - integrity

fractureConcentration =
  clamp01(strongestClusterSeverity / 2.7)
```

亀裂中心は最強クラスターの損傷度による加重平均位置とする。亀裂法線はスライム中心から亀裂中心へ向く方向であり、分裂後の離隔方向にも使う。

```text
targetProgress =
  fractureConcentration × 0.82
  + clamp01(localBrokenLinks / 2) × 0.28
```

`splitStress` は `targetProgress` へ追従する。損傷リンクが存在しない場合は毎秒0.22ずつ低下する。

### 20.5 分裂成立条件

```text
splitStress >= 0.72
fractureConcentration >= 0.68
同一局所クラスター内の切断リンク数 >= 2
```

全体の切断率ではなく、近接した切断リンクが分裂面を形成したかで判定する。

### 20.6 分裂後の生成

```text
fractureFragmentMass = parentMass × 0.42
mainBodyMass = parentMass × 0.58
separationAxis = fractureNormal
```

子スライムは固定の左右方向ではなく、亀裂の局所位置から求めた `fractureNormal` に沿って配置する。前面が破断すれば前後へ、側面が破断すれば左右へ分かれる。

状態継承:

```text
morale = parent.morale - 7
cohesion = parent.cohesion - 20
fatigue = parent.fatigue + 11
pressure = parent.pressure + 12
encirclement = parent.encirclement × 0.65
toughness = parent.toughness - 0.04
splitCooldown = 3.5秒
```

- 総質量は分裂前後で保存する。
- 生存粒子数は質量比42:58で割り当てる。
- 親が選択中なら、質量58%の主塊が選択を引き継ぐ。
- 分裂後は両方とも独立したArmySlimeとして移動・戦闘・再選択できる。

### 20.7 表示

- HUDに接続耐久度、最大局所応力、実効靱性、亀裂進行度を表示する。
- `peakLocalStress > effectiveToughness` で「局所応力が靱性を超過」と警告する。
- `splitStress > 0.45` で「亀裂が連結しています」と警告する。
- 選択中は全リンクを表示し、非選択スライムは負荷率70%以上だけ表示する。
- 負荷率は `link.stress / effectiveToughness` とする。
- 0–40%は青緑、40–70%は黄、70–100%は橙、100%以上は点滅する赤で描画する。
- 線幅は負荷率、線の欠けは累積損傷 `1 - integrity` を表す。ただし戦況を隠さないよう通常線幅は0.65、最大でも2.65とする。
- 通常透明度は0.26、靱性超過時の点滅も概ね0.24–0.44に抑える。
- 負荷率70%以上では低透明度の応力集中ハローと細い敵圧方向矢印を表示する。
- 亀裂成立前も、最大負荷リンクを通る予測分裂面を黄色い点線で表示する。
- 切断リンクは中央に黒い隙間を作り、両端を赤で表示する。
- 「応力」詳細表示中は危険度上位3リンクのノード番号、負荷率、耐久度、主因を表示する。
- HUD上部へ現在の自軍スライム数を表示する。

## 21. 表示仕様

### 21.1 本体濃度

```text
bodyAlpha =
  0.20 + min(0.24, currentDensity × 0.10)
```

濃い本体はスライム実体、薄い外周はZOCを示す。

### 21.2 ZOC

- 塗り透明度: 0.055
- 線透明度: 0.20
- 輪郭から `zocRadius` だけ外側へ拡張して描画

### 21.3 中心核

```text
coreRadius = 24 + currentDensity × 8
```

### 21.4 粒子

```text
particleAlpha = 0.38 + currentDensity × 0.16
particleRadius =
  1.4 × pulse + currentDensity × 0.45
```

### 21.5 張力表現

`tension >= 0.28` で輪郭を振動させる。

```text
shake =
  sin(time × 0.018 + nodeIndex × 2.7)
  × tension
  × 4.2
```

### 21.6 警告

| 条件 | 表示 |
|---|---|
| `gapRisk > 0.38` | 輪郭ノード周辺を点滅 |
| `gapRisk > 0.45` | HUD「戦線の隙間」 |
| `crowding > 0.18` | 中心に過密色、HUD警告 |
| 包囲中かつ `ringIntegrity < 0.46` | HUD「包囲線が薄い」 |
| `isEncircled` | HUD包囲警告 |
| `isRouting` | 本体輪郭を黄色にし、頭上へ「敗走」を表示 |
| `peakLocalStress > effectiveToughness` | HUD「局所応力が靱性を超過」 |
| 最大リンク負荷率 `>= 0.4` | HUDへノード間負荷率と主因を表示 |

### 21.7 応力の色と因果表示

```text
loadRatio = link.stress / effectiveToughness
```

主因表示は次の条件を組み合わせる。

| 条件 | 主因 |
|---|---|
| `link.localPressure > 0.2` | 接触圧 |
| `currentWidth > baseWidth × 1.22` | 展開 |
| `fatigue > 45` | 疲労 |
| `cohesion < 62` | 低結束 |
| `morale < 42` | 低士気 |

### 21.8 スライム頭上表示

各ArmySlimeの輪郭上端へ、カメラズームに依存しない画面サイズで次を表示する。

```text
兵力 round(mass)  士気 round(morale)
```

- 兵力は現在のArmySlimeの`mass`。分裂時は42:58へ分配され、総量を保存する。
- 士気40以下は橙色、士気25以下または敗走中は黄色で表示する。
- 敗走中は先頭へ「敗走」を追加する。

## 22. 勝敗

| 条件 | 結果 |
|---|---|
| 自軍の全スライムが戦闘不能または敗走中 | 敵勝利 |
| 敵軍の全スライムが戦闘不能または敗走中 | 自軍勝利 |

質量0や粒子全滅による敗北は、現行実装には存在しない。

### 22.1 敗走

```text
morale <= 25:
  isRouting = true
  posture = retreat
  activeOrder = none
  retreatDirection = normalize(ownCenter - enemyCenter)
```

敗走中はプレイヤー・敵AIの命令を受け付けず、敵から260先を継続的な移動目標にする。幅は基準幅の78%、奥行きは108%、密度目標は1.12となる。戦闘力補正は0.42、ZOC姿勢補正は0.38、ZOC全体補正は0.42。

同陣営に戦闘可能な別スライムが残っている場合、敗走スライムは非交戦状態で最低8秒経過し、士気38以上まで回復すると`hold`へ立て直せる。

## 23. 実装保留・既知の制限

以下は型や概念として存在するが、現行挙動では限定的または未使用である。

| 項目 | 現状 |
|---|---|
| `desiredDensity` | 命令へ保存されるが、`currentDensity` は幅×奥行きから再計算される |
| `mass` | 戦闘力には使うが、損耗で減少しない |
| `SlimeParticle.alive` | 描画判定に使うが、戦闘で死亡しない |
| `localMorale` / `localCohesion` | 毎フレーム全体値をコピーし、局所差を持たない |
| `localDensity` | 全体密度＋位置由来の小さな正弦変動 |
| `localPressure` | 正面か否かの簡易補正。ZOC補正後も派生更新で上書きされる |
| `SlimeOrder.status = queued/blocked` | 型には存在するが、通常フローでは使用しない |
| ContactPatch | 複数の離れた接触面を1パッチに統合する |
| 地形 | ワールド境界の反発だけ。障害物、坂、狭路は未実装 |
| 突破 | ZOCを通過しない。敵の崩壊や局所的なZOC破断は未実装 |
| 包囲 | 幾何学的な閉曲線判定ではなく、幅・方向・距離によるスカラー進行 |
| 片翼孤立 | 専用ペナルティはなく、張力・gapRisk・結束で間接表現 |
| AIの高度形状操作 | 回転・片翼前進・包囲前進ジェスチャー相当は未使用 |
| 分裂位置 | 現在輪郭の連結成分を再利用せず、親状態から左右の子ArmySlimeを再生成する |
| 分裂方向 | 現在は左右分裂のみ。前後分裂や接触面に沿った破断は未実装 |

## 24. 今後の拡張候補

優先度順:

1. 複数ContactPatchへの分割
2. 局所密度・局所士気・局所結束の実データ化
3. 突破成功時の局所ZOC破断
4. ノード単位の損耗と質量移動
5. 左右翼の孤立・予備支援
6. 地形輪郭に沿う変形
7. AIによる戦線回転・片翼前進
8. 包囲を閉曲線と退路幅から評価
9. 実際の連結成分に基づく不定形分裂
10. 切断リンク位置からの粒子・質量分配

## 25. 調整時に守る不変条件

挙動調整では、次の条件を壊さないこと。

1. 輪郭ノードは敵ZOCをすり抜けない。
2. 接触時は法線方向を止め、接線方向へ流せる。
3. 展開と密集のどちらか一方が常時最適にならない。
4. 密度を上げてもfrontage制限により戦闘効率は無限に上がらない。
5. 包囲は即時決着ではなく時間で効く。
6. 突破は短時間の強化と失敗リスクを持つ。
7. 片翼前進はArmySlimeの連続形状として実行され、独立部隊へ分裂しない。
8. 回転は瞬間的な見た目変更ではなく、命令遅延と物理追従を持つ。
9. 粒子は表示従属であり、プレイヤーの操作単位にしない。
10. 幅だけではリンクを損傷させず、敵圧による局所応力が実効靱性を超えた場合だけ耐久度を失う。
11. 分裂前後で総質量を保存する。
12. 分裂後の各スライムは、それぞれ独立した連続体として振る舞う。

## 26. 変更時の確認項目

### 形状

- 幅・奥行きの上限下限内で形状が発散しないか
- 片翼前進後も輪郭が閉じているか
- 30秒以上の接触で帯状に無限伸長しないか
- 安全幅では意図せず分裂しないか
- 最大展開維持でリンクが切断され分裂するか
- 分裂前後の質量合計が一致するか
- 分裂した各スライムをタップ選択できるか

### ZOC

- 正面衝突で相互にすり抜けないか
- 展開姿勢が敵輪郭に沿って滑るか
- 突破姿勢が過剰に側面へ逃げないか

### バランス

- 展開時に `gapRisk` が増えるか
- 密集維持時に `crowding` が増えるか
- 包囲線が薄いと `ringIntegrity` が下がるか
- 突破失敗時に疲労・士気・結束が減るか

### 入力

- ピンチアウト＋前進が包囲前進になるか
- ピンチイン＋前進が突破になるか
- 両指回転が片翼前進と誤認されないか
- 片方の指だけ前進した場合、左右翼が正しく判定されるか

## 27. 実装ファイル対応表

| 仕様領域 | 実装 |
|---|---|
| 型・全パラメーター | `src/sim/types.ts` |
| 初期生成・ノード・リンク・粒子 | `src/sim/slime.ts` |
| 形状目標・ばね・密度・積分 | `src/sim/slimePhysics.ts` |
| 命令遅延・命令反映 | `src/sim/slimeOrders.ts` |
| ZOC境界・局所ZOC | `src/sim/zoc.ts` |
| 接触面・戦闘 | `src/sim/slimeCombat.ts` |
| 包囲・ringIntegrity | `src/sim/encirclement.ts` |
| リンク切断・分裂 | `src/sim/slimeSplit.ts` |
| 敵AI | `src/sim/enemyAI.ts` |
| 敗走開始・離脱方向・立て直し | `src/sim/routing.ts` |
| リンク負荷順・ノード名・原因判定 | `src/sim/stressDiagnostics.ts` |
| 更新順・勝敗 | `src/sim/simulation.ts` |
| 二本指判定 | `src/input/GestureAnalyzer.ts` |
| 二本指命令変換 | `src/input/PinchGestureController.ts` |
| 一本指移動命令 | `src/input/DragIntentController.ts` |
| 本体・粒子・ZOC・接触描画 | `src/ui/SlimeOverlay.ts` |
| HUD | `src/ui/MobileHUD.ts` |
