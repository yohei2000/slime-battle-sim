$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $Root "public/assets/generated"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function ColorA([int]$A, [int]$R, [int]$G, [int]$B) {
  return [System.Drawing.Color]::FromArgb($A, $R, $G, $B)
}

function BrushA([int]$A, [int]$R, [int]$G, [int]$B) {
  return [System.Drawing.SolidBrush]::new((ColorA $A $R $G $B))
}

function PenA([int]$A, [int]$R, [int]$G, [int]$B, [float]$Width = 1.0) {
  return [System.Drawing.Pen]::new((ColorA $A $R $G $B), $Width)
}

function RectF([float]$X, [float]$Y, [float]$W, [float]$H) {
  return [System.Drawing.RectangleF]::new($X, $Y, $W, $H)
}

function New-RoundedPath([float]$X, [float]$Y, [float]$W, [float]$H, [float]$Radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $Radius * 2
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Save-Bitmap([string]$Path, [int]$Width, [int]$Height, [scriptblock]$Draw) {
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  & $Draw $graphics $Width $Height
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Draw-Texture([System.Drawing.Graphics]$G, [int]$W, [int]$H, [int]$Seed) {
  $random = [System.Random]::new($Seed)
  $count = [Math]::Max(1200, [int](($W * $H) / 1400))
  for ($i = 0; $i -lt $count; $i++) {
    $x = $random.NextDouble() * $W
    $y = $random.NextDouble() * $H
    $a = 8 + $random.Next(28)
    $brush = BrushA $a (140 + $random.Next(80)) (170 + $random.Next(60)) (170 + $random.Next(70))
    $size = 0.9 + $random.NextDouble() * 3.5
    $G.FillEllipse($brush, $x, $y, $size, $size)
    $brush.Dispose()
  }

  for ($i = 0; $i -lt 70; $i++) {
    $x = $random.NextDouble() * $W
    $y = $random.NextDouble() * $H
    $length = 80 + $random.NextDouble() * 260
    $pen = PenA (14 + $random.Next(26)) (120 + $random.Next(80)) (160 + $random.Next(70)) (170 + $random.Next(65)) (1 + $random.NextDouble() * 3)
    $G.DrawLine($pen, $x, $y, $x + $length, $y - 20 + $random.NextDouble() * 40)
    $pen.Dispose()
  }
}

function Fill-Gradient([System.Drawing.Graphics]$G, [int]$W, [int]$H, [System.Drawing.Color]$Top, [System.Drawing.Color]$Bottom) {
  $rect = [System.Drawing.Rectangle]::new(0, 0, $W, $H)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $Top, $Bottom, 90)
  $G.FillRectangle($brush, $rect)
  $brush.Dispose()
}

function Draw-HumanFigure([System.Drawing.Graphics]$G, [float]$X, [float]$Y, [float]$S, [System.Drawing.Color]$Coat, [System.Drawing.Color]$Accent) {
  $shadow = BrushA 120 0 0 0
  $G.FillEllipse($shadow, $X - 15 * $S, $Y + 35 * $S, 30 * $S, 7 * $S)
  $shadow.Dispose()

  $coatBrush = [System.Drawing.SolidBrush]::new($Coat)
  $accentPen = [System.Drawing.Pen]::new($Accent, 1.6 * $S)
  $skin = BrushA 225 203 166 124
  $dark = BrushA 230 8 12 16
  $G.FillEllipse($skin, $X - 5 * $S, $Y - 26 * $S, 10 * $S, 12 * $S)
  $G.FillPolygon($coatBrush, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($X - 10 * $S, $Y - 12 * $S),
    [System.Drawing.PointF]::new($X + 11 * $S, $Y - 12 * $S),
    [System.Drawing.PointF]::new($X + 15 * $S, $Y + 32 * $S),
    [System.Drawing.PointF]::new($X - 14 * $S, $Y + 32 * $S)
  ))
  $G.FillRectangle($dark, (RectF ($X - 12 * $S) ($Y + 29 * $S) (8 * $S) (18 * $S)))
  $G.FillRectangle($dark, (RectF ($X + 4 * $S) ($Y + 29 * $S) (8 * $S) (18 * $S)))
  $G.DrawLine($accentPen, $X - 8 * $S, $Y + 2 * $S, $X + 9 * $S, $Y + 2 * $S)
  $G.DrawLine($accentPen, $X, $Y - 10 * $S, $X, $Y + 29 * $S)
  $coatBrush.Dispose()
  $accentPen.Dispose()
  $skin.Dispose()
  $dark.Dispose()
}

function Draw-StrategyBackground([System.Drawing.Graphics]$G, [int]$W, [int]$H) {
  Fill-Gradient $G $W $H (ColorA 255 7 17 24) (ColorA 255 20 31 42)
  Draw-Texture $G $W $H 731

  $wall = BrushA 92 33 48 58
  for ($x = -40; $x -lt $W + 80; $x += 140) {
    $G.FillRectangle($wall, $x, 0, 70, $H)
  }
  $wall.Dispose()

  $windowBrush = BrushA 72 70 153 167
  $windowPen = PenA 145 95 198 210 3
  for ($i = 0; $i -lt 6; $i++) {
    $x = $W * (0.08 + $i * 0.16)
    $path = New-RoundedPath $x ($H * 0.08) ($W * 0.07) ($H * 0.24) 18
    $G.FillPath($windowBrush, $path)
    $G.DrawPath($windowPen, $path)
    $G.DrawLine($windowPen, $x + $W * 0.035, $H * 0.09, $x + $W * 0.035, $H * 0.31)
    $path.Dispose()
  }
  $windowBrush.Dispose()
  $windowPen.Dispose()

  $bannerBrush = BrushA 150 104 38 53
  $bannerGold = PenA 160 229 178 88 5
  for ($i = 0; $i -lt 5; $i++) {
    $x = $W * (0.12 + $i * 0.18)
    $G.FillPolygon($bannerBrush, [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new($x, $H * 0.05),
      [System.Drawing.PointF]::new($x + $W * 0.045, $H * 0.05),
      [System.Drawing.PointF]::new($x + $W * 0.041, $H * 0.31),
      [System.Drawing.PointF]::new($x + $W * 0.023, $H * 0.27),
      [System.Drawing.PointF]::new($x + $W * 0.006, $H * 0.31)
    ))
    $G.DrawLine($bannerGold, $x + $W * 0.01, $H * 0.12, $x + $W * 0.036, $H * 0.12)
  }
  $bannerBrush.Dispose()
  $bannerGold.Dispose()

  $tableShadow = BrushA 160 0 0 0
  $G.FillEllipse($tableShadow, (RectF ($W * 0.08) ($H * 0.56) ($W * 0.84) ($H * 0.54)))
  $tableShadow.Dispose()

  $tableBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    (RectF ($W * 0.06) ($H * 0.48) ($W * 0.88) ($H * 0.52)),
    (ColorA 255 58 33 26),
    (ColorA 255 16 15 19),
    90
  )
  $G.FillEllipse($tableBrush, (RectF ($W * 0.06) ($H * 0.48) ($W * 0.88) ($H * 0.52)))
  $tableBrush.Dispose()

  $mapPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $mapPath.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($W * 0.24, $H * 0.42),
    [System.Drawing.PointF]::new($W * 0.76, $H * 0.36),
    [System.Drawing.PointF]::new($W * 0.83, $H * 0.72),
    [System.Drawing.PointF]::new($W * 0.20, $H * 0.77)
  ))
  $mapBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    (RectF ($W * 0.18) ($H * 0.32) ($W * 0.68) ($H * 0.5)),
    (ColorA 238 180 150 101),
    (ColorA 238 100 83 62),
    20
  )
  $G.FillPath($mapBrush, $mapPath)
  $mapBrush.Dispose()
  $mapPen = PenA 190 66 48 34 4
  $G.DrawPath($mapPen, $mapPath)
  $mapPen.Dispose()

  $routePen = PenA 150 61 79 72 3
  $goldPen = PenA 180 229 178 88 4
  for ($i = 0; $i -lt 9; $i++) {
    $y = $H * (0.44 + $i * 0.035)
    $G.DrawBezier($routePen, $W * 0.27, $y, $W * 0.42, $y - 40, $W * 0.57, $y + 35, $W * 0.78, $y - 6)
  }
  for ($i = 0; $i -lt 5; $i++) {
    $x = $W * (0.30 + $i * 0.095)
    $G.DrawLine($goldPen, $x, $H * 0.44, $x + $W * 0.09, $H * 0.74)
  }
  $routePen.Dispose()
  $goldPen.Dispose()

  $markerBrush = BrushA 235 26 52 66
  $markerPen = PenA 220 255 209 117 2
  $points = @(
    @(($W * 0.35), ($H * 0.52)),
    @(($W * 0.48), ($H * 0.62)),
    @(($W * 0.61), ($H * 0.50)),
    @(($W * 0.70), ($H * 0.66))
  )
  foreach ($p in $points) {
    $G.FillEllipse($markerBrush, $p[0] - 12, $p[1] - 12, 24, 24)
    $G.DrawEllipse($markerPen, $p[0] - 12, $p[1] - 12, 24, 24)
  }
  $markerBrush.Dispose()
  $markerPen.Dispose()

  $unitBrush = BrushA 235 28 65 78
  $unitAccent = PenA 230 255 218 139 2.4
  for ($row = 0; $row -lt 5; $row++) {
    for ($col = 0; $col -lt 10; $col++) {
      $ux = $W * 0.37 + $col * $W * 0.026 + ($row % 2) * $W * 0.012
      $uy = $H * 0.47 + $row * $H * 0.043
      $G.FillRectangle($unitBrush, (RectF $ux $uy ($W * 0.014) ($H * 0.009)))
      if ($col % 3 -eq 0) { $G.DrawLine($unitAccent, $ux, $uy - $H * 0.012, $ux + $W * 0.014, $uy - $H * 0.012) }
    }
  }
  $unitBrush.Dispose()
  $unitAccent.Dispose()

  $ledgerBrush = BrushA 235 52 42 33
  $paperBrush = BrushA 220 204 176 127
  $G.FillRectangle($ledgerBrush, (RectF ($W * 0.075) ($H * 0.27) ($W * 0.18) ($H * 0.33)))
  $G.FillRectangle($paperBrush, (RectF ($W * 0.10) ($H * 0.30) ($W * 0.14) ($H * 0.25)))
  $ledgerBrush.Dispose()
  $paperBrush.Dispose()

  $linePen = PenA 70 42 33 25 2
  for ($i = 0; $i -lt 9; $i++) {
    $G.DrawLine($linePen, $W * 0.115, $H * (0.33 + $i * 0.022), $W * 0.225, $H * (0.33 + $i * 0.022))
  }
  $linePen.Dispose()

  $glow = BrushA 46 255 190 72
  $G.FillEllipse($glow, (RectF ($W * 0.66) ($H * 0.16) ($W * 0.28) ($H * 0.28)))
  $glow.Dispose()
  $candle = BrushA 240 217 156 82
  $flame = BrushA 250 255 220 120
  for ($i = 0; $i -lt 3; $i++) {
    $cx = $W * (0.72 + $i * 0.045)
    $cy = $H * (0.29 + ($i % 2) * 0.035)
    $G.FillRectangle($candle, (RectF ($cx - 8) ($cy + 18) 16 38))
    $G.FillEllipse($flame, (RectF ($cx - 9) ($cy) 18 30))
  }
  $candle.Dispose()
  $flame.Dispose()

  $coatA = ColorA 235 29 56 68
  $coatB = ColorA 235 70 44 36
  $accent = ColorA 230 229 178 88
  foreach ($fig in @(
    @(($W * 0.18), ($H * 0.73), 2.0, $coatA),
    @(($W * 0.29), ($H * 0.80), 1.65, $coatB),
    @(($W * 0.76), ($H * 0.72), 1.9, $coatA),
    @(($W * 0.85), ($H * 0.80), 1.55, $coatB)
  )) {
    Draw-HumanFigure $G $fig[0] $fig[1] $fig[2] $fig[3] $accent
  }

  $veil = BrushA 48 2 8 12
  $G.FillRectangle($veil, 0, 0, $W, $H)
  $veil.Dispose()
}

function Draw-GrowthBackground([System.Drawing.Graphics]$G, [int]$W, [int]$H) {
  Fill-Gradient $G $W $H (ColorA 255 7 13 25) (ColorA 255 19 26 36)
  Draw-Texture $G $W $H 1193

  $floor = BrushA 150 25 29 37
  $G.FillPolygon($floor, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(0, $H * 0.62),
    [System.Drawing.PointF]::new($W, $H * 0.62),
    [System.Drawing.PointF]::new($W, $H),
    [System.Drawing.PointF]::new(0, $H)
  ))
  $floor.Dispose()

  $columnBrush = BrushA 145 52 57 66
  for ($x = $W * 0.08; $x -lt $W; $x += $W * 0.18) {
    $G.FillRectangle($columnBrush, (RectF $x 0 ($W * 0.045) ($H * 0.68)))
  }
  $columnBrush.Dispose()

  $lampGlow = BrushA 52 255 199 108
  $G.FillEllipse($lampGlow, (RectF ($W * 0.05) ($H * 0.13) ($W * 0.34) ($H * 0.34)))
  $G.FillEllipse($lampGlow, (RectF ($W * 0.63) ($H * 0.10) ($W * 0.30) ($H * 0.30)))
  $lampGlow.Dispose()

  $windowPen = PenA 90 121 214 228 3
  $windowBrush = BrushA 38 49 124 148
  for ($i = 0; $i -lt 4; $i++) {
    $x = $W * (0.18 + $i * 0.17)
    $G.FillRectangle($windowBrush, (RectF $x ($H * 0.13) ($W * 0.09) ($H * 0.21)))
    $G.DrawRectangle($windowPen, $x, $H * 0.13, $W * 0.09, $H * 0.21)
  }
  $windowPen.Dispose()
  $windowBrush.Dispose()

  $board = BrushA 210 16 43 48
  $G.FillRectangle($board, (RectF ($W * 0.31) ($H * 0.16) ($W * 0.38) ($H * 0.25)))
  $board.Dispose()
  $chalk = PenA 145 179 232 211 4
  for ($i = 0; $i -lt 5; $i++) {
    $y = $H * (0.21 + $i * 0.032)
    $G.DrawBezier($chalk, $W * 0.35, $y, $W * 0.43, $y - 24, $W * 0.55, $y + 24, $W * 0.65, $y - 4)
  }
  for ($i = 0; $i -lt 6; $i++) {
    $G.DrawEllipse($chalk, $W * (0.38 + $i * 0.045), $H * (0.31 + ($i % 2) * 0.025), 18, 10)
  }
  $chalk.Dispose()

  $paper = BrushA 230 191 164 115
  $paperLine = PenA 115 80 62 42 2
  for ($i = 0; $i -lt 5; $i++) {
    $px = $W * (0.35 + $i * 0.052)
    $py = $H * (0.54 + ($i % 2) * 0.045)
    $G.FillRectangle($paper, (RectF $px $py ($W * 0.042) ($H * 0.034)))
    $G.DrawLine($paperLine, $px + 7, $py + 11, $px + $W * 0.035, $py + 11)
    $G.DrawLine($paperLine, $px + 7, $py + 22, $px + $W * 0.029, $py + 22)
  }
  $paper.Dispose()
  $paperLine.Dispose()

  $tableGlow = BrushA 44 71 226 190
  $G.FillEllipse($tableGlow, (RectF ($W * 0.25) ($H * 0.50) ($W * 0.50) ($H * 0.28)))
  $tableGlow.Dispose()
  $table = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    (RectF ($W * 0.28) ($H * 0.54) ($W * 0.44) ($H * 0.23)),
    (ColorA 255 47 45 45),
    (ColorA 255 15 18 24),
    90
  )
  $G.FillEllipse($table, (RectF ($W * 0.28) ($H * 0.54) ($W * 0.44) ($H * 0.23)))
  $table.Dispose()

  $tacticPen = PenA 185 108 255 218 5
  for ($i = 0; $i -lt 4; $i++) {
    $G.DrawBezier(
      $tacticPen,
      $W * (0.34 + $i * 0.035), $H * (0.62 + $i * 0.01),
      $W * 0.43, $H * 0.57,
      $W * 0.56, $H * 0.68,
      $W * (0.65 - $i * 0.02), $H * (0.61 + $i * 0.018)
    )
  }
  $tacticPen.Dispose()

  $sil = BrushA 170 5 8 12
  $gold = PenA 150 255 209 117 3
  for ($i = 0; $i -lt 8; $i++) {
    $x = $W * (0.17 + $i * 0.095)
    $y = $H * (0.58 + (($i + 1) % 2) * 0.03)
    $G.FillEllipse($sil, $x, $y - 34, 20, 24)
    $G.FillRectangle($sil, (RectF ($x - 3) ($y - 10) 26 58))
    $G.DrawLine($gold, $x + 8, $y - 2, $x + 35, $y - 16)
  }
  $sil.Dispose()
  $gold.Dispose()

  $coatBlue = ColorA 232 27 58 70
  $coatWine = ColorA 232 81 39 55
  $accent = ColorA 230 238 198 101
  foreach ($fig in @(
    @(($W * 0.20), ($H * 0.71), 1.82, $coatBlue),
    @(($W * 0.27), ($H * 0.76), 1.55, $coatWine),
    @(($W * 0.72), ($H * 0.70), 1.78, $coatBlue),
    @(($W * 0.80), ($H * 0.78), 1.50, $coatWine),
    @(($W * 0.50), ($H * 0.48), 1.28, $coatBlue)
  )) {
    Draw-HumanFigure $G $fig[0] $fig[1] $fig[2] $fig[3] $accent
  }

  $bannerBrush = BrushA 150 75 30 44
  for ($i = 0; $i -lt 3; $i++) {
    $x = $W * (0.12 + $i * 0.33)
    $G.FillPolygon($bannerBrush, [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new($x, $H * 0.08),
      [System.Drawing.PointF]::new($x + $W * 0.045, $H * 0.08),
      [System.Drawing.PointF]::new($x + $W * 0.040, $H * 0.35),
      [System.Drawing.PointF]::new($x + $W * 0.022, $H * 0.31),
      [System.Drawing.PointF]::new($x + $W * 0.005, $H * 0.35)
    ))
  }
  $bannerBrush.Dispose()

  $veil = BrushA 42 2 8 15
  $G.FillRectangle($veil, 0, 0, $W, $H)
  $veil.Dispose()
}

function Draw-IconBase([System.Drawing.Graphics]$G, [int]$W, [int]$H, [System.Drawing.Color]$Accent, [int]$Seed) {
  Fill-Gradient $G $W $H (ColorA 255 9 20 29) (ColorA 255 20 30 38)
  $path = New-RoundedPath 10 10 ($W - 20) ($H - 20) 28
  $accentBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new($path)
  $accentBrush.CenterColor = [System.Drawing.Color]::FromArgb(90, $Accent)
  $accentBrush.SurroundColors = [System.Drawing.Color[]]@((ColorA 0 0 0 0))
  $G.FillPath($accentBrush, $path)
  $accentBrush.Dispose()
  Draw-Texture $G $W $H $Seed
  $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(215, 233, 185, 96), 4)
  $G.DrawPath($border, $path)
  $border.Dispose()
  $inner = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(130, $Accent), 2)
  $G.DrawEllipse($inner, 36, 34, $W - 72, $H - 70)
  $inner.Dispose()
  $path.Dispose()
}

function Draw-Icon([string]$Path, [string]$Kind, [int]$R, [int]$Gv, [int]$B, [int]$Seed) {
  Save-Bitmap $Path 512 512 {
    param($G, $W, $H)
    $G.ScaleTransform(2.0, 2.0)
    $W = 256
    $H = 256
    $accent = ColorA 255 $R $Gv $B
    Draw-IconBase $G $W $H $accent $Seed
    $main = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(240, $accent), 10)
    $main.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $main.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $bright = [System.Drawing.Pen]::new((ColorA 220 238 250 236), 4)
    $fill = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, $accent))
    $dark = BrushA 220 7 13 18
    $gold = BrushA 235 235 180 82

    switch ($Kind) {
      "skirmisher" {
        for ($i = 0; $i -lt 5; $i++) {
          $x = 68 + $i * 30
          $y = 140 + [Math]::Sin($i) * 24
          $G.FillEllipse($fill, $x - 11, $y - 11, 22, 22)
          $G.DrawLine($main, 128, 82, $x, $y)
        }
        $G.DrawBezier($bright, 54, 164, 94, 114, 164, 190, 210, 124)
      }
      "engineer" {
        $G.FillRectangle($fill, (RectF 64 142 128 28))
        for ($i = 0; $i -lt 4; $i++) { $G.DrawLine($main, 72 + $i * 36, 168, 112 + $i * 28, 104) }
        $G.DrawLine($bright, 84, 82, 180, 178)
        $G.FillEllipse($gold, 62, 62, 42, 42)
      }
      "logistics" {
        $G.FillRectangle($fill, (RectF 62 98 112 64))
        $G.FillPolygon($fill, [System.Drawing.PointF[]]@(
          [System.Drawing.PointF]::new(174, 116),
          [System.Drawing.PointF]::new(210, 138),
          [System.Drawing.PointF]::new(174, 160)
        ))
        $G.FillEllipse($dark, 76, 166, 34, 34)
        $G.FillEllipse($dark, 160, 166, 34, 34)
        $G.DrawLine($bright, 64, 92, 174, 92)
      }
      "courier" {
        $G.DrawLine($main, 80, 184, 112, 72)
        $G.DrawLine($main, 156, 184, 142, 74)
        $G.FillPolygon($fill, [System.Drawing.PointF[]]@(
          [System.Drawing.PointF]::new(112, 74),
          [System.Drawing.PointF]::new(184, 94),
          [System.Drawing.PointF]::new(112, 122)
        ))
        $G.DrawBezier($bright, 52, 154, 92, 96, 154, 184, 206, 108)
      }
      "discipline" {
        for ($i = 0; $i -lt 4; $i++) {
          $G.FillRectangle($fill, (RectF (60 + $i * 36) (92 + ($i % 2) * 16) 26 82))
          $G.DrawLine($bright, 56 + $i * 36, 88 + ($i % 2) * 16, 90 + $i * 36, 180)
        }
        $G.DrawLine($main, 54, 190, 204, 190)
      }
      "medic" {
        $G.FillEllipse($fill, 62, 68, 132, 132)
        $G.FillRectangle($dark, (RectF 112 84 32 100))
        $G.FillRectangle($dark, (RectF 78 118 100 32))
        $G.DrawArc($bright, 46, 52, 164, 164, 205, 130)
      }
      "control" {
        $G.FillEllipse($fill, 106, 96, 44, 44)
        for ($i = 0; $i -lt 5; $i++) {
          $angle = -1.2 + $i * 0.6
          $x = 128 + [Math]::Cos($angle) * 74
          $y = 132 + [Math]::Sin($angle) * 54
          $G.DrawLine($main, 128, 132, $x, $y)
          $G.FillEllipse($gold, $x - 10, $y - 10, 20, 20)
        }
        $G.DrawArc($bright, 42, 72, 172, 122, 15, 150)
      }
    }

    $main.Dispose()
    $bright.Dispose()
    $fill.Dispose()
    $dark.Dispose()
    $gold.Dispose()
  }
}

Save-Bitmap (Join-Path $OutDir "strategy-bg-20260621b.png") 2400 1350 ${function:Draw-StrategyBackground}
Save-Bitmap (Join-Path $OutDir "growth-bg-20260621b.png") 2400 1350 ${function:Draw-GrowthBackground}

Draw-Icon (Join-Path $OutDir "skill-membrane-ripple-20260621b.png") "skirmisher" 53 216 255 211
Draw-Icon (Join-Path $OutDir "skill-boring-tendril-20260621b.png") "engineer" 255 209 102 337
Draw-Icon (Join-Path $OutDir "skill-spore-core-20260621b.png") "logistics" 99 212 113 463
Draw-Icon (Join-Path $OutDir "skill-nerve-gel-20260621b.png") "courier" 156 141 255 587
Draw-Icon (Join-Path $OutDir "skill-shell-grains-20260621b.png") "discipline" 244 180 95 641
Draw-Icon (Join-Path $OutDir "skill-absorption-vacuole-20260621b.png") "medic" 255 145 170 739
Draw-Icon (Join-Path $OutDir "skill-zoc-ring-20260621b.png") "control" 43 214 163 853

Write-Host "Generated art assets in $OutDir"
