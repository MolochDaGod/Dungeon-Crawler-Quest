/**
 * MINIMAL DEBUG SCENE — proves BabylonJS renders.
 * Just: engine, scene, camera, light, ground, box, character GLB.
 * No bridge, no controller, no HUD, no hierarchy.
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";

import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";

export async function buildDebugScene(container: HTMLElement) {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.outline = "none";
  container.appendChild(canvas);

  const engine = new Engine(canvas, true, { stencil: true, antialias: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.4, 0.6, 1); // blue sky

  // Camera looking at origin
  const camera = new ArcRotateCamera("cam", Math.PI / 4, Math.PI / 3, 10, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 30;

  // Light
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 1.0;

  // Green ground
  const ground = MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene);
  const groundMat = new StandardMaterial("gMat", scene);
  groundMat.diffuseColor = new Color3(0.2, 0.5, 0.15);
  ground.material = groundMat;

  // Red box (proves rendering works)
  const box = MeshBuilder.CreateBox("box", { size: 1 }, scene);
  box.position.y = 0.5;
  const boxMat = new StandardMaterial("bMat", scene);
  boxMat.diffuseColor = new Color3(0.8, 0.1, 0.1);
  box.material = boxMat;

  // Try loading character GLB
  try {
    const result = await SceneLoader.ImportMeshAsync("", "/assets/grudge-legacy/character/bambi.glb", "", scene);
    const root = result.meshes[0];
    // Auto-scale
    let maxY = 1;
    result.meshes.forEach(m => {
      const ext = m.getBoundingInfo?.()?.boundingBox?.extendSize;
      if (ext) maxY = Math.max(maxY, ext.y * 2);
    });
    root.scaling.setAll(maxY > 0 ? 1.8 / maxY : 1);
    root.position = new Vector3(2, 0, 0);
    console.log("[Debug] Character loaded, height:", maxY, "scale:", root.scaling.x);
  } catch (e) {
    console.warn("[Debug] GLB failed:", e);
    // Fallback capsule
    const cap = MeshBuilder.CreateCapsule("char", { height: 1.8, radius: 0.3 }, scene);
    cap.position = new Vector3(2, 0.9, 0);
    const cMat = new StandardMaterial("cMat", scene);
    cMat.diffuseColor = new Color3(0.3, 0.6, 0.9);
    cap.material = cMat;
  }

  // Spin the box
  scene.onBeforeRenderObservable.add(() => { box.rotation.y += 0.01; });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  console.log("[Debug] Scene running — you should see: blue sky, green ground, red spinning box, character model");

  return {
    engine, scene,
    dispose: () => { engine.stopRenderLoop(); scene.dispose(); engine.dispose(); canvas.remove(); },
  };
}
