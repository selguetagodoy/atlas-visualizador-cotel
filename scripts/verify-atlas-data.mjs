import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const atlasPath = path.join(root, "public", "data", "atlas.json");
const appPath = path.join(root, "app.js");
const indexPath = path.join(root, "index.html");
const studyPdfPath = path.join(root, "public", "docs", "Atlas_Desconexion_Digital_2026.pdf");

const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8").replace(/^\uFEFF/, ""));
const appJs = fs.readFileSync(appPath, "utf8");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const failures = [];

const requiredCommuneFields = [
  "satelliteInternetN",
  "satelliteInternetPct",
  "functionalGapN",
  "functionalGapPct",
  "fixedDownMbps",
  "fixedUpMbps",
  "fixedLatencyMs",
  "fixedSpeedTests",
  "mobileDownMbps",
  "mobileUpMbps",
  "mobileLatencyMs",
  "mobileSpeedTests",
  "urbanN",
  "ruralN",
  "overcrowdingPct",
  "criticalOvercrowdingPct",
  "nonOwnerPct",
  "tenantPct",
  "irregularTenurePct",
  "singleParentPct",
  "householdsWithChildrenPct",
  "householdsWithOlderAdultsPct",
  "householdsWithDisabilityPct",
  "femaleHeadshipPct",
  "multigenerationalPct",
  "housingDeficitIndex",
  "urbanSocialRiskIndex",
];

for (const commune of atlas.communes ?? []) {
  for (const field of requiredCommuneFields) {
    const value = commune[field];
    const canBeMissingSpeed = /^(fixed|mobile)(Down|Up|Latency)/.test(field);
    const isValid = typeof value === "number" && Number.isFinite(value);
    if (!isValid && !(canBeMissingSpeed && value === null)) {
      failures.push(`${commune.name} no tiene ${field} numerico`);
      break;
    }
  }
}

for (const commune of atlas.communes ?? []) {
  const expectedN = commune.noInternetN + commune.soloMovilN;
  const expectedPct = commune.validHouseholds > 0
    ? Math.round((expectedN / commune.validHouseholds) * 10000) / 100
    : 0;
  if (commune.functionalGapN !== expectedN) {
    failures.push(`${commune.name} no calcula hogares sin conexion util como sin internet + solo movil`);
    break;
  }
  if (Math.abs(commune.functionalGapPct - expectedPct) > 0.01) {
    failures.push(`${commune.name} no calcula porcentaje sin conexion util sobre hogares validos`);
    break;
  }
}

const valparaiso = atlas.communes?.find((commune) => commune.code === 5101);
if (!valparaiso || valparaiso.fixedDownMbps < 100 || valparaiso.mobileDownMbps < 10) {
  failures.push("Valparaiso no tiene velocidades fija y movil agregadas desde Ookla");
}

const requiredTotalFields = [
  "satelliteInternetN",
  "satelliteInternetPct",
  "fixedDownMbps",
  "fixedSpeedTests",
  "functionalGapN",
  "functionalGapPct",
  "mobileDownMbps",
  "mobileSpeedTests",
  "urbanN",
  "urbanPct",
  "ruralN",
  "ruralPct",
];

for (const field of requiredTotalFields) {
  const value = atlas.totals?.[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    failures.push(`totals no tiene ${field} numerico`);
  }
}

for (const key of [
  "satelliteInternetPct",
  "functionalGapPct",
  "fixedDownMbps",
  "mobileDownMbps",
  "ruralPct",
  "overcrowdingPct",
  "householdsWithOlderAdultsPct",
  "householdsWithDisabilityPct",
  "urbanSocialRiskIndex",
]) {
  if (!appJs.includes(`${key}:`)) {
    failures.push(`app.js no expone el indicador ${key}`);
  }
}

const disallowedLocalityField = /^(fixedLocality|mobileCoverage|fixedFttx)/;
for (const [label, rows] of [
  ["communes", atlas.communes ?? []],
  ["regions", atlas.regions ?? []],
  ["totals", [atlas.totals ?? {}]],
]) {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (disallowedLocalityField.test(key)) {
        failures.push(`${label} todavia contiene dato de localidad: ${key}`);
        break;
      }
    }
  }
}

for (const source of atlas.sources ?? []) {
  if (/SUBTEL|localidad/i.test(source)) {
    failures.push(`atlas.json todavia cita fuente de localidad: ${source}`);
  }
}

for (const [label, content] of [
  ["app.js", appJs],
  ["index.html", indexHtml],
]) {
  for (const snippet of ["Localidades SUBTEL", "mobileCoverage", "fixedLocality", "fixedFttx", "SUBTEL"]) {
    if (content.includes(snippet)) {
      failures.push(`${label} todavia expone dato de localidad: ${snippet}`);
    }
  }
}

for (const snippet of ["VALPARAISO_INSET_CODES", "pathFromFeatureInRect", "renderValparaisoInsets"]) {
  if (!appJs.includes(snippet)) {
    failures.push(`app.js no contiene el ajuste Valparaiso: ${snippet}`);
  }
}

for (const code of ["5104", "5201"]) {
  if (!appJs.includes(code)) {
    failures.push(`app.js no trata la comuna insular ${code} como inset`);
  }
}

if (!indexHtml.includes("<h1>Explora la realidad digital de tu comuna</h1>")) {
  failures.push("index.html no tiene el titulo principal aprobado");
}

if (indexHtml.includes("Prototipo web editorial para COTEL")) {
  failures.push("index.html todavia contiene el texto de prototipo");
}

for (const snippet of [
  "Creado por Sebastián Elgueta Godoy",
  "sociólogo e investigador en políticas públicas y transformación digital",
  "e.elguetagodoy@gmail.com",
]) {
  if (!indexHtml.includes(snippet)) {
    failures.push(`index.html no contiene el credito: ${snippet}`);
  }
}

if (!fs.existsSync(studyPdfPath) || fs.statSync(studyPdfPath).size < 1_000_000) {
  failures.push("no existe el PDF publico del estudio completo");
}

for (const snippet of [
  "Descargar estudio completo",
  "public/docs/Atlas_Desconexion_Digital_2026.pdf",
  'download="Atlas_Desconexion_Digital_2026.pdf"',
]) {
  if (!indexHtml.includes(snippet)) {
    failures.push(`index.html no contiene la descarga del estudio: ${snippet}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Atlas verificado: ${atlas.communes.length} comunas con nuevas variables censales y ajuste Valparaiso.`);
