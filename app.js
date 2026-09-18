const fmtInt = new Intl.NumberFormat("es-CL");
const fmtPct = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

const state = {
  atlas: null,
  geo: null,
  indicator: "ivd",
  region: "all",
  selectedCode: null,
  hoverCode: null,
};

const SVG_NS = "http://www.w3.org/2000/svg";
const VALPARAISO_REGION_CODE = "5";
const VALPARAISO_INSET_CODES = new Set([5104, 5201]);
const VALPARAISO_INSETS = new Map([
  [5104, { label: "Juan Fernández", rect: { x: 28, y: 404, width: 158, height: 66 } }],
  [5201, { label: "Isla de Pascua", rect: { x: 28, y: 482, width: 158, height: 58 } }],
]);

const indicators = {
  ivd: {
    label: "Vulnerabilidad digital (IVD)",
    short: "IVD",
    unit: " pts",
    reading: "Mientras más alto, más difícil es usar la red con autonomía.",
    colors: ["#173b28", "#537d28", "#9bcb3c", "#e2b93b", "#d9534f"],
    domain: [0, 100],
    value: (d) => d.ivd,
    sort: "desc",
  },
  noInternetPct: {
    label: "% hogares sin internet",
    short: "Sin internet",
    unit: "%",
    reading: "Muestra el núcleo duro de la desconexión: hogares sin internet de ningún tipo.",
    colors: ["#1a301f", "#557b23", "#d8b33f", "#e67a4c", "#d9534f"],
    domain: [0, 45],
    value: (d) => d.noInternetPct,
    sort: "desc",
  },
  soloMovilPct: {
    label: "% hogares solo móvil",
    short: "Solo móvil",
    unit: "%",
    reading: "Mide hogares donde el celular ocupa el lugar de una conexión fija.",
    colors: ["#0a2630", "#0d4658", "#126f88", "#1fa0c9", "#66d9f2"],
    domain: [0, 85],
    value: (d) => d.soloMovilPct,
    sort: "desc",
  },
  functionalGapPct: {
    label: "% hogares sin conexión útil",
    short: "Sin conexión útil",
    unit: "%",
    reading: "Suma hogares sin internet y hogares solo móvil: una medida comunal de conexión insuficiente para estudiar, trabajar o hacer trámites.",
    colors: ["#173b28", "#537d28", "#d8b33f", "#dd7047", "#d9534f"],
    domain: [0, 95],
    value: (d) => d.functionalGapPct,
    sort: "desc",
  },
  fixedInternetPct: {
    label: "% hogares con internet fijo",
    short: "Internet fijo",
    unit: "%",
    reading: "Permite ver dónde existe una conexión más apta para estudiar, trabajar y hacer trámites.",
    colors: ["#2b1515", "#6b2626", "#9b5d24", "#739a26", "#9bcb3c"],
    domain: [0, 95],
    value: (d) => d.fixedInternetPct,
    sort: "asc",
  },
  fixedDownMbps: {
    label: "Velocidad fija bajada",
    short: "Fija bajada",
    unit: " Mbps",
    reading: "Promedio comunal de velocidad fija de bajada medido por Ookla en Q1 2026.",
    colors: ["#5f2020", "#b44935", "#d8b33f", "#1fa0c9", "#9bcb3c"],
    domain: [0, 500],
    value: (d) => d.fixedDownMbps,
    sort: "asc",
  },
  mobileDownMbps: {
    label: "Velocidad móvil bajada",
    short: "Móvil bajada",
    unit: " Mbps",
    reading: "Promedio comunal de velocidad móvil de bajada medido por Ookla en Q1 2026.",
    colors: ["#5f2020", "#b44935", "#d8b33f", "#1fa0c9", "#9bcb3c"],
    domain: [0, 180],
    value: (d) => d.mobileDownMbps,
    sort: "asc",
  },
  satelliteInternetPct: {
    label: "% hogares con internet satelital",
    short: "Satelital",
    unit: "%",
    reading: "Identifica territorios donde la conectividad depende más de soluciones satelitales.",
    colors: ["#101f24", "#14404a", "#216a75", "#c58f2d", "#e2b93b"],
    domain: [0, 25],
    value: (d) => d.satelliteInternetPct,
    sort: "desc",
  },
  computerPct: {
    label: "% hogares con computador",
    short: "Computador",
    unit: "%",
    reading: "Sin equipo, la conexión pierde capacidad productiva y educativa.",
    colors: ["#2b1515", "#6b2626", "#9b5d24", "#739a26", "#9bcb3c"],
    domain: [0, 90],
    value: (d) => d.computerPct,
    sort: "asc",
  },
  ruralPct: {
    label: "% hogares rurales",
    short: "Ruralidad",
    unit: "%",
    reading: "Da contexto territorial: dispersión y ruralidad suelen cambiar el costo de conectar.",
    colors: ["#10221f", "#1f4b42", "#3e7466", "#b0a243", "#e2b93b"],
    domain: [0, 100],
    value: (d) => d.ruralPct,
    sort: "desc",
  },
  overcrowdingPct: {
    label: "% hogares con hacinamiento",
    short: "Hacinamiento",
    unit: "%",
    reading: "Muestra presión habitacional que puede volver más difícil estudiar, trabajar o hacer trámites en línea.",
    colors: ["#172822", "#546d30", "#d8b33f", "#dd7047", "#d9534f"],
    domain: [0, 28],
    value: (d) => d.overcrowdingPct,
    sort: "desc",
  },
  householdsWithChildrenPct: {
    label: "% hogares con NNA",
    short: "NNA",
    unit: "%",
    reading: "Ubica hogares donde la conectividad incide directamente en educación, cuidados y trámites familiares.",
    colors: ["#101f24", "#14404a", "#1f6a7e", "#1fa0c9", "#75d6ea"],
    domain: [0, 100],
    value: (d) => d.householdsWithChildrenPct,
    sort: "desc",
  },
  householdsWithOlderAdultsPct: {
    label: "% hogares con mayores",
    short: "Mayores",
    unit: "%",
    reading: "Ayuda a priorizar territorios donde los servicios digitales deben ser más acompañados y simples.",
    colors: ["#172822", "#446635", "#8b9437", "#d8b33f", "#e7ce6e"],
    domain: [0, 65],
    value: (d) => d.householdsWithOlderAdultsPct,
    sort: "desc",
  },
  householdsWithDisabilityPct: {
    label: "% hogares con discapacidad",
    short: "Discapacidad",
    unit: "%",
    reading: "Agrega una dimensión de accesibilidad al diagnóstico de brecha digital.",
    colors: ["#15222c", "#23445a", "#346e84", "#1fa0c9", "#9bcb3c"],
    domain: [0, 45],
    value: (d) => d.householdsWithDisabilityPct,
    sort: "desc",
  },
  femaleHeadshipPct: {
    label: "% jefatura femenina",
    short: "Jefatura femenina",
    unit: "%",
    reading: "Permite cruzar brecha digital con organización y sostén del hogar.",
    colors: ["#1f1a25", "#50334c", "#81516f", "#c46c78", "#e2b93b"],
    domain: [25, 65],
    value: (d) => d.femaleHeadshipPct,
    sort: "desc",
  },
  urbanSocialRiskIndex: {
    label: "Índice de riesgo social urbano",
    short: "Riesgo social",
    unit: " pts",
    reading: "Resume vulnerabilidades urbanas que pueden amplificar la desconexión digital.",
    colors: ["#172822", "#546d30", "#d8b33f", "#dd7047", "#d9534f"],
    domain: [0, 100],
    value: (d) => d.urbanSocialRiskIndex,
    sort: "desc",
  },
  substitution: {
    label: "Sustitución digital",
    short: "Sustitución",
    unit: "",
    reading: "Combina solo móvil alto e internet fijo bajo: dónde el celular reemplaza al internet del hogar.",
    colors: ["#211113", "#4a2222", "#81302e", "#d9534f", "#ff806d"],
    domain: [0, 100],
    value: (d) => d.substitution,
    sort: "desc",
  },
};

const el = {
  statNoInternet: document.querySelector("#statNoInternet"),
  statSoloMovil: document.querySelector("#statSoloMovil"),
  statFunctional: document.querySelector("#statFunctional"),
  statFunctionalPct: document.querySelector("#statFunctionalPct"),
  statCommunes: document.querySelector("#statCommunes"),
  indicatorSelect: document.querySelector("#indicatorSelect"),
  regionSelect: document.querySelector("#regionSelect"),
  search: document.querySelector("#communeSearch"),
  mapSvg: document.querySelector("#mapSvg"),
  mapTitle: document.querySelector("#mapTitle"),
  mapReading: document.querySelector("#mapReading"),
  tooltip: document.querySelector("#tooltip"),
  legend: document.querySelector("#legend"),
  communeName: document.querySelector("#communeName"),
  communeSummary: document.querySelector("#communeSummary"),
  communeMetrics: document.querySelector("#communeMetrics"),
  rankingTitle: document.querySelector("#rankingTitle"),
  rankingList: document.querySelector("#rankingList"),
  scatterSvg: document.querySelector("#scatterSvg"),
};

function pct(v) {
  return Number.isFinite(Number(v)) ? `${fmtPct.format(v)}%` : "s/d";
}

function score(v) {
  return Number.isFinite(Number(v)) ? fmtPct.format(v) : "s/d";
}

function mbps(v) {
  return Number.isFinite(Number(v)) ? `${fmtPct.format(v)} Mbps` : "s/d";
}

function ms(v) {
  return Number.isFinite(Number(v)) ? `${fmtPct.format(v)} ms` : "s/d";
}

function valueLabel(d, key = state.indicator) {
  const ind = indicators[key];
  const v = ind.value(d);
  if (!Number.isFinite(Number(v))) return "s/d";
  return ind.unit === "%" ? pct(v) : `${fmtPct.format(v)}${ind.unit}`;
}

function colorFor(value, ind) {
  if (!Number.isFinite(Number(value))) return "#31404d";
  const [min, max] = ind.domain;
  const t = Math.max(0, Math.min(0.999, (value - min) / (max - min)));
  const idx = Math.floor(t * ind.colors.length);
  return ind.colors[idx];
}

function getCommune(code) {
  return state.atlas.communes.find((d) => d.code === Number(code));
}

function visibleCommunes() {
  if (state.region === "all") return state.atlas.communes;
  return state.atlas.communes.filter((d) => String(d.regionCode) === String(state.region));
}

function visibleFeatures() {
  const codes = new Set(visibleCommunes().map((d) => d.code));
  return state.geo.features.filter((f) => codes.has(Number(f.properties.code)));
}

function ringsFromFeature(feature) {
  if (!feature?.geometry?.coordinates) return [];
  if (feature.geometry.type === "Polygon") return feature.geometry.coordinates;
  if (feature.geometry.type === "MultiPolygon") return feature.geometry.coordinates.flat();
  return [];
}

function featureBBox(features) {
  if (!features.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of features) {
    for (const ring of ringsFromFeature(f)) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function projectPoint(x, y, bbox, box, pad = 20) {
  const sx = (box.width - pad * 2) / (bbox.maxX - bbox.minX || 1);
  const sy = (box.height - pad * 2) / (bbox.maxY - bbox.minY || 1);
  const s = Math.min(sx, sy);
  const drawW = (bbox.maxX - bbox.minX) * s;
  const drawH = (bbox.maxY - bbox.minY) * s;
  const ox = box.x + (box.width - drawW) / 2;
  const oy = box.y + (box.height - drawH) / 2;
  return {
    x: ox + (x - bbox.minX) * s,
    y: oy + (bbox.maxY - y) * s,
  };
}

function pathFromFeatureInRect(feature, bbox, rect, pad = 20) {
  let path = "";
  for (const ring of ringsFromFeature(feature)) {
    ring.forEach(([x, y], i) => {
      const point = projectPoint(x, y, bbox, rect, pad);
      path += `${i === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    });
    path += "Z";
  }
  return path;
}

function pathFromFeature(feature, bbox, width, height) {
  return pathFromFeatureInRect(feature, bbox, { x: 0, y: 0, width, height });
}

function isValparaisoInsetFeature(feature) {
  return String(feature.properties.regionCode) === VALPARAISO_REGION_CODE &&
    VALPARAISO_INSET_CODES.has(Number(feature.properties.code));
}

function createMapPath(feature, commune, d, ind, selected) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", colorFor(ind.value(commune), ind));
  path.setAttribute("opacity", selected && commune.code !== selected ? "0.55" : "1");
  path.classList.add("map-path");
  if (commune.code === selected) path.classList.add("active");
  path.addEventListener("mouseenter", (event) => showTooltip(event, commune));
  path.addEventListener("mousemove", (event) => moveTooltip(event));
  path.addEventListener("mouseleave", hideTooltip);
  path.addEventListener("click", () => {
    state.selectedCode = commune.code;
    el.search.value = commune.name;
    renderAll();
  });
  return path;
}

function renderValparaisoInsets(features, ind, selected) {
  const insetFeatures = features.filter(isValparaisoInsetFeature);
  for (const feature of insetFeatures) {
    const config = VALPARAISO_INSETS.get(Number(feature.properties.code));
    const commune = getCommune(feature.properties.code);
    if (!config || !commune) continue;

    const group = document.createElementNS(SVG_NS, "g");
    group.classList.add("map-inset");

    const frame = document.createElementNS(SVG_NS, "rect");
    frame.setAttribute("x", config.rect.x);
    frame.setAttribute("y", config.rect.y);
    frame.setAttribute("width", config.rect.width);
    frame.setAttribute("height", config.rect.height);
    frame.classList.add("map-inset-frame");
    group.appendChild(frame);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", config.rect.x + 9);
    label.setAttribute("y", config.rect.y + 16);
    label.classList.add("map-inset-label");
    label.textContent = config.label;
    group.appendChild(label);

    const bbox = featureBBox([feature]);
    const path = createMapPath(
      feature,
      commune,
      pathFromFeatureInRect(feature, bbox, {
        x: config.rect.x + 4,
        y: config.rect.y + 15,
        width: config.rect.width - 8,
        height: config.rect.height - 19,
      }, 5),
      ind,
      selected,
    );
    path.classList.add("map-inset-path");
    group.appendChild(path);
    el.mapSvg.appendChild(group);
  }
}

function renderSummary() {
  const t = state.atlas.totals;
  el.statNoInternet.textContent = fmtInt.format(t.noInternetN);
  el.statSoloMovil.textContent = fmtInt.format(t.soloMovilN);
  el.statFunctional.textContent = fmtInt.format(t.functionalGapN);
  el.statFunctionalPct.textContent = `${pct(t.functionalGapPct)} de los hogares válidos`;
  el.statCommunes.textContent = fmtInt.format(t.communes);
}

function setupControls() {
  el.indicatorSelect.innerHTML = Object.entries(indicators)
    .map(([key, ind]) => `<option value="${key}">${ind.label}</option>`)
    .join("");

  const regionOptions = [`<option value="all">Chile completo</option>`]
    .concat(state.atlas.regions.map((r) => `<option value="${r.regionCode}">${r.name}</option>`));
  el.regionSelect.innerHTML = regionOptions.join("");

  el.indicatorSelect.addEventListener("change", (event) => {
    state.indicator = event.target.value;
    renderAll();
  });

  el.regionSelect.addEventListener("change", (event) => {
    state.region = event.target.value;
    state.selectedCode = null;
    renderAll();
  });

  el.search.addEventListener("input", () => {
    const q = el.search.value.trim().toLowerCase();
    if (q.length < 2) return;
    const found = state.atlas.communes.find((d) => d.name.toLowerCase().includes(q));
    if (found) {
      state.selectedCode = found.code;
      state.region = String(found.regionCode);
      el.regionSelect.value = state.region;
      renderAll();
    }
  });
}

function renderLegend() {
  const ind = indicators[state.indicator];
  const [min, max] = ind.domain;
  const steps = ind.colors.length;
  const range = max - min;
  el.legend.innerHTML = ind.colors
    .map((color, i) => {
      const a = min + (range / steps) * i;
      const b = min + (range / steps) * (i + 1);
      const label = ind.unit === "%"
        ? `${fmtPct.format(a)}-${fmtPct.format(b)}%`
        : `${fmtPct.format(a)}-${fmtPct.format(b)}${ind.unit}`;
      return `<span class="legend-swatch" style="background:${color}"></span><span>${label}</span>`;
    })
    .join("");
}

function renderMap() {
  const features = visibleFeatures();
  const width = 920;
  const height = 560;
  const ind = indicators[state.indicator];
  const useValparaisoInsets = String(state.region) === VALPARAISO_REGION_CODE;
  const mapFeatures = useValparaisoInsets
    ? features.filter((feature) => !isValparaisoInsetFeature(feature))
    : features;
  const bbox = featureBBox(mapFeatures.length ? mapFeatures : features);
  el.mapSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  el.mapSvg.innerHTML = "";

  const selected = state.selectedCode;
  for (const feature of mapFeatures) {
    const commune = getCommune(feature.properties.code);
    if (!commune) continue;
    const path = createMapPath(feature, commune, pathFromFeature(feature, bbox, width, height), ind, selected);
    el.mapSvg.appendChild(path);
  }
  if (useValparaisoInsets) renderValparaisoInsets(features, ind, selected);

  const region = state.region === "all"
    ? "Chile completo"
    : state.atlas.regions.find((r) => String(r.regionCode) === String(state.region))?.name || "Región";
  el.mapTitle.textContent = region;
  el.mapReading.textContent = ind.reading;
}

function showTooltip(event, commune) {
  el.tooltip.hidden = false;
  el.tooltip.innerHTML = `
    <strong>${commune.name}</strong>
    ${commune.region}<br>
    ${indicators[state.indicator].short}: ${valueLabel(commune)}<br>
    Sin conexión útil: ${pct(commune.functionalGapPct)}<br>
    Sin internet: ${pct(commune.noInternetPct)} · Solo móvil: ${pct(commune.soloMovilPct)}<br>
    Fija: ${mbps(commune.fixedDownMbps)} · Móvil: ${mbps(commune.mobileDownMbps)}
  `;
  moveTooltip(event);
}

function moveTooltip(event) {
  el.tooltip.style.left = `${event.clientX + 14}px`;
  el.tooltip.style.top = `${event.clientY + 14}px`;
}

function hideTooltip() {
  el.tooltip.hidden = true;
}

function renderCommuneCard() {
  const commune = state.selectedCode ? getCommune(state.selectedCode) : visibleCommunes().sort((a, b) => b.ivd - a.ivd)[0];
  if (!commune) return;
  el.communeName.textContent = commune.name;
  el.communeSummary.textContent =
    `${commune.region}. IVD ${score(commune.ivd)}: ${commune.category || "sin categoría"}. ` +
    `Tiene ${pct(commune.functionalGapPct)} de hogares sin conexión útil. ` +
    `Velocidad bajada: fija ${mbps(commune.fixedDownMbps)}, móvil ${mbps(commune.mobileDownMbps)}.`;

  const groups = [
    {
      title: "Conectividad",
      rows: [
        ["Sin conexión útil", pct(commune.functionalGapPct)],
        ["Sin internet", pct(commune.noInternetPct)],
        ["Solo móvil", pct(commune.soloMovilPct)],
        ["Internet fijo", pct(commune.fixedInternetPct)],
        ["Satelital", pct(commune.satelliteInternetPct)],
        ["Computador", pct(commune.computerPct)],
        ["Hogares", fmtInt.format(commune.households)],
      ],
    },
    {
      title: "Velocidad Ookla Q1 2026",
      rows: [
        ["Fija bajada", mbps(commune.fixedDownMbps)],
        ["Fija subida", mbps(commune.fixedUpMbps)],
        ["Latencia fija", ms(commune.fixedLatencyMs)],
        ["Móvil bajada", mbps(commune.mobileDownMbps)],
        ["Móvil subida", mbps(commune.mobileUpMbps)],
        ["Latencia móvil", ms(commune.mobileLatencyMs)],
      ],
    },
    {
      title: "Censo hogar",
      rows: [
        ["Rurales", pct(commune.ruralPct)],
        ["Con NNA", pct(commune.householdsWithChildrenPct)],
        ["Con mayores", pct(commune.householdsWithOlderAdultsPct)],
        ["Con discapacidad", pct(commune.householdsWithDisabilityPct)],
        ["Jefatura femenina", pct(commune.femaleHeadshipPct)],
        ["Multigeneracionales", pct(commune.multigenerationalPct)],
      ],
    },
    {
      title: "Vivienda y presión social",
      rows: [
        ["Hacinamiento", pct(commune.overcrowdingPct)],
        ["Hacinamiento crítico", pct(commune.criticalOvercrowdingPct)],
        ["No propietario", pct(commune.nonOwnerPct)],
        ["Arriendo", pct(commune.tenantPct)],
        ["Tenencia irregular", pct(commune.irregularTenurePct)],
        ["Riesgo social", score(commune.urbanSocialRiskIndex)],
      ],
    },
  ];

  el.communeMetrics.innerHTML = groups.map((group) => `
    <section class="metric-group">
      <h3>${group.title}</h3>
      <div class="metric-grid">
        ${group.rows.map(([label, value]) => `
          <div class="metric-row">
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderRanking() {
  const ind = indicators[state.indicator];
  const rows = [...visibleCommunes()].sort((a, b) => {
    const missing = ind.sort === "asc" ? Infinity : -Infinity;
    const av = Number.isFinite(Number(ind.value(a))) ? Number(ind.value(a)) : missing;
    const bv = Number.isFinite(Number(ind.value(b))) ? Number(ind.value(b)) : missing;
    return ind.sort === "asc" ? av - bv : bv - av;
  }).slice(0, 10);

  el.rankingTitle.textContent = ind.sort === "asc"
    ? `Menor ${ind.short.toLowerCase()}`
    : `Mayor ${ind.short.toLowerCase()}`;
  el.rankingList.innerHTML = rows.map((d, i) => `
    <li>
      <span class="rank">${String(i + 1).padStart(2, "0")}</span>
      <button class="name" data-code="${d.code}">${d.name}</button>
      <span class="value">${valueLabel(d)}</span>
    </li>
  `).join("");
  el.rankingList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCode = Number(button.dataset.code);
      el.search.value = getCommune(state.selectedCode).name;
      renderAll();
    });
  });
}

function renderScatter() {
  const width = 900;
  const height = 340;
  const pad = { left: 58, right: 24, top: 20, bottom: 48 };
  const rows = visibleCommunes();
  const maxX = Math.max(45, Math.ceil(Math.max(...rows.map((d) => d.noInternetPct)) / 5) * 5);
  const x = (v) => pad.left + (v / maxX) * (width - pad.left - pad.right);
  const y = (v) => pad.top + (1 - v / 100) * (height - pad.top - pad.bottom);
  el.scatterSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  el.scatterSvg.innerHTML = "";

  [20, 40, 60, 80].forEach((v) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", pad.left);
    line.setAttribute("x2", width - pad.right);
    line.setAttribute("y1", y(v));
    line.setAttribute("y2", y(v));
    line.classList.add("grid-line");
    el.scatterSvg.appendChild(line);
  });

  const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  xAxis.setAttribute("x1", pad.left);
  xAxis.setAttribute("x2", width - pad.right);
  xAxis.setAttribute("y1", height - pad.bottom);
  xAxis.setAttribute("y2", height - pad.bottom);
  xAxis.classList.add("grid-line");
  el.scatterSvg.appendChild(xAxis);

  const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  yAxis.setAttribute("x1", pad.left);
  yAxis.setAttribute("x2", pad.left);
  yAxis.setAttribute("y1", pad.top);
  yAxis.setAttribute("y2", height - pad.bottom);
  yAxis.classList.add("grid-line");
  el.scatterSvg.appendChild(yAxis);

  const urgent = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  urgent.setAttribute("x", x(maxX * 0.55));
  urgent.setAttribute("y", y(100));
  urgent.setAttribute("width", width - pad.right - x(maxX * 0.55));
  urgent.setAttribute("height", y(62) - y(100));
  urgent.setAttribute("fill", "rgba(217,83,79,0.10)");
  urgent.setAttribute("stroke", "rgba(217,83,79,0.55)");
  el.scatterSvg.appendChild(urgent);

  rows.forEach((d) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", x(d.noInternetPct));
    c.setAttribute("cy", y(d.ivd));
    c.setAttribute("r", d.category === "Crítica" ? 4.8 : 3.2);
    c.setAttribute("fill", d.category === "Crítica" ? "#d9534f" : d.fixedInternetPct > 70 ? "#9bcb3c" : "#1fa0c9");
    c.setAttribute("opacity", d.category === "Crítica" ? "0.95" : "0.45");
    c.classList.add("scatter-point");
    c.addEventListener("mouseenter", (event) => showTooltip(event, d));
    c.addEventListener("mousemove", (event) => moveTooltip(event));
    c.addEventListener("mouseleave", hideTooltip);
    c.addEventListener("click", () => {
      state.selectedCode = d.code;
      el.search.value = d.name;
      renderAll();
    });
    el.scatterSvg.appendChild(c);
  });

  [...rows].sort((a, b) => b.ivd - a.ivd).slice(0, 10).forEach((d) => {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x(d.noInternetPct) + 6);
    label.setAttribute("y", y(d.ivd) - 6);
    label.textContent = d.name;
    label.classList.add("scatter-label");
    el.scatterSvg.appendChild(label);
  });

  addText(el.scatterSvg, width - 250, pad.top + 24, "ZONA DE URGENCIA", "#d9534f", 12, "bold");
  addText(el.scatterSvg, pad.left, height - 14, "% de hogares sin internet", "#aeb7c2", 11);
  addText(el.scatterSvg, 6, 24, "IVD 0-100", "#aeb7c2", 11);
}

function addText(svg, x, y, text, fill, size = 12, weight = "normal") {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("fill", fill);
  t.setAttribute("font-size", size);
  t.setAttribute("font-weight", weight);
  t.textContent = text;
  svg.appendChild(t);
}

function renderAll() {
  renderMap();
  renderLegend();
  renderCommuneCard();
  renderRanking();
  renderScatter();
}

async function boot() {
  const [atlas, geo] = await Promise.all([
    fetch("public/data/atlas.json").then((r) => r.json()),
    fetch("public/data/comunas.geojson").then((r) => r.json()),
  ]);
  state.atlas = atlas;
  state.geo = geo;
  state.selectedCode = atlas.communes.find((d) => d.name === "Colchane")?.code || atlas.communes[0].code;
  renderSummary();
  setupControls();
  renderAll();
}

boot().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<main class="app-shell"><h1>No se pudo cargar el visualizador</h1><p>${error.message}</p></main>`;
});
