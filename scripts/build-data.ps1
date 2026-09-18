$ErrorActionPreference = "Stop"

function Read-BigInt32($bytes, $offset) {
    return ([int]$bytes[$offset] * 16777216 + [int]$bytes[$offset+1] * 65536 + [int]$bytes[$offset+2] * 256 + [int]$bytes[$offset+3])
}

function To-Double($s) {
    if ($null -eq $s) { return [double]::NaN }
    $t = ([string]$s).Trim()
    if ($t -eq "" -or $t -eq "NA" -or $t -eq "NaN") { return [double]::NaN }
    $t = $t -replace ",", "."
    $out = 0.0
    if ([double]::TryParse($t, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$out)) { return $out }
    return [double]::NaN
}

function Pct($s) {
    $v = To-Double $s
    if ([double]::IsNaN($v)) { return $null }
    return [Math]::Round($v * 100, 2)
}

function Num($s) {
    $v = To-Double $s
    if ([double]::IsNaN($v)) { return 0 }
    return [int][Math]::Round($v)
}

function Round-Nullable($v, $digits = 1) {
    if ($null -eq $v -or [double]::IsNaN([double]$v)) { return $null }
    return [Math]::Round([double]$v, $digits)
}

function WeightedAverage($rows, $field, $weightField) {
    $sum = 0.0
    $weightSum = 0.0
    foreach ($row in $rows) {
        $value = $row.$field
        $weight = $row.$weightField
        if ($null -ne $value -and $null -ne $weight -and $weight -gt 0) {
            $sum += ([double]$value * [double]$weight)
            $weightSum += [double]$weight
        }
    }
    if ($weightSum -le 0) { return 0 }
    return [Math]::Round($sum / $weightSum, 2)
}

function Build-SpeedLookup($path) {
    $groups = @{}
    if (-not (Test-Path -LiteralPath $path)) { return @{} }

    foreach ($r in (Import-Csv -LiteralPath $path -Encoding UTF8)) {
        $code = Num $r.codigo_comuna
        if ($code -le 0) { continue }

        $network = if ($r.tipo_red -eq "Fijo") { "fixed" }
            elseif ($r.tipo_red -match "M.vil") { "mobile" }
            else { $null }
        if (-not $network) { continue }

        $tests = Num $r.cantidad_tests
        if ($tests -le 0) { continue }

        $key = "$code|$network"
        if (-not $groups.ContainsKey($key)) {
            $groups[$key] = [ordered]@{
                Code = $code
                Network = $network
                Tests = 0
                Devices = 0
                DownWeighted = 0.0
                UpWeighted = 0.0
                LatencyWeighted = 0.0
            }
        }

        $down = To-Double $r.velocidad_bajada_promedio_mbps
        $up = To-Double $r.velocidad_subida_promedio_mbps
        $latency = To-Double $r.latencia_promedio_ms
        $groups[$key].Tests += $tests
        $groups[$key].Devices += Num $r.cantidad_dispositivos
        if (-not [double]::IsNaN($down)) { $groups[$key].DownWeighted += $down * $tests }
        if (-not [double]::IsNaN($up)) { $groups[$key].UpWeighted += $up * $tests }
        if (-not [double]::IsNaN($latency)) { $groups[$key].LatencyWeighted += $latency * $tests }
    }

    $lookup = @{}
    foreach ($group in $groups.Values) {
        $codeKey = [string]$group.Code
        if (-not $lookup.ContainsKey($codeKey)) {
            $lookup[$codeKey] = [ordered]@{
                fixed = $null
                mobile = $null
            }
        }

        $summary = [pscustomobject]@{
            downMbps = if ($group.Tests -gt 0) { [Math]::Round($group.DownWeighted / $group.Tests, 1) } else { $null }
            upMbps = if ($group.Tests -gt 0) { [Math]::Round($group.UpWeighted / $group.Tests, 1) } else { $null }
            latencyMs = if ($group.Tests -gt 0) { [Math]::Round($group.LatencyWeighted / $group.Tests, 1) } else { $null }
            tests = $group.Tests
            devices = $group.Devices
        }
        $lookup[$codeKey][$group.Network] = $summary
    }

    return $lookup
}

function Read-Dbf($path) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $n = [BitConverter]::ToUInt32($bytes, 4)
    $header = [BitConverter]::ToUInt16($bytes, 8)
    $recLen = [BitConverter]::ToUInt16($bytes, 10)
    $fields = @()
    $off = 32
    while ($bytes[$off] -ne 0x0D) {
        $name = ([Text.Encoding]::ASCII.GetString($bytes, $off, 11)).Trim([char]0).Trim()
        $len = [int]$bytes[$off + 16]
        $fields += [pscustomobject]@{ Name=$name; Len=$len }
        $off += 32
    }
    $rows = @()
    for ($i=0; $i -lt $n; $i++) {
        $ro = $header + ($i * $recLen)
        if ($bytes[$ro] -eq 0x2A) { continue }
        $pos = $ro + 1
        $row = [ordered]@{}
        foreach ($f in $fields) {
            $row[$f.Name] = [Text.Encoding]::GetEncoding(1252).GetString($bytes, $pos, $f.Len).Trim()
            $pos += $f.Len
        }
        $rows += [pscustomobject]$row
    }
    return $rows
}

function Read-Shp($path, $attrs) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $offset = 100
    $idx = 0
    $features = @()
    while ($offset -lt $bytes.Length -and $idx -lt $attrs.Count) {
        $contentWords = Read-BigInt32 $bytes ($offset + 4)
        $contentBytes = $contentWords * 2
        $start = $offset + 8
        $shapeType = [BitConverter]::ToInt32($bytes, $start)
        $partsOut = @()
        if ($shapeType -eq 5 -or $shapeType -eq 15 -or $shapeType -eq 25) {
            $numParts = [BitConverter]::ToInt32($bytes, $start + 36)
            $numPoints = [BitConverter]::ToInt32($bytes, $start + 40)
            $parts = @()
            for ($p=0; $p -lt $numParts; $p++) {
                $parts += [BitConverter]::ToInt32($bytes, $start + 44 + ($p*4))
            }
            $pointsStart = $start + 44 + ($numParts*4)
            for ($p=0; $p -lt $numParts; $p++) {
                $from = $parts[$p]
                $to = if ($p -lt $numParts-1) { $parts[$p+1] - 1 } else { $numPoints - 1 }
                $ring = @()
                $step = [Math]::Max(1, [int][Math]::Ceiling((($to - $from + 1) / 130.0)))
                for ($q=$from; $q -le $to; $q += $step) {
                    $po = $pointsStart + ($q*16)
                    $x = [Math]::Round([BitConverter]::ToDouble($bytes, $po), 2)
                    $y = [Math]::Round([BitConverter]::ToDouble($bytes, $po+8), 2)
                    $ring += ,@($x, $y)
                }
                if ($ring.Count -gt 2) {
                    $po = $pointsStart + ($to*16)
                    $x = [Math]::Round([BitConverter]::ToDouble($bytes, $po), 2)
                    $y = [Math]::Round([BitConverter]::ToDouble($bytes, $po+8), 2)
                    $ring += ,@($x, $y)
                    $partsOut += ,$ring
                }
            }
        }
        $attr = $attrs[$idx]
        $features += [pscustomobject]@{
            type = "Feature"
            properties = [ordered]@{
                code = [int](To-Double $attr.cod_comuna)
                name = $attr.Comuna
                regionCode = [int](To-Double $attr.codregion)
                regionName = $attr.Region
            }
            geometry = [ordered]@{
                type = "Polygon"
                coordinates = $partsOut
            }
        }
        $offset += 8 + $contentBytes
        $idx++
    }
    return [pscustomobject]@{
        type = "FeatureCollection"
        features = $features
    }
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outData = Join-Path $root "public\data\atlas.json"
$outGeo = Join-Path $root "public\data\comunas.geojson"
$csvPath = "C:\Users\sebas\Desktop\abril 2026\master_atlas_epf_desconexion_comunal.csv"
$ooklaPath = "C:\Users\sebas\Desktop\abril 2026\ookla_chile_q1_2026_master_calce_comunal_actualizado.csv"
$shapeBase = "C:\Users\sebas\Desktop\atlas_cotel_codex_work\shapes\Comunas\comunas"

$rows = Import-Csv -LiteralPath $csvPath -Encoding UTF8
$speedByCode = Build-SpeedLookup $ooklaPath
$maxScore = ($rows | ForEach-Object { To-Double $_.score_digital_presion } | Measure-Object -Maximum).Maximum
$communes = @()
foreach ($r in $rows) {
    $score = To-Double $r.score_digital_presion
    $ivd = if ($maxScore -gt 0) { [Math]::Round(($score / $maxScore) * 100, 1) } else { 0 }
    $solo = Pct $r.hogares_trampa_movil_pct
    $fija = Pct $r.hogares_con_internet_fija_pct
    $sust = [Math]::Round(((($solo / 100) + ((100 - $fija) / 100)) / 2) * 100, 1)
    $code = [int](To-Double $r.comuna)
    $validCommune = Num $r.hogares_validos_internet
    $noInternetCommune = Num $r.hogares_sin_internet_n
    $soloMovilCommune = Num $r.hogares_trampa_movil_n
    $functionalGapCommune = $noInternetCommune + $soloMovilCommune
    $speeds = if ($speedByCode.ContainsKey([string]$code)) { $speedByCode[[string]$code] } else { $null }
    $fixedSpeed = if ($null -ne $speeds) { $speeds.fixed } else { $null }
    $mobileSpeed = if ($null -ne $speeds) { $speeds.mobile } else { $null }
    $communes += [pscustomobject]@{
        code = $code
        name = $r.comuna_nombre
        regionCode = [int](To-Double $r.region)
        region = $r.region_nombre
        province = $r.provincia_nombre
        macrozone = $r.macrozona_operativa
        households = Num $r.hogares_total
        validHouseholds = $validCommune
        noInternetN = $noInternetCommune
        noInternetPct = Pct $r.hogares_sin_internet_pct
        soloMovilN = $soloMovilCommune
        soloMovilPct = $solo
        functionalGapN = $functionalGapCommune
        functionalGapPct = if ($validCommune -gt 0) { [Math]::Round(($functionalGapCommune / $validCommune) * 100, 2) } else { 0 }
        fixedInternetN = Num $r.hogares_con_internet_fija_n
        fixedInternetPct = $fija
        mobileInternetPct = Pct $r.hogares_con_internet_movil_pct
        satelliteInternetN = Num $r.hogares_con_internet_satelital_n
        satelliteInternetPct = Pct $r.hogares_con_internet_satelital_pct
        fixedDownMbps = if ($fixedSpeed) { $fixedSpeed.downMbps } else { $null }
        fixedUpMbps = if ($fixedSpeed) { $fixedSpeed.upMbps } else { $null }
        fixedLatencyMs = if ($fixedSpeed) { $fixedSpeed.latencyMs } else { $null }
        fixedSpeedTests = if ($fixedSpeed) { $fixedSpeed.tests } else { 0 }
        fixedSpeedDevices = if ($fixedSpeed) { $fixedSpeed.devices } else { 0 }
        mobileDownMbps = if ($mobileSpeed) { $mobileSpeed.downMbps } else { $null }
        mobileUpMbps = if ($mobileSpeed) { $mobileSpeed.upMbps } else { $null }
        mobileLatencyMs = if ($mobileSpeed) { $mobileSpeed.latencyMs } else { $null }
        mobileSpeedTests = if ($mobileSpeed) { $mobileSpeed.tests } else { 0 }
        mobileSpeedDevices = if ($mobileSpeed) { $mobileSpeed.devices } else { 0 }
        computerN = Num $r.hogares_con_computador_n
        computerPct = Pct $r.hogares_con_computador_pct
        urbanN = Num $r.hogares_urbanos_n
        ruralN = Num $r.hogares_rurales_n
        ruralPct = Pct $r.hogares_rurales_pct
        urbanPct = Pct $r.hogares_urbanos_pct
        overcrowdingPct = Pct $r.pct_hacinamiento
        criticalOvercrowdingPct = Pct $r.pct_hacinamiento_critico
        nonOwnerPct = Pct $r.pct_no_propietario
        tenantPct = Pct $r.pct_arrendatario
        irregularTenurePct = Pct $r.pct_tenencia_irregular
        singleParentPct = Pct $r.pct_monoparental
        householdsWithChildrenPct = Pct $r.pct_hogares_con_nna
        householdsWithOlderAdultsPct = Pct $r.pct_hogares_con_mayores
        householdsWithDisabilityPct = Pct $r.pct_hogares_con_discapacidad
        femaleHeadshipPct = Pct $r.pct_jefatura_femenina
        multigenerationalPct = Pct $r.pct_hogares_multigeneracionales
        housingDeficitIndex = Pct $r.idx_deficit_habitacional_directo
        urbanSocialRiskIndex = Pct $r.idx_riesgo_social_urbano_v2
        fragility = [Math]::Round((To-Double $r.idx_fragilidad_hogar_comunal) * 100, 1)
        ivd = $ivd
        ivdRaw = [Math]::Round($score, 5)
        rank = [int](To-Double $r.rank_score_digital_presion)
        segment = $r.segmento_digital
        substitution = $sust
    }
}

# El Atlas trabaja con comunas con hogares validos para el analisis de internet.
# Antartica aparece en la base censal, pero no tiene hogares validos de internet.
$communes = @($communes | Where-Object { $_.validHouseholds -gt 0 })

$ordered = @($communes | Sort-Object ivd -Descending)
$n = $ordered.Count
for ($i=0; $i -lt $ordered.Count; $i++) {
    $cat = if ($i -lt [Math]::Ceiling($n * 0.10)) { "Cr$([char]0x00ED)tica" }
        elseif ($i -lt [Math]::Ceiling($n * 0.30)) { "Alta" }
        elseif ($i -lt [Math]::Ceiling($n * 0.60)) { "Media" }
        elseif ($i -lt [Math]::Ceiling($n * 0.80)) { "Baja" }
        else { "Muy baja" }
    $ordered[$i] | Add-Member -NotePropertyName category -NotePropertyValue $cat -Force
}

$regions = @($communes | Group-Object region | ForEach-Object {
    $group = $_.Group
    $valid = ($group | Measure-Object validHouseholds -Sum).Sum
    $households = ($group | Measure-Object households -Sum).Sum
    $noInternet = ($group | Measure-Object noInternetN -Sum).Sum
    $soloMovil = ($group | Measure-Object soloMovilN -Sum).Sum
    $fixed = ($group | Measure-Object fixedInternetN -Sum).Sum
    $satellite = ($group | Measure-Object satelliteInternetN -Sum).Sum
    $urban = ($group | Measure-Object urbanN -Sum).Sum
    $rural = ($group | Measure-Object ruralN -Sum).Sum
    $fixedSpeedTests = ($group | Measure-Object fixedSpeedTests -Sum).Sum
    $fixedSpeedDevices = ($group | Measure-Object fixedSpeedDevices -Sum).Sum
    $mobileSpeedTests = ($group | Measure-Object mobileSpeedTests -Sum).Sum
    $mobileSpeedDevices = ($group | Measure-Object mobileSpeedDevices -Sum).Sum
    [pscustomobject]@{
        name = $_.Name
        regionCode = ($group | Select-Object -First 1).regionCode
        communes = $group.Count
        households = $households
        validHouseholds = $valid
        noInternetN = $noInternet
        noInternetPct = if ($valid -gt 0) { [Math]::Round(($noInternet / $valid) * 100, 2) } else { 0 }
        soloMovilN = $soloMovil
        soloMovilPct = if ($valid -gt 0) { [Math]::Round(($soloMovil / $valid) * 100, 2) } else { 0 }
        functionalGapN = $noInternet + $soloMovil
        functionalGapPct = if ($valid -gt 0) { [Math]::Round((($noInternet + $soloMovil) / $valid) * 100, 2) } else { 0 }
        fixedInternetN = $fixed
        fixedInternetPct = if ($households -gt 0) { [Math]::Round(($fixed / $households) * 100, 2) } else { 0 }
        satelliteInternetN = $satellite
        satelliteInternetPct = if ($households -gt 0) { [Math]::Round(($satellite / $households) * 100, 2) } else { 0 }
        fixedDownMbps = WeightedAverage $group "fixedDownMbps" "fixedSpeedTests"
        fixedUpMbps = WeightedAverage $group "fixedUpMbps" "fixedSpeedTests"
        fixedLatencyMs = WeightedAverage $group "fixedLatencyMs" "fixedSpeedTests"
        fixedSpeedTests = $fixedSpeedTests
        fixedSpeedDevices = $fixedSpeedDevices
        mobileDownMbps = WeightedAverage $group "mobileDownMbps" "mobileSpeedTests"
        mobileUpMbps = WeightedAverage $group "mobileUpMbps" "mobileSpeedTests"
        mobileLatencyMs = WeightedAverage $group "mobileLatencyMs" "mobileSpeedTests"
        mobileSpeedTests = $mobileSpeedTests
        mobileSpeedDevices = $mobileSpeedDevices
        urbanN = $urban
        urbanPct = if ($households -gt 0) { [Math]::Round(($urban / $households) * 100, 2) } else { 0 }
        ruralN = $rural
        ruralPct = if ($households -gt 0) { [Math]::Round(($rural / $households) * 100, 2) } else { 0 }
        overcrowdingPct = WeightedAverage $group "overcrowdingPct" "households"
        criticalOvercrowdingPct = WeightedAverage $group "criticalOvercrowdingPct" "households"
        nonOwnerPct = WeightedAverage $group "nonOwnerPct" "households"
        tenantPct = WeightedAverage $group "tenantPct" "households"
        irregularTenurePct = WeightedAverage $group "irregularTenurePct" "households"
        singleParentPct = WeightedAverage $group "singleParentPct" "households"
        householdsWithChildrenPct = WeightedAverage $group "householdsWithChildrenPct" "households"
        householdsWithOlderAdultsPct = WeightedAverage $group "householdsWithOlderAdultsPct" "households"
        householdsWithDisabilityPct = WeightedAverage $group "householdsWithDisabilityPct" "households"
        femaleHeadshipPct = WeightedAverage $group "femaleHeadshipPct" "households"
        multigenerationalPct = WeightedAverage $group "multigenerationalPct" "households"
        housingDeficitIndex = WeightedAverage $group "housingDeficitIndex" "households"
        urbanSocialRiskIndex = WeightedAverage $group "urbanSocialRiskIndex" "households"
        avgIvd = [Math]::Round(($group | Measure-Object ivd -Average).Average, 1)
    }
} | Sort-Object regionCode)

$totalValid = ($communes | Measure-Object validHouseholds -Sum).Sum
$totalNoInternet = ($communes | Measure-Object noInternetN -Sum).Sum
$totalSoloMovil = ($communes | Measure-Object soloMovilN -Sum).Sum
$totalComputers = ($communes | Measure-Object computerN -Sum).Sum
$totalHouseholds = ($communes | Measure-Object households -Sum).Sum
$totalSatellite = ($communes | Measure-Object satelliteInternetN -Sum).Sum
$totalFixedSpeedTests = ($communes | Measure-Object fixedSpeedTests -Sum).Sum
$totalFixedSpeedDevices = ($communes | Measure-Object fixedSpeedDevices -Sum).Sum
$totalMobileSpeedTests = ($communes | Measure-Object mobileSpeedTests -Sum).Sum
$totalMobileSpeedDevices = ($communes | Measure-Object mobileSpeedDevices -Sum).Sum
$totalUrban = ($communes | Measure-Object urbanN -Sum).Sum
$totalRural = ($communes | Measure-Object ruralN -Sum).Sum
$data = [pscustomobject]@{
    generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    sources = @("Atlas 2026", "Censo 2024", "CASEN 2024", "Ookla Q1 2026")
    totals = [ordered]@{
        communes = $communes.Count
        households = $totalHouseholds
        validHouseholds = $totalValid
        noInternetN = $totalNoInternet
        noInternetPct = [Math]::Round(($totalNoInternet / $totalValid) * 100, 2)
        soloMovilN = $totalSoloMovil
        soloMovilPct = [Math]::Round(($totalSoloMovil / $totalValid) * 100, 2)
        functionalGapN = $totalNoInternet + $totalSoloMovil
        functionalGapPct = [Math]::Round((($totalNoInternet + $totalSoloMovil) / $totalValid) * 100, 2)
        satelliteInternetN = $totalSatellite
        satelliteInternetPct = [Math]::Round(($totalSatellite / $totalHouseholds) * 100, 2)
        fixedDownMbps = WeightedAverage $communes "fixedDownMbps" "fixedSpeedTests"
        fixedUpMbps = WeightedAverage $communes "fixedUpMbps" "fixedSpeedTests"
        fixedLatencyMs = WeightedAverage $communes "fixedLatencyMs" "fixedSpeedTests"
        fixedSpeedTests = $totalFixedSpeedTests
        fixedSpeedDevices = $totalFixedSpeedDevices
        mobileDownMbps = WeightedAverage $communes "mobileDownMbps" "mobileSpeedTests"
        mobileUpMbps = WeightedAverage $communes "mobileUpMbps" "mobileSpeedTests"
        mobileLatencyMs = WeightedAverage $communes "mobileLatencyMs" "mobileSpeedTests"
        mobileSpeedTests = $totalMobileSpeedTests
        mobileSpeedDevices = $totalMobileSpeedDevices
        urbanN = $totalUrban
        urbanPct = [Math]::Round(($totalUrban / $totalHouseholds) * 100, 2)
        ruralN = $totalRural
        ruralPct = [Math]::Round(($totalRural / $totalHouseholds) * 100, 2)
        computerN = $totalComputers
        computerPct = [Math]::Round(($totalComputers / $totalHouseholds) * 100, 2)
    }
    regions = $regions
    communes = $communes
}

$attrs = Read-Dbf "$shapeBase.dbf"
$geo = Read-Shp "$shapeBase.shp" $attrs
$validCodes = @{}
foreach ($c in $communes) { $validCodes[[string]$c.code] = $true }
$geo.features = @($geo.features | Where-Object { $validCodes.ContainsKey([string]$_.properties.code) })

$jsonOptions = @{ Depth = 80; Compress = $true }
[IO.File]::WriteAllText($outData, ($data | ConvertTo-Json @jsonOptions), [Text.Encoding]::UTF8)
[IO.File]::WriteAllText($outGeo, ($geo | ConvertTo-Json @jsonOptions), [Text.Encoding]::UTF8)

[pscustomobject]@{
    Atlas = $outData
    Geo = $outGeo
    Communes = $communes.Count
    Regions = $regions.Count
}
