/**
 * Genesis Character Select Screen
 *
 * Shows before the world loads. Player picks race + class, sees character
 * model preview, then clicks "Enter World" to load Genesis Island.
 *
 * Uses BabylonJS GUI for the UI, loads the 3 character GLBs as previews.
 */

import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Control } from "@babylonjs/gui/2D/controls/control";

import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/pbr.fragment";

import { HEROES, HeroData } from "./types";

// ── Race/Class definitions ─────────────────────────────────────

const RACES = ["Barbarian", "Human", "Dwarf", "Elf", "Undead", "Orc"];
const CLASSES = ["Warrior", "Mage", "Ranger", "Worg"];

const CLASS_COLORS: Record<string, string> = {
  Warrior: "#ef4444",
  Mage: "#8b5cf6",
  Ranger: "#22c55e",
  Worg: "#d97706",
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  Warrior: "Melee powerhouse. Shields, swords, heavy armor. Rallying cry buffs allies.",
  Mage: "Arcane spellcaster. Staves, tomes, cloth armor. Counterspell and elemental burst.",
  Ranger: "Ranged precision. Bows, daggers, leather armor. Stealth and tracking.",
  Worg: "Shapeshifter. Bear, raptor, bird forms. Feral frenzy and shadow clones.",
};

const MODEL_PATHS = [
  "/assets/grudge-legacy/character/bambi.glb",
  "/assets/grudge-legacy/character/basefemale.glb",
  "/assets/grudge-legacy/character/villhelm.glb",
];

// ── Result ─────────────────────────────────────────────────────

export interface CharacterSelectResult {
  race: string;
  heroClass: string;
  modelIndex: number;
}

// ── Build character select scene ───────────────────────────────

export async function buildCharacterSelectScene(
  canvas: HTMLCanvasElement,
  engine: Engine,
): Promise<{ scene: Scene; waitForSelection: () => Promise<CharacterSelectResult> }> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.06, 0.06, 0.12, 1);

  // IBL
  try {
    const envTex = CubeTexture.CreateFromPrefilteredData("/assets/env/environment.env", scene);
    scene.environmentTexture = envTex;
    scene.environmentIntensity = 0.6;
  } catch { /* ok */ }

  // Camera orbits the center pedestal
  const camera = new ArcRotateCamera("selectCam", Math.PI * 0.8, Math.PI / 2.8, 6, new Vector3(0, 1, 0), scene);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 10;
  camera.lowerBetaLimit = 0.4;
  camera.upperBetaLimit = Math.PI / 2.2;
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 40;

  // Lighting
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  const key = new DirectionalLight("key", new Vector3(-0.5, -1, 0.3).normalize(), scene);
  key.intensity = 1.5;
  key.diffuse = new Color3(1, 0.95, 0.85);

  // Ground pedestal
  const pedestal = MeshBuilder.CreateCylinder("pedestal", { height: 0.3, diameter: 3, tessellation: 32 }, scene);
  pedestal.position.y = -0.15;
  const pedMat = new PBRMaterial("pedMat", scene);
  pedMat.albedoColor = new Color3(0.15, 0.12, 0.1);
  pedMat.roughness = 0.3;
  pedMat.metallic = 0.6;
  pedestal.material = pedMat;

  // Load character models
  const loadedModels: TransformNode[] = [];
  for (let i = 0; i < MODEL_PATHS.length; i++) {
    try {
      const result = await SceneLoader.ImportMeshAsync("", MODEL_PATHS[i], "", scene);
      const root = result.meshes[0] as TransformNode;
      // Auto-scale to ~1.8 units tall
      let maxY = 1;
      result.meshes.forEach(m => {
        const ext = m.getBoundingInfo?.()?.boundingBox?.extendSize;
        if (ext) maxY = Math.max(maxY, ext.y * 2);
      });
      root.scaling.setAll(maxY > 0 ? 1.8 / maxY : 1);
      root.position = new Vector3(0, 0, 0);
      root.setEnabled(i === 0); // only first visible
      loadedModels.push(root);
    } catch (err) {
      console.warn(`[CharSelect] Model ${i} failed`, err);
      // Fallback capsule
      const cap = MeshBuilder.CreateCapsule(`char${i}`, { height: 1.8, radius: 0.3 }, scene);
      cap.position.y = 0.9;
      const mat = new PBRMaterial(`cm${i}`, scene);
      mat.albedoColor = new Color3(0.3 + i * 0.2, 0.4, 0.6 - i * 0.15);
      mat.roughness = 0.6;
      cap.material = mat;
      cap.setEnabled(i === 0);
      loadedModels.push(cap as unknown as TransformNode);
    }
  }

  // Slow rotate the visible model
  let rotY = 0;
  scene.onBeforeRenderObservable.add(() => {
    rotY += 0.005;
    for (const m of loadedModels) {
      if (m.isEnabled()) m.rotation = new Vector3(0, rotY, 0);
    }
  });

  // ── GUI ───────────────────────────────────────────────────
  const adt = AdvancedDynamicTexture.CreateFullscreenUI("selectUI", true, scene);

  let selectedRace = 0;
  let selectedClass = 0;
  let selectedModel = 0;

  // Title
  const title = new TextBlock("title", "GENESIS ISLAND");
  title.color = "#c5a059";
  title.fontSize = 28;
  title.fontFamily = "'Cinzel', serif";
  title.top = "-38%";
  title.outlineWidth = 2;
  title.outlineColor = "#000";
  adt.addControl(title);

  const subtitle = new TextBlock("sub", "Choose Your Champion");
  subtitle.color = "#888";
  subtitle.fontSize = 14;
  subtitle.fontFamily = "'Oxanium', monospace";
  subtitle.top = "-32%";
  adt.addControl(subtitle);

  // Left panel — Race
  const racePanel = new Rectangle("racePanel");
  racePanel.width = "180px"; racePanel.height = "300px";
  racePanel.left = "-38%"; racePanel.top = "5%";
  racePanel.background = "rgba(0,0,0,0.7)";
  racePanel.cornerRadius = 8;
  racePanel.thickness = 1;
  racePanel.color = "#c5a05940";
  racePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  racePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  adt.addControl(racePanel);

  const raceTitle = new TextBlock("rt", "RACE");
  raceTitle.color = "#c5a059";
  raceTitle.fontSize = 14;
  raceTitle.fontFamily = "'Oxanium', monospace";
  raceTitle.top = "-42%";
  racePanel.addControl(raceTitle);

  const raceStack = new StackPanel("raceStack");
  raceStack.isVertical = true;
  raceStack.top = "10px";
  racePanel.addControl(raceStack);

  const raceButtons: Button[] = [];
  for (let i = 0; i < RACES.length; i++) {
    const btn = Button.CreateSimpleButton(`race${i}`, RACES[i]);
    btn.width = "160px"; btn.height = "36px";
    btn.color = i === 0 ? "#c5a059" : "#666";
    btn.background = i === 0 ? "rgba(197,160,89,0.15)" : "transparent";
    btn.cornerRadius = 4;
    btn.thickness = 1;
    btn.fontFamily = "'Oxanium', monospace";
    btn.fontSize = 12;
    btn.paddingBottom = "3px";
    btn.onPointerClickObservable.add(() => {
      selectedRace = i;
      raceButtons.forEach((b, j) => {
        b.color = j === i ? "#c5a059" : "#666";
        b.background = j === i ? "rgba(197,160,89,0.15)" : "transparent";
      });
    });
    raceStack.addControl(btn);
    raceButtons.push(btn);
  }

  // Right panel — Class
  const classPanel = new Rectangle("classPanel");
  classPanel.width = "200px"; classPanel.height = "300px";
  classPanel.left = "38%"; classPanel.top = "5%";
  classPanel.background = "rgba(0,0,0,0.7)";
  classPanel.cornerRadius = 8;
  classPanel.thickness = 1;
  classPanel.color = "#c5a05940";
  classPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  classPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  adt.addControl(classPanel);

  const classTitle = new TextBlock("ct", "CLASS");
  classTitle.color = "#c5a059";
  classTitle.fontSize = 14;
  classTitle.fontFamily = "'Oxanium', monospace";
  classTitle.top = "-42%";
  classPanel.addControl(classTitle);

  const classStack = new StackPanel("classStack");
  classStack.isVertical = true;
  classStack.top = "-15px";
  classPanel.addControl(classStack);

  const classDesc = new TextBlock("classDesc", CLASS_DESCRIPTIONS[CLASSES[0]]);
  classDesc.color = "#999";
  classDesc.fontSize = 10;
  classDesc.fontFamily = "'Oxanium', monospace";
  classDesc.top = "40%";
  classDesc.textWrapping = true;
  classDesc.width = "180px";
  classPanel.addControl(classDesc);

  const classButtons: Button[] = [];
  for (let i = 0; i < CLASSES.length; i++) {
    const cls = CLASSES[i];
    const btn = Button.CreateSimpleButton(`class${i}`, cls);
    btn.width = "180px"; btn.height = "44px";
    btn.color = i === 0 ? CLASS_COLORS[cls] : "#666";
    btn.background = i === 0 ? `${CLASS_COLORS[cls]}20` : "transparent";
    btn.cornerRadius = 4;
    btn.thickness = 1;
    btn.fontFamily = "'Oxanium', monospace";
    btn.fontSize = 13;
    btn.paddingBottom = "3px";
    btn.onPointerClickObservable.add(() => {
      selectedClass = i;
      classDesc.text = CLASS_DESCRIPTIONS[cls] || "";
      classButtons.forEach((b, j) => {
        const c = CLASSES[j];
        b.color = j === i ? CLASS_COLORS[c] : "#666";
        b.background = j === i ? `${CLASS_COLORS[c]}20` : "transparent";
      });
    });
    classStack.addControl(btn);
    classButtons.push(btn);
  }

  // Bottom — model switch arrows + Enter World button
  const modelLabel = new TextBlock("modelLabel", "Model 1 / 3");
  modelLabel.color = "#888";
  modelLabel.fontSize = 11;
  modelLabel.fontFamily = "'Oxanium', monospace";
  modelLabel.top = "28%";
  adt.addControl(modelLabel);

  const prevBtn = Button.CreateSimpleButton("prev", "◀");
  prevBtn.width = "40px"; prevBtn.height = "36px";
  prevBtn.left = "-60px"; prevBtn.top = "28%";
  prevBtn.color = "#c5a059"; prevBtn.background = "rgba(0,0,0,0.5)";
  prevBtn.cornerRadius = 4; prevBtn.thickness = 1;
  prevBtn.fontSize = 16;
  prevBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  prevBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  prevBtn.onPointerClickObservable.add(() => {
    loadedModels[selectedModel]?.setEnabled(false);
    selectedModel = (selectedModel - 1 + loadedModels.length) % loadedModels.length;
    loadedModels[selectedModel]?.setEnabled(true);
    modelLabel.text = `Model ${selectedModel + 1} / ${loadedModels.length}`;
  });
  adt.addControl(prevBtn);

  const nextBtn = Button.CreateSimpleButton("next", "▶");
  nextBtn.width = "40px"; nextBtn.height = "36px";
  nextBtn.left = "60px"; nextBtn.top = "28%";
  nextBtn.color = "#c5a059"; nextBtn.background = "rgba(0,0,0,0.5)";
  nextBtn.cornerRadius = 4; nextBtn.thickness = 1;
  nextBtn.fontSize = 16;
  nextBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  nextBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  nextBtn.onPointerClickObservable.add(() => {
    loadedModels[selectedModel]?.setEnabled(false);
    selectedModel = (selectedModel + 1) % loadedModels.length;
    loadedModels[selectedModel]?.setEnabled(true);
    modelLabel.text = `Model ${selectedModel + 1} / ${loadedModels.length}`;
  });
  adt.addControl(nextBtn);

  // Enter World button
  const enterBtn = Button.CreateSimpleButton("enter", "⚔ ENTER WORLD ⚔");
  enterBtn.width = "220px"; enterBtn.height = "50px";
  enterBtn.top = "40%";
  enterBtn.color = "#c5a059";
  enterBtn.background = "rgba(197,160,89,0.2)";
  enterBtn.cornerRadius = 8;
  enterBtn.thickness = 2;
  enterBtn.fontFamily = "'Cinzel', serif";
  enterBtn.fontSize = 16;
  enterBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  enterBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  adt.addControl(enterBtn);

  // Wait for selection
  const waitForSelection = (): Promise<CharacterSelectResult> => {
    return new Promise(resolve => {
      enterBtn.onPointerClickObservable.add(() => {
        // Save selection to localStorage
        const race = RACES[selectedRace];
        const heroClass = CLASSES[selectedClass];

        // Find or create a hero matching this race+class
        let hero = HEROES.find(h => h.race === race && h.heroClass === heroClass);
        if (!hero) hero = HEROES.find(h => h.heroClass === heroClass);
        if (!hero) hero = HEROES[0];

        if (hero) {
          localStorage.setItem("grudge_hero_id", String(hero.id));
        }

        // Cleanup select scene
        adt.dispose();
        scene.dispose();

        resolve({ race, heroClass, modelIndex: selectedModel });
      });
    });
  };

  return { scene, waitForSelection };
}
