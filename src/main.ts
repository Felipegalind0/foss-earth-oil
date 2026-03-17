// ─── Earth Oil Viz — Oil Trade Layer ────────────────────────────────
// Thin application entry-point that creates a generic globe and layers
// oil-specific trade-flow visualizations on top of it.

import { createGlobe } from "foss-earth";
import type { GlobeLayer, GlobeLayerState } from "foss-earth";
import { buildCullableSet, updateCulling } from "foss-earth/culling";
import type { CullableSet } from "foss-earth/culling";
import * as Cesium from "cesium";
import "./style.css";

// ─── Oil Data & Visualization Modules ───────────────────────────────
import { TRADE_FLOWS, TRADE_YEAR } from "./data/tradeFlows";
import type { TradeFlow } from "./data/tradeFlows";
import { REGIONS } from "./data/regions";
import { ROUTE_SCENARIOS } from "./data/seaRoutes";
import type { RouteScenarioId } from "./data/seaRoutes";
import { createCountrySpheres } from "./visualization/regionSpheres";
import { createSeaLanes } from "./visualization/seaLanes";

// ─── Read API key from URL params ───────────────────────────────────
const params = new URLSearchParams(window.location.search);
const apiKey = params.get("key");

// ─── Create Globe ───────────────────────────────────────────────────
const globe = await createGlobe({
  apiKey,
  debugGestures: params.has("debug-gestures"),
});
const viewer = globe.viewer;

// ─── Dataset Filtering ──────────────────────────────────────────────
function filterFlows(datasetId: string): TradeFlow[] {
  switch (datasetId) {
    case "top50":
      return [...TRADE_FLOWS].sort((a, b) => b.value - a.value).slice(0, 50);
    case "top30":
      return [...TRADE_FLOWS].sort((a, b) => b.value - a.value).slice(0, 30);
    case "middle_east": {
      const me = REGIONS.find((r) => r.id === "middle_east")!;
      return TRADE_FLOWS.filter((f) => me.countries.includes(f.from));
    }
    case "americas": {
      const na = REGIONS.find((r) => r.id === "north_america")!;
      const sa = REGIONS.find((r) => r.id === "south_america")!;
      const codes = [...na.countries, ...sa.countries];
      return TRADE_FLOWS.filter((f) => codes.includes(f.from));
    }
    case "africa": {
      const af = REGIONS.find((r) => r.id === "africa")!;
      return TRADE_FLOWS.filter((f) => af.countries.includes(f.from));
    }
    case "europe": {
      const ne = REGIONS.find((r) => r.id === "north_europe")!;
      const me = REGIONS.find((r) => r.id === "med_europe")!;
      const codes = [...ne.countries, ...me.countries];
      return TRADE_FLOWS.filter((f) => codes.includes(f.from));
    }
    case "russia_cis": {
      const ru = REGIONS.find((r) => r.id === "russia_cis")!;
      return TRADE_FLOWS.filter((f) => ru.countries.includes(f.from));
    }
    default:
      return TRADE_FLOWS;
  }
}

// ─── Oil Trade Layer (implements GlobeLayer) ────────────────────────
let currentLaneEntities: Cesium.Entity[] = [];
let currentCullSet: CullableSet | null = null;
let cullTickListener: Cesium.Event.RemoveCallback | null = null;
let currentDatasetId = "all";
let currentScenarioId: RouteScenarioId = "baseline";
let sphereEntities: Cesium.Entity[] = [];

function updateScenarioDescription(): void {
  const scenario = ROUTE_SCENARIOS.find((item) => item.id === currentScenarioId);
  const description = document.getElementById("routeScenarioDescription");
  if (scenario && description) {
    description.textContent = scenario.description;
  }
}

function rebuildCurrentVisualization(): void {
  buildVisualization(filterFlows(currentDatasetId));
}

function buildVisualization(flows: TradeFlow[]) {
  for (const e of currentLaneEntities) viewer.entities.remove(e);

  const lanes = createSeaLanes(viewer, flows, currentScenarioId);
  currentLaneEntities = lanes.map((l) => l.entity);
  console.log(`Rendered ${lanes.length} trade lanes for scenario "${currentScenarioId}"`);

  if (cullTickListener) cullTickListener();
  currentCullSet = buildCullableSet(sphereEntities, lanes);
  cullTickListener = viewer.clock.onTick.addEventListener(() =>
    updateCulling(viewer, currentCullSet!),
  );
}

const oilTradeLayer: GlobeLayer = {
  id: "oil-trade",
  setup(v: Cesium.Viewer): GlobeLayerState {
    sphereEntities = createCountrySpheres(v);
    return {
      poiEntities: sphereEntities,
    };
  },
  destroy(v: Cesium.Viewer): void {
    for (const e of currentLaneEntities) v.entities.remove(e);
    for (const e of sphereEntities) v.entities.remove(e);
    if (cullTickListener) cullTickListener();
    currentLaneEntities = [];
    sphereEntities = [];
    currentCullSet = null;
    cullTickListener = null;
  },
};

globe.addLayer(oilTradeLayer);

// ─── Initial Build ──────────────────────────────────────────────────
console.log(`Building visualization from ${TRADE_FLOWS.length} trade flows (${TRADE_YEAR})`);
updateScenarioDescription();
rebuildCurrentVisualization();

// ─── Dataset Dropdown Wiring ────────────────────────────────────────
const dataPanel = document.getElementById("dataPanel") as HTMLDivElement | null;
const dataPanelToggle = document.getElementById("dataPanelToggle") as HTMLButtonElement | null;

function setDataPanelMinimized(minimized: boolean): void {
  if (!dataPanel || !dataPanelToggle) return;
  dataPanel.classList.toggle("is-minimized", minimized);
  dataPanelToggle.textContent = minimized ? "Show Data Overlay" : "Hide Data Overlay";
  dataPanelToggle.setAttribute("aria-expanded", minimized ? "false" : "true");
}

if (dataPanel && dataPanelToggle) {
  setDataPanelMinimized(true);
  dataPanelToggle.addEventListener("click", () => {
    const currentlyMinimized = dataPanel.classList.contains("is-minimized");
    setDataPanelMinimized(!currentlyMinimized);
  });
}

const datasetSelect = document.getElementById("datasetSelect") as HTMLSelectElement | null;
datasetSelect?.addEventListener("change", () => {
  currentDatasetId = datasetSelect.value;
  const flows = filterFlows(currentDatasetId);
  console.log(`Switching to dataset "${currentDatasetId}" — ${flows.length} flows`);
  buildVisualization(flows);
});

const routeScenarioSelect = document.getElementById("routeScenarioSelect") as HTMLSelectElement | null;
routeScenarioSelect?.addEventListener("change", () => {
  currentScenarioId = routeScenarioSelect.value as RouteScenarioId;
  updateScenarioDescription();
  console.log(`Switching routing scenario to "${currentScenarioId}"`);
  rebuildCurrentVisualization();
});

