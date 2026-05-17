// ─── Country Sphere Visualization ───────────────────────────────────
// Creates sized/colored spheres for each oil-trading country on the Babylon globe.

import { Color3, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { AbstractMesh, Scene } from "@babylonjs/core";
import { DEG_TO_RAD, geodeticToEcef } from "foss-earth/cameraMath";
import { COUNTRIES } from "../data/countries";
import { totalExports, totalImports } from "../data/tradeFlows";
import { type Region, REGIONS } from "../data/regions";

/** Minimum marker radius in metres. Kept intentionally visible at whole-globe zoom. */
const BASE_RADIUS = 16_000;
/** Scaling factor for log(volume). */
const LOG_SCALE = 7_000;

export function createCountrySpheres(
  scene: Scene,
): AbstractMesh[] {
  const meshes: AbstractMesh[] = [];

  // Precompute region color map
  const regionMap = new Map<string, Region>();
  for (const r of REGIONS) regionMap.set(r.id, r);

  for (const country of COUNTRIES) {
    const exp = totalExports(country.code);
    const imp = totalImports(country.code);
    const total = exp + imp;
    if (total === 0) continue;

    const radius = BASE_RADIUS + Math.log1p(total / 1e9) * LOG_SCALE;

    // Color: net exporters → warm, net importers → cool
    const ratio = total > 0 ? (exp - imp) / total : 0;
    const region = regionMap.get(country.region);
    const [rr, gg, bb] = region?.color ?? [180, 180, 180];

    // Blend region color with export/import tint
    const tintR = ratio >= 0 ? Math.min(255, rr + 60 * ratio) : Math.max(0, rr - 40);
    const tintG = ratio >= 0 ? Math.max(0, gg - 30 * ratio) : Math.min(255, gg + 30);
    const tintB = ratio >= 0 ? Math.max(0, bb - 50 * ratio) : Math.min(255, bb + 60);
    const color = new Color3(tintR / 255, tintG / 255, tintB / 255);
    const isNetImporter = imp > exp;

    const material = new StandardMaterial(`oil-country-${country.code}-material`, scene);
    material.diffuseColor = color;
    material.emissiveColor = color;
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    material.alpha = 0.3;

    const mesh = MeshBuilder.CreateSphere(
      `oil-country-${country.code}`,
      { diameter: radius * (isNetImporter ? 2.5 : 3), segments: 24 },
      scene,
    );
    const position = geodeticToEcef(country.lat * DEG_TO_RAD, country.lon * DEG_TO_RAD, 0);
    mesh.position = new Vector3(position.x, position.y, position.z);
    mesh.material = material;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = 1;
    mesh.metadata = {
      countryCode: country.code,
      countryName: country.name,
      portName: country.portName,
      exportsUsd: exp,
      importsUsd: imp,
    };

    meshes.push(mesh);
  }

  return meshes;
}