# Strategy Layer Design

基準日: 2026-06-20

> 世界観の正本は [世界観ガイド](worldview-guide.md) です。この文書内に残る「スライム」「群体」「胞子」などの語は、原則として内部実装・挙動比喩として読み替えます。ユーザー向け表示では「軍塊」「弾性軍制」「予備兵」「工兵資材」など、人間国家の軍事語彙へ寄せます。

この設計は、現在の戦闘体験を中心にしたまま、内政・外交・戦略マップを追加するための上位レイヤー案です。目的は大きな 4X を作ることではなく、「なぜこの戦いが起きたか」「戦闘前に何を準備したか」「戦闘後に何が残ったか」を、次の戦闘へ自然に持ち越すことです。

## 1. Core Idea

戦略レイヤーの主役は都市でも個別ユニットでもなく、領域に広がるスライム群体です。

プレイヤーは戦略マップで領土、資源、外交関係、前線圧力を管理し、その結果として戦闘シーンへ入ります。戦闘シーンでは今ある `ArmySlime` の性質がそのまま見えるため、キャンペーン判断は次のような形で戦闘中の手触りに変換されます。

| 戦略判断 | 戦闘に出る変化 |
|---|---|
| 休養を取る | `fatigue` が低く、命令遅延と亀裂リスクが下がる |
| 増殖を急ぐ | `mass` は増えるが、`cohesion` と `commandDelay` が悪化する |
| 訓練・儀式に投資する | `morale` / `cohesion` が上がり、ZOC と包囲維持が強くなる |
| 外殻強化を進める | `toughness` が上がるが、機動や外交コストが重くなる |
| 補給線を伸ばす | 遠征可能になるが、孤立時に `fatigue` と `morale` が崩れやすい |
| 同盟・通行条約を結ぶ | 迂回路や安全な後方が増え、戦闘開始位置が有利になる |

## 2. Player Loop

1 ターンは短く、毎回「準備して、選んで、戦う」流れにします。

```text
Turn Report
  -> Strategy Map
  -> Domestic Order
  -> Diplomacy Order
  -> Conflict Selection
  -> Battle Setup
  -> Battle
  -> After Action
  -> Next Turn
```

### Turn Report

前ターンの結果を 3 行程度で伝えます。

- 領土: どこが脅かされているか
- 群体: 士気、結束、疲労、亀裂、質量の変化
- 外交: 関係が動いた勢力、約束、裏切りの予兆

### Strategy Map

ノード接続型の地図を使います。ヘクス全面管理より軽く、スマホでも扱いやすいです。

- 地域ノード: 湿地、胞子森、石灰洞、廃坑、塩湖など
- 接続線: 侵攻路、交易路、補給路、隠し迂回路
- 前線圧力: 隣接勢力から押されている度合い
- 補給状態: 自軍領土からつながっているか

### Domestic Order

内政は「都市建設」ではなく、群体の体質と戦争準備を変える命令に絞ります。

各ターン 1 つの主命令と、資源があれば小命令を 1 つ選びます。

### Diplomacy Order

外交は会話劇ではなく、マップ上の行動可能範囲と戦闘条件を変える仕組みにします。

関係値だけでなく、条約と約束を明示します。

### Conflict Selection

そのターンに発生している戦闘候補から、どれを手動戦闘するか選びます。小競り合いは自動解決でもよいですが、重要戦闘は手動で触る価値が出るようにします。

### Battle Setup

戦闘開始前に、内政・外交・地形が `ArmySlime` へどう反映されるかを表示します。

- 初期 `mass`
- 初期 `morale`
- 初期 `cohesion`
- 初期 `fatigue`
- `toughness`
- `commandDelay`
- 地形による幅・深さ・ZOC 補正
- 援軍到着までの時間

### After Action

戦闘後は勝敗だけでなく、残った状態をキャンペーンへ戻します。

- 分裂したスライムは別部隊として残る
- 敗走したスライムは休養または再編が必要
- 亀裂が大きかった部隊は次ターンに `cohesion` が戻りにくい
- 勝利しても疲労が高ければ追撃できない
- 外交上の約束を守ったかどうかで信頼が動く

## 3. Strategy Map

### Region

地域は戦闘シナリオの源泉です。

```ts
type Region = {
  id: string;
  name: string;
  terrain: "marsh" | "forest" | "cavern" | "plain" | "ruin" | "salt";
  ownerFactionId: string;
  adjacentRegionIds: string[];
  resources: RegionResources;
  fortification: number;
  supplyLimit: number;
  unrest: number;
  frontPressure: number;
};
```

### Terrain Effects

| 地形 | 戦略上の意味 | 戦闘上の意味 |
|---|---|---|
| 湿地 | 防衛しやすいが補給が細い | `viscosity` 上昇、突破が鈍い |
| 胞子森 | 回復と増殖に強い | `morale` 回復、視界や接触開始が曖昧 |
| 石灰洞 | 狭い接続路 | `desiredWidth` 上限、包囲しにくい |
| 平原 | 大軍が使いやすい | 幅を取りやすく包囲戦が起きやすい |
| 廃墟 | 旧文明資源 | 外殻強化や外交資源が得られる |
| 塩湖 | 危険地帯 | 疲労増、長期戦で `cohesion` 低下 |

### Map Objectives

戦略マップの勝ち筋は、首都占領だけにしません。スライムらしい勝利条件にします。

- 胞子源を 3 つ確保する
- 敵の補給粘液路を切る
- 中立群体を同盟化する
- 古い外殻遺跡を守りきる
- 敵の主群体を分裂させて吸収する

## 4. Domestic Design

内政は「群体の性格を作る」システムです。すべての選択は戦闘の値へ落とします。

### Resources

| 資源 | 用途 |
|---|---|
| Nutrient | 増殖、回復、補給 |
| Spores | 新しい部隊、外交贈与、諜報 |
| Gel | 結束維持、命令伝達、補給路 |
| Shell | 靱性、要塞、突破耐性 |
| Memory | 訓練、AI 予測、外交信用 |

### Domestic Orders

| 命令 | 効果 | 代償 |
|---|---|---|
| 増殖槽を開く | `mass` 増加 | `cohesion` 低下、補給消費増 |
| 結束儀式 | `cohesion` / `morale` 増加 | `mass` 増加なし、行動が遅れる |
| 休眠回復 | `fatigue` 低下、亀裂回復 | そのターン侵攻不可 |
| 外殻硬化 | `toughness` 増加 | `viscosity` 増、命令追従が遅い |
| 伝令粘液路 | `commandDelay` 低下、包囲維持増 | Gel 消費、補給線を狙われる |
| 斥候胞子 | 敵の戦闘初期姿勢を表示 | Spores 消費、失敗で外交悪化 |

### Domestic UX

内政画面は「施設一覧」よりも「今ターンの群体状態」を中心にします。

```text
群体状態
  質量: 112 (+8)
  士気: 78 (-3)
  結束: 69 (-9)
  疲労: 34 (+12)
  亀裂: 18%

主命令
  [増殖] [休眠] [結束] [硬化] [伝令] [斥候]

予測
  次の戦闘: 質量は増えるが、包囲線が薄くなりやすい
```

## 5. Diplomacy Design

外交は「誰と戦わずに済むか」「どこを通れるか」「どの約束が戦闘条件を変えるか」を扱います。

### Factions

最初は 4 勢力で十分です。

| 勢力 | 性格 | 戦闘傾向 | 外交価値 |
|---|---|---|---|
| Verdant Brood | 増殖重視 | 質量が多いが低結束 | Nutrient 交易 |
| Amber Compact | 約束重視 | 防衛的、士気が高い | 通行条約、信用 |
| Salt Choir | 苛烈 | 高突破、疲労に強い | 共同敵への圧力 |
| Glass Remnant | 技術残滓 | 高靱性、低質量 | Shell / Memory |

### Relation Model

関係値だけではなく、明示的な状態を持ちます。

```ts
type DiplomaticRelation = {
  factionId: string;
  attitude: "war" | "hostile" | "cold" | "neutral" | "warm" | "allied";
  trust: number;
  fear: number;
  debt: number;
  treaties: Treaty[];
  grievance: string[];
};
```

### Treaties

| 条約 | マップ効果 | 戦闘効果 |
|---|---|---|
| 通行条約 | 中立地を通れる | 有利な侵入方向を選べる |
| 補給協定 | 遠征の疲労増を抑える | 初期 `fatigue` 低下 |
| 共同防衛 | 敵が攻めにくくなる | 援軍タイマー |
| 胞子交易 | 増殖や斥候が安い | 戦闘前情報が増える |
| 不可侵 | 前線圧力が下がる | 直接効果なし、背後安全 |

### Diplomacy Actions

- 贈与: 資源を渡して trust を上げる
- 威圧: fear を上げるが grievance も増える
- 共同敵提案: 共通の敵へ圧力を向ける
- 密約: 隠し通行や援軍を得るが発覚リスクがある
- 約束履行: 戦闘で助ける、領土を返す、資源を納める

外交の重要点は、約束違反が戦闘にも戻ることです。信用が低いと援軍が遅れ、同盟軍の士気補正も弱くします。

## 6. Battle Integration

現在の戦闘システムへ入れる値は、まず以下に限定します。

```ts
type BattleScenario = {
  id: string;
  regionId: string;
  attackerFactionId: string;
  defenderFactionId: string;
  objective: "rout" | "hold" | "breakthrough" | "escape" | "delay";
  terrainModifiers: TerrainBattleModifiers;
  playerInitial: ArmySeed;
  enemyInitial: ArmySeed;
  reinforcementTimers: ReinforcementTimer[];
};

type ArmySeed = {
  mass: number;
  morale: number;
  cohesion: number;
  fatigue: number;
  toughness: number;
  elasticity: number;
  viscosity: number;
  commandDelay: number;
  startingPosture?: "neutral" | "spread" | "contract" | "hold";
};
```

### Mapping Rules

| Campaign value | `ArmySlime` 反映 |
|---|---|
| armyMass | `mass` |
| readiness | `morale`, `cohesion` |
| exhaustion | `fatigue` |
| membraneTech | `toughness`, `elasticity` |
| gelNetwork | `commandDelay`, 包囲維持 |
| supplyStatus | 戦闘中の疲労回復、敗走復帰 |
| intelAdvantage | 敵初期姿勢表示、敵 AI 反応遅延 |
| terrainWidth | `desiredWidth` / battlefield bounds |

### Objectives

戦闘の目的を「敵全滅」だけにしないことで、戦略判断が濃くなります。

- Hold: 一定時間、地域ノードを守る
- Breakthrough: 敵の ZOC を割ってマップ上の隣接地域へ抜ける
- Escape: 包囲状態から質量を残して逃がす
- Delay: 同盟援軍到着まで粘る
- Rout: 敵の士気を崩す

## 7. UI Structure

戦略レイヤーは 3 画面構成にします。

### Map Screen

最初に表示されるキャンペーン画面です。

- 中央: ノード型戦略マップ
- 左下: 選択地域の資源・補給・前線圧力
- 右下: 自軍群体の状態
- 上部: ターン、資源、外交警告

### Council Screen

内政命令の画面です。施設ツリーではなく、群体状態と予測を見せます。

- 主命令
- 小命令
- 資源消費
- 次戦闘への予測

### Diplomacy Screen

各勢力をカードではなく、マップ上の勢力境界と条約一覧で見せます。

- 態度
- trust / fear / debt
- 有効条約
- 未履行の約束
- 次に起きそうな外交イベント

## 8. MVP Scope

最初の実装は小さく切ります。

### MVP 1: 戦略マップから戦闘へ入る

- 6 地域ノード
- 3 勢力
- 自軍 1 群体、敵 2 群体
- 地域を選ぶと `BattleScenario` が生成される
- 戦闘後に `morale/cohesion/fatigue/mass` をキャンペーンへ戻す

### MVP 2: 内政命令

- 増殖、休眠、結束、硬化の 4 命令
- 1 ターン 1 命令
- 戦闘開始値へ反映

### MVP 3: 外交と条約

- 通行条約、補給協定、不可侵
- trust と grievance
- 条約により侵攻路と初期疲労が変わる

### MVP 4: 戦闘目的

- Rout
- Hold
- Breakthrough
- Escape

## 9. Design Guardrails

- 戦略レイヤーは戦闘を置き換えない。戦闘を始める理由を作る。
- 数値補正は必ず戦闘 HUD か Battle Setup で見えるようにする。
- 内政は施設数を増やすより、群体の体質変化として表現する。
- 外交は関係値だけで終わらせず、通行・補給・援軍・敵対圧力に落とす。
- 戦略マップの 1 ターンは短くする。迷う時間より、戦闘へ入る期待を優先する。
- 敗北後も面白くする。分裂、敗走、疲労、外交信用の傷を次ターンへ残す。

## 10. Example Turn

1. 前ターン、敵を撃退したが主群体が分裂した。
2. Strategy Map で Salt Choir が塩湖側から前線圧力を上げている。
3. Domestic Order で休眠回復を選ぶと防衛は安定するが、胞子森を取る好機を逃す。
4. Diplomacy で Amber Compact に通行条約を求める。Memory を支払うと成功率が上がる。
5. 通行条約が成立したため、正面の塩湖ではなく胞子森側から迂回侵攻できる。
6. Battle Setup では自軍の `fatigue` がやや高いが、敵の背面から開始できる。
7. 戦闘中、包囲は狙いやすい。ただし高疲労なので長期戦だと亀裂が進む。
8. 勝利後、胞子森を得るが、同盟への未払い debt が残る。

この流れなら、戦略判断は単なる数字管理ではなく、戦闘中の「広げるか、固めるか、どこで割るか」という手触りに戻ってきます。
