// ─── Sea Lane Polyline Visualization ────────────────────────────────
// Renders smooth polylines along computed sea routes with width ∝ trade volume.

import { Color3, MeshBuilder, Vector3 } from "@babylonjs/core";
import type { LinesMesh, Scene } from "@babylonjs/core";
import { DEG_TO_RAD, geodeticToEcef } from "foss-earth/cameraMath";
import { getCountry } from "../data/countries";
import { COUNTRY_TO_REGION, REGIONS } from "../data/regions";
import { findTradeRoute } from "../data/seaRoutes";
import type { RouteMode } from "../data/seaRoutes";
import type { RouteScenarioId } from "../data/seaRoutes";
import type { TradeFlow } from "../data/tradeFlows";

/** Altitude of sea lane polylines above surface (metres) */
const LANE_ALTITUDE = 12_000;

export interface RenderedLane {
  mesh: LinesMesh;
  flow: TradeFlow;
  mode: RouteMode;
  totalCostHours: number;
  totalDistanceKm: number;
  /** Interpolated [lat, lon] points along the route */
  points: [number, number][];
}

export function createSeaLanes(
  scene: Scene,
  flows: TradeFlow[],
  scenarioId: RouteScenarioId,
): RenderedLane[] {
  const lanes: RenderedLane[] = [];

  // Region color lookup
  const regionColorMap = new Map<string, [number, number, number]>();
  for (const r of REGIONS) regionColorMap.set(r.id, r.color);

  for (const flow of flows) {
    let fromCountry, toCountry;
    try {
      fromCountry = getCountry(flow.from);
      toCountry = getCountry(flow.to);
    } catch {
      continue; // skip flows for countries not in our dataset
    }

    // Find route via waypoint graph
    const cacheKey = `${scenarioId}:${flow.from}→${flow.to}`;
    const route = findTradeRoute(
      flow.from,
      fromCountry.lat,
      fromCountry.lon,
      flow.to,
      toCountry.lat,
      toCountry.lon,
      scenarioId,
      cacheKey,
    );
    if (!route || route.points.length < 2) continue;
    const points = route.points;

    const positions = points.map(([lat, lon]) => {
      const position = geodeticToEcef(lat * DEG_TO_RAD, lon * DEG_TO_RAD, LANE_ALTITUDE);
      return new Vector3(position.x, position.y, position.z);
    });

    // Color based on source region
    const regionId = COUNTRY_TO_REGION.get(flow.from) ?? "africa";
    const [r, g, b] = regionColorMap.get(regionId) ?? [180, 180, 180];
    const line = MeshBuilder.CreateLines(
      `oil-lane-${flow.from}-${flow.to}`,
      { points: positions },
      scene,
    );
    line.color = new Color3(r / 255, g / 255, b / 255);
    line.alpha = route.mode === "pipeline" ? 0.7 : 0.45;
    line.isPickable = false;
    line.metadata = {
      from: fromCountry.name,
      to: toCountry.name,
      tradeValueUsd: flow.value,
      routeMode: route.mode,
      transitDays: route.totalCostHours / 24,
      routeLengthKm: route.totalDistanceKm,
    };

    lanes.push({
      mesh: line,
      flow,
      mode: route.mode,
      totalCostHours: route.totalCostHours,
      totalDistanceKm: route.totalDistanceKm,
      points,
    });
  }

  return lanes;
}