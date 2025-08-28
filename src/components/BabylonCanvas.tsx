import React, { useEffect, useRef, useState } from "react";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color4,
  Mesh,
  PointerEventTypes,
  AbstractMesh,
  Color3,
  HighlightLayer,
  GizmoManager,
  PBRMaterial,
  TransformNode,
  CubicEase,
  Animation,
} from "@babylonjs/core";
import { useEditorControls } from "./UIControls";
import { createMaterials } from "./materials";
import {
  applyColorToMeshMaterial,
  applyMaterialToMesh,
  applyTextureToMesh,
  CenteredLoader,
  duplicateModel,
  generateExportData,
  importSceneFromData,
  replaceModel,
} from "./utils";
import "@babylonjs/loaders/glTF";
import ContextMenu from "./contextMenu";

type BabylonCanvasProps = {
  boxColor: string;
  materialName: string;
  selectedModel: string;
  textureName: string;
};

const getBaseType = (name: string) => {
  return name.match(/^[a-zA-Z]+/)?.[0]?.toLowerCase() || "";
};

export const BabylonCanvas: React.FC<BabylonCanvasProps> = ({
  boxColor,
  materialName,
  selectedModel,
  textureName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const selectedMeshRef = useRef<AbstractMesh | null>(null);
  const modelMapRef = useRef<Map<string, AbstractMesh[]>>(new Map());
  const materialMapRef = useRef<Map<string, PBRMaterial>>(new Map());
  const highlightLayerRef = useRef<HighlightLayer | null>(null);
  const mainContainerRef = useRef<TransformNode | null>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  const animateCameraTarget = (
    camera: ArcRotateCamera,
    newTarget: Vector3,
    scene: Scene,
    duration: number = 30
  ) => {
    Animation.CreateAndStartAnimation(
      "cameraTargetAnim",
      camera,
      "target",
      60,
      duration,
      camera.target.clone(),
      newTarget.clone(),
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      new CubicEase()
    );
  };
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.15, 0.15, 0.15, 1);
    const mainContainer = new TransformNode("parentContainer", scene);
    mainContainer.position = Vector3.Zero();
    mainContainerRef.current = mainContainer;
    materialMapRef.current = createMaterials(scene);

    scene.onBeforeRenderObservable.add(() => {
      const minY = 0;

      for (const [rootName, meshes] of modelMapRef.current.entries()) {
        const root = scene.getMeshByName(rootName);
        if (!root) continue;

        const { min: boundingMin } = root.getHierarchyBoundingVectors();

        if (boundingMin.y < minY) {
          const diff = minY - boundingMin.y;
          root.position.y += diff;
        }
      }
    });

    const camera = new ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 2.5,
      5,
      Vector3.Zero(),
      scene
    );
    animateCameraTarget(camera, mainContainer.getAbsolutePosition(), scene);
    camera.attachControl(canvasRef.current, true);
    camera.wheelPrecision = 80.0;
    camera.minZ = 0.01;

    const light = new HemisphericLight("light", new Vector3(0, 50, 0), scene);
    light.intensity = 5.0;

    const highlightLayer = new HighlightLayer("highlightLayer", scene);
    highlightLayerRef.current = highlightLayer;

    const gizmoManager = new GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManagerRef.current = gizmoManager;

    canvasRef.current.addEventListener("dblclick", (event: MouseEvent) => {
      if (event.button !== 0) return;
      const pickResult = scene.pick(event.clientX, event.clientY);

      if (
        !pickResult.hit ||
        pickResult.pickedMesh?.metadata?.isBackgroundPlane
      ) {
        handleClearSelection();
      }
    });

    scene.onPointerObservable.add((pointerInfo) => {
      if (
        pointerInfo.type === PointerEventTypes.POINTERPICK &&
        pointerInfo.event?.button === 0
      ) {
        setContextMenu({ visible: false, x: 0, y: 0 });
        const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
        let found = false;
        if (pickedMesh) {
          for (let [, meshes] of modelMapRef.current.entries()) {
            if (meshes.includes(pickedMesh)) {
              found = true;
              break;
            }
          }
        }
        if (!pickedMesh) {
          handleClearSelection();
          animateCameraTarget(
            camera,
            mainContainer.getAbsolutePosition(),
            scene
          );
          return;
        }
        const ctrlKey = pointerInfo.event?.ctrlKey;
        highlightLayer.removeAllMeshes();

        for (let [rootName, meshes] of modelMapRef.current.entries()) {
          if (meshes.includes(pickedMesh)) {
            const root = scene.getMeshByName(rootName);
            if (!root) break;

            const isWholeModel = ctrlKey;
            const meshToSelect = isWholeModel ? root : pickedMesh;

            if (isWholeModel) {
              meshes?.forEach((mesh) =>
                highlightLayer.addMesh(mesh as Mesh, Color3.Yellow())
              );
            } else {
              highlightLayer.addMesh(pickedMesh as Mesh, Color3.Blue());
            }

            selectedMeshRef.current = meshToSelect;
            gizmoManager.attachToMesh(meshToSelect);
            gizmoManager.attachToMesh(meshToSelect);
            animateCameraTarget(
              camera,
              meshToSelect.getAbsolutePosition(),
              scene
            );
            break;
          }
        }
      }
    });
    scene.onPointerObservable.add((pointerInfo) => {
      if (
        pointerInfo.type === PointerEventTypes.POINTERDOWN &&
        pointerInfo.event?.button === 2
      ) {
        const selected = selectedMeshRef.current;
        if (!selected) return;
        const isParentMesh = modelMapRef.current.has(selected.name);
        if (!isParentMesh) return;
        const { clientX, clientY } = pointerInfo.event;
        setContextMenu({
          visible: true,
          x: clientX,
          y: clientY,
        });
      }
    });
    engine.runRenderLoop(() => scene.render());

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const mainContainer = mainContainerRef.current;
    if (!scene || !mainContainer) return;

    for (const [name, meshes] of modelMapRef.current.entries()) {
      const root = scene.getMeshByName(name);
      if (root && !mainContainer.getChildren().includes(root)) {
        mainContainer.addChild(root);
      }
    }
  }, [modelMapRef.current.size]);

  const handleExportScene = () => {
    if (!sceneRef.current) {
      console.warn("Scene not available");
      return;
    }

    const scene = sceneRef.current;
    const modelMap = modelMapRef.current;

    const finalData = generateExportData(scene, modelMap);

    const blob = new Blob([JSON.stringify(finalData, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scene.json";
    a.click();
  };

  const handleImportScene = async (file: File) => {
    const scene = sceneRef.current;
    if (!scene) return;

    try {
      setLoading2(true);
      const text = await file.text();
      const data = JSON.parse(text);

      await importSceneFromData(
        data,
        scene,
        modelMapRef.current,
        materialMapRef.current,
        { mainContainer: mainContainerRef.current! }
      );
    } catch (err) {
      console.error("Failed to import scene:", err);
    } finally {
      setLoading2(false);
    }
  };

  const handleClearSelection = () => {
    selectedMeshRef.current = null;
    highlightLayerRef.current?.removeAllMeshes();
    gizmoManagerRef.current?.attachToMesh(null);
  };
  const controls = useEditorControls(
    handleExportScene,
    handleImportScene,
    handleClearSelection
  );
  useEffect(() => {
    if (!selectedModel || selectedModel === "None") return;

    const scene = sceneRef.current;
    if (!scene) return;

    replaceModel({
      selectedModel,
      selectedMesh: selectedMeshRef.current,
      scene,
      modelMapRef,
      gizmoManagerRef,
      setLoading,
      getBaseType,
      onSelectNewModel: (newRoot) => {
        makeModelSelected(newRoot);
      },
    });
  }, [selectedModel]);

  useEffect(() => {
    applyColorToMeshMaterial(selectedMeshRef.current, boxColor);
  }, [boxColor]);

  useEffect(() => {
    const selectedMaterial = materialMapRef.current.get(materialName);
    applyMaterialToMesh(selectedMeshRef.current, selectedMaterial);
  }, [materialName]);

  useEffect(() => {
    if (!sceneRef.current) return;

    applyTextureToMesh(selectedMeshRef.current, textureName, sceneRef.current);
  }, [textureName]);

  const makeModelSelected = (mesh: AbstractMesh) => {
    const scene = sceneRef.current!;
    const gizmoManager = gizmoManagerRef.current!;
    const highlightLayer = highlightLayerRef.current!;
    highlightLayer.removeAllMeshes();
    gizmoManager.attachToMesh(null);
    selectedMeshRef.current = null;
    highlightLayer.removeAllMeshes();
    gizmoManager.attachToMesh(null);
    selectedMeshRef.current = null;

    const modelMap = modelMapRef.current;
    for (let [rootName, meshes] of modelMap.entries()) {
      if (meshes.includes(mesh)) {
        console.log(meshes);
        meshes.forEach((m) =>
          highlightLayer.addMesh(m as Mesh, Color3.Yellow())
        );
        selectedMeshRef.current = mesh;
        gizmoManager.attachToMesh(mesh);
        if (mesh.parent !== mainContainerRef.current) {
          mainContainerRef.current?.addChild(mesh);
        }
        break;
      }
    }
  };

  const removeSelectedModel = () => {
    const selected = selectedMeshRef.current;
    if (!selected) return;
    const scene = sceneRef.current;
    if (!scene) return;
    if (selected.parent) {
      selected.setParent(null);
    }
    selected.getChildMeshes().forEach((m) => m.dispose());
    selected.dispose();
    for (const [key, meshes] of modelMapRef.current.entries()) {
      if (meshes.includes(selected)) {
        modelMapRef.current.delete(key);
        break;
      }
    }
    gizmoManagerRef.current?.attachToMesh(null);
    selectedMeshRef.current = null;
  };

  return (
    <>
      {(loading || loading2) && <CenteredLoader />}
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />
      {contextMenu.visible && (
        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          sceneRef={sceneRef}
          selectedMeshRef={selectedMeshRef}
          modelMapRef={modelMapRef}
          gizmoManagerRef={gizmoManagerRef}
          duplicateModel={duplicateModel}
          removeSelectedModel={removeSelectedModel}
          makeModelSelected={makeModelSelected}
        />
      )}
    </>
  );
};
