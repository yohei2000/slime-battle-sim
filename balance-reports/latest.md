# Balance Report

Generated: 2026-06-22T15:31:20.975Z
Seeds: 1001, 1002, 1003, 1004
Max seconds: 120
Simulation speed: 1

## Verdict

- CPU基準: 敵スコア率 63% OK（目標55〜65%）
- プレイヤー方針: 自軍スコア率 63% OK（目標55〜70%）
- 突破一強チェック: 自軍スコア率 38% OK
- 包囲一強チェック: 自軍スコア率 63% OK

## Summary

| Policy | Battles | Player W-L-D | Player score | Enemy score | Avg seconds | Avg morale P/E | Avg max encirclement enemy/player |
|---|---:|---:|---:|---:|---:|---:|---:|
| cpu-basic | 4 | 1-2-1 | 38% | 63% | 60.1 | 42.0/70.7 | 0.21/0.08 |
| player-adaptive | 4 | 1-0-3 | 63% | 38% | 98.5 | 70.6/37.9 | 0.52/0.01 |
| breakthrough-only | 4 | 1-2-1 | 38% | 63% | 87.0 | 37.8/68.6 | 0.00/0.04 |
| envelop-only | 4 | 2-1-1 | 63% | 38% | 69.6 | 57.1/33.0 | 0.60/0.01 |

## Battles

| Policy | Seed | Winner | Seconds | Score | Cause | Morale P/E | Cohesion P/E | Splits P/E | Max encirclement enemy/player | Max gap P/E |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|---:|
| cpu-basic | 1001 | enemy | 46.5 | -91.5 | enemy-breakthrough | 23.8/92.9 | 0.0/44.1 | 0/0 | 0.02/0.12 | 1.00/0.51 |
| cpu-basic | 1002 | enemy | 39.8 | -122.1 | player-fracture | 22.6/92.8 | 0.0/92.6 | 1/0 | 0.04/0.13 | 0.87/0.73 |
| cpu-basic | 1003 | timeout | 120.0 | -60.5 | timeout-enemy-edge | 36.6/85.4 | 0.0/8.6 | 2/1 | 0.06/0.06 | 1.00/0.98 |
| cpu-basic | 1004 | player | 34.3 | 133.7 | player-encirclement | 85.0/11.6 | 75.6/0.0 | 0/1 | 0.70/0.00 | 0.35/1.00 |
| player-adaptive | 1001 | timeout | 120.0 | 52.9 | timeout-player-edge | 64.8/34.3 | 0.0/0.0 | 1/2 | 0.56/0.01 | 1.00/1.00 |
| player-adaptive | 1002 | player | 34.0 | 117.6 | player-encirclement | 82.3/23.7 | 74.8/0.0 | 0/0 | 0.99/0.01 | 0.62/0.70 |
| player-adaptive | 1003 | timeout | 120.0 | 52.4 | timeout-player-edge | 76.2/31.9 | 4.1/0.0 | 1/1 | 0.24/0.00 | 0.87/1.00 |
| player-adaptive | 1004 | timeout | 120.0 | 4.7 | timeout-player-edge | 59.0/61.7 | 0.0/0.0 | 1/1 | 0.28/0.00 | 1.00/1.00 |
| breakthrough-only | 1001 | timeout | 120.0 | -60.5 | timeout-enemy-edge | 28.8/79.4 | 0.0/0.4 | 2/1 | 0.00/0.07 | 1.00/1.00 |
| breakthrough-only | 1002 | enemy | 51.2 | -108.8 | enemy-breakthrough | 23.7/91.7 | 0.0/85.5 | 0/0 | 0.00/0.09 | 0.71/0.63 |
| breakthrough-only | 1003 | enemy | 94.2 | -93.7 | enemy-breakthrough | 18.4/89.4 | 0.0/49.5 | 1/1 | 0.00/0.02 | 1.00/0.93 |
| breakthrough-only | 1004 | player | 82.4 | 87.6 | enemy-fracture | 80.2/13.8 | 11.4/0.0 | 0/2 | 0.00/0.00 | 0.50/1.00 |
| envelop-only | 1001 | player | 59.3 | 108.8 | player-encirclement | 83.2/23.8 | 52.9/0.0 | 0/0 | 1.00/0.02 | 0.84/0.79 |
| envelop-only | 1002 | timeout | 120.0 | 30.2 | timeout-player-edge | 39.6/33.9 | 0.0/0.3 | 0/2 | 0.35/0.02 | 1.00/1.00 |
| envelop-only | 1003 | player | 42.7 | 138.4 | player-encirclement | 81.5/7.9 | 68.7/0.0 | 0/2 | 0.69/0.00 | 0.74/1.00 |
| envelop-only | 1004 | enemy | 56.4 | -39.0 | enemy-breakthrough | 23.9/66.6 | 0.0/13.7 | 0/0 | 0.38/0.00 | 1.00/1.00 |
