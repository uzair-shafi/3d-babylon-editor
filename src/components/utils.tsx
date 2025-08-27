
import { Scene, Color3, Quaternion, Texture, StandardMaterial, Vector3, TransformNode } from '@babylonjs/core';
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { RefObject } from 'react';

export const applyMaterialToMesh = (
    mesh: AbstractMesh | null,
    material: any
) => {
    if (!mesh || !material) return;

    const applyTo = (targetMesh: AbstractMesh) => {
        targetMesh.material = material;
        targetMesh.metadata = {
            ...(targetMesh.metadata || {}),
            customMaterialApplied: true,
            appliedMaterialName: material.name,
        };
    };

    if (mesh.getChildMeshes().length > 0) {
        mesh.getChildMeshes().forEach(applyTo);
    } else {
        applyTo(mesh);
    }
};

export const applyTextureToMesh = (
    mesh: AbstractMesh | null,
    textureName: string,
    scene: Scene | null
) => {
    if (!mesh || !scene || textureName === 'None') return;

    const texturePath = `/${textureName}`;
    const texture = new Texture(texturePath, scene);

    texture.uScale = 1;
    texture.vScale = 1;

    const material = new StandardMaterial('textureMat', scene);
    material.diffuseTexture = texture;

    material.specularColor.set(0, 0, 0);
    material.backFaceCulling = false;

    mesh.material = material;
    mesh.metadata = {
        ...(mesh.metadata || {}),
        textureName
    };
};

export const applyColorToMeshMaterial = (
    mesh: AbstractMesh | null,
    hexColor: string
) => {
    if (!mesh) return;

    const color = Color3.FromHexString(hexColor);

    const applyTo = (targetMesh: AbstractMesh) => {
        if (!targetMesh.material) return;

        let material = targetMesh.material;
        if (!material.name.includes(targetMesh.name)) {
            const clonedMaterial = material.clone(`${material.name}_${targetMesh.name}`);
            if (clonedMaterial) {
                targetMesh.material = clonedMaterial;
                material = clonedMaterial;
            }
        }

        for (const prop of ["albedoColor", "diffuseColor", "baseColor", "emissiveColor"]) {
            if ((material as any)[prop]) {
                (material as any)[prop] = color;
            }
        }
        if (!targetMesh.metadata) {
            targetMesh.metadata = {};
        }

        targetMesh.metadata.customColorApplied = true;
        targetMesh.metadata.appliedColorHex = hexColor;
        (material as any).markDirty?.();
    };
    const childMeshes = mesh.getChildMeshes();
    if (childMeshes.length > 0) {
        childMeshes.forEach(applyTo);
    } else {
        applyTo(mesh);
    }
};

export const CenteredLoader = () => (
    <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        fontSize: '24px',
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.5)',
        padding: '12px 24px',
        borderRadius: '8px',
    }}>
        Rendering...
    </div>
);

export const loadModelToScene = async (
    modelName: string,
    scene: Scene,
    onSuccess: (rootName: string, meshes: any[]) => void,
    onError?: (error: any) => void,
) => {
    try {
        const rootName = modelName.replace('.glb', '');
        const result = await ImportMeshAsync("/" + modelName, scene);
        const meshes = result.meshes;

        if (meshes.length === 0) return;

        const root = meshes[0];
        root.metadata = { modelFile: modelName };

        const uniqueName = `${rootName}_${Date.now()}`;
        root.name = uniqueName;

        meshes.forEach((mesh, index) => {
            if (mesh !== root) {
                mesh.name = `${uniqueName}_child_${index}`;
            }
        });
        const existingModels = scene.meshes.filter(m => m.metadata?.modelFile);
        if (existingModels.length === 1) {
            root.position.set(0, 0, 0);
        } else {
            const gridRange = 5;
            const step = 1.5;
            const padding = 0.2;

            const { min, max } = root.getHierarchyBoundingVectors();
            const modelWidth = max.x - min.x;
            const modelDepth = max.z - min.z;

            let placed = false;

            for (let x = -gridRange; x <= gridRange && !placed; x += step) {
                for (let z = -gridRange; z <= gridRange && !placed; z += step) {
                    const targetMinX = x - modelWidth / 2 - padding;
                    const targetMaxX = x + modelWidth / 2 + padding;
                    const targetMinZ = z - modelDepth / 2 - padding;
                    const targetMaxZ = z + modelDepth / 2 + padding;

                    const overlaps = existingModels.some(existing => {
                        const bounds = existing.getHierarchyBoundingVectors();
                        return !(
                            bounds.max.x < targetMinX ||
                            bounds.min.x > targetMaxX ||
                            bounds.max.z < targetMinZ ||
                            bounds.min.z > targetMaxZ
                        );
                    });

                    if (!overlaps) {
                        root.position.set(x, 0, z);
                        placed = true;
                    }
                }
            }
            if (!placed) {
                let maxRightX = 0;
                existingModels.forEach(m => {
                    const bounds = m.getHierarchyBoundingVectors();
                    if (bounds.max.x > maxRightX) {
                        maxRightX = bounds.max.x;
                    }
                });
                root.position.set(maxRightX + modelWidth + 0.5, 0, 0);
            }
        }

        onSuccess(uniqueName, meshes);
    } catch (error) {
        console.error("Failed to load model:", error);
        onError?.(error);
    }
};

export const duplicateModel = async (
    selected: AbstractMesh,
    scene: Scene,
    onSuccess: (rootName: string, meshes: AbstractMesh[]) => void,
    onError?: (error: any) => void,
    onSelectNewModel?: (mesh: any) => void

) => {
    try {
        const modelFile = selected.metadata?.modelFile;
        if (!modelFile) throw new Error("Original model file not found in metadata");

        await loadModelToScene(modelFile, scene, (newRootName, newMeshes) => {
            const root = scene.getMeshByName(newRootName);
            if (root) {
                const { min, max } = selected.getHierarchyBoundingVectors();
                const width = max.x - min.x;
                const padding = 0.3;
                const originalPosition = selected.getAbsolutePosition();
                const offset = new Vector3(-(width + padding), 0, 0);

                root.position = originalPosition.add(offset);
            }
            onSelectNewModel?.(root);
            onSuccess(newRootName, newMeshes);
        }, onError);
    } catch (err) {
        console.error("Failed to duplicate model:", err);
        onError?.(err);
    }
};

interface ReplaceModelOptions {
    selectedModel: string;
    selectedMesh: AbstractMesh | null;
    scene: Scene;
    modelMapRef: RefObject<Map<string, AbstractMesh[]>>;
    gizmoManagerRef: RefObject<any>;
    setLoading: (state: boolean) => void;
    getBaseType: (model: string) => string;
}
export const replaceModel = ({
    selectedModel,
    selectedMesh,
    scene,
    modelMapRef,
    gizmoManagerRef,
    setLoading,
    getBaseType,
    onSelectNewModel,
}: ReplaceModelOptions & { onSelectNewModel?: (mesh: AbstractMesh) => void }) => {
    const newModelBaseType = getBaseType(selectedModel);
    const proceedWithReplacement = (targetMesh: AbstractMesh, replaceEntireRoot: boolean) => {
        const oldPosition = targetMesh.position.clone();
        const oldRotationQuaternion = targetMesh.rotationQuaternion?.clone();
        const oldScaling = targetMesh.scaling.clone();

        let oldMaterial = targetMesh.material;
        let customMaterialApplied = false;
        let appliedMaterialName: string | undefined = undefined;

        if (!oldMaterial) {
            const childWithMaterial = targetMesh.getChildMeshes().find(mesh => mesh.material);
            if (childWithMaterial) {
                oldMaterial = childWithMaterial.material;
                customMaterialApplied = !!childWithMaterial.metadata?.customMaterialApplied;
                appliedMaterialName = childWithMaterial.metadata?.appliedMaterialName;
            }
        } else {
            customMaterialApplied = !!targetMesh.metadata?.customMaterialApplied;
            appliedMaterialName = targetMesh.metadata?.appliedMaterialName;
        }

        let customColorApplied = false;
        let appliedColorHex: string | undefined = undefined;

        const childColorMesh = targetMesh.getChildMeshes().find(mesh => !!mesh.metadata?.customColorApplied);
        if (childColorMesh) {
            customColorApplied = true;
            appliedColorHex = childColorMesh.metadata?.appliedColorHex;
        } else if (targetMesh.metadata?.customColorApplied) {
            customColorApplied = true;
            appliedColorHex = targetMesh.metadata?.appliedColorHex;
        }

        loadModelToScene(
            selectedModel,
            scene,
            (newRootName, newMeshes) => {
                const newRoot = scene.getMeshByName(newRootName);
                if (!newRoot) return;
                newRoot.position = oldPosition;
                newRoot.scaling = oldScaling;
                if (oldRotationQuaternion) {
                    newRoot.rotationQuaternion = oldRotationQuaternion.clone();
                } else {
                    newRoot.rotation = targetMesh.rotation.clone();
                }

                if (customMaterialApplied && oldMaterial) {
                    newMeshes.forEach((mesh) => {
                        mesh.material = oldMaterial;
                        mesh.metadata = {
                            ...(mesh.metadata || {}),
                            customMaterialApplied: true,
                            appliedMaterialName,
                        };
                    });
                }

                if (customColorApplied && appliedColorHex) {
                    newMeshes.forEach((mesh) => {
                        applyColorToMeshMaterial(mesh, appliedColorHex!);
                    });
                }

                modelMapRef.current.set(newRootName, newMeshes);
                setLoading(false);

                if (replaceEntireRoot) {
                    targetMesh.getChildMeshes().forEach(m => m.dispose());
                    targetMesh.dispose();
                } else {
                    targetMesh.dispose();
                }

                gizmoManagerRef.current?.attachToMesh(null);
                onSelectNewModel?.(newRoot);
            },
            () => setLoading(false)
        );
    };

    if (selectedMesh) {
        setLoading(true);

        const parentEntry = Array.from(modelMapRef.current.entries()).find(([_, meshes]) =>
            meshes.includes(selectedMesh)
        );

        if (!parentEntry) {
            console.warn("Selected mesh not found in modelMap");
            setLoading(false);
            return;
        }

        const [parentRootName, meshes] = parentEntry;
        const isRootMesh = selectedMesh.name === parentRootName;

        if (!isRootMesh) {
            alert("Only the entire model can be replaced, not an individual part.");
            setLoading(false);
            return;
        }

        const selectedMeshBaseType = getBaseType(parentRootName);
        if (newModelBaseType !== selectedMeshBaseType) {
            alert("Only model with similar category can be replaced with the selected one.");
            setLoading(false);
            return;
        }

        proceedWithReplacement(selectedMesh, true);
    } else {
        setLoading(true);
        loadModelToScene(
            selectedModel,
            scene,
            (rootName, meshes) => {
                modelMapRef.current.set(rootName, meshes);
                setLoading(false);
            },
            () => setLoading(false)
        );
    }
};

type ChildMeshData = {
    meshSuffix: string;
    position: number[];
    rotation?: any
    scaling: number[];
    materialName: string;
    colorHex: string | null;
    textureName: string | null;
};

type ModelData = {
    modelName: string;
    position: number[];
    rotation: any;
    scaling: number[];
    materialName: string;
    colorHex: string | null;
    parentName: string | null;
    children: ChildMeshData[] | null;
};

export const generateExportData = (
    scene: Scene,
    modelMap: Map<string, AbstractMesh[]>
): { models: ModelData[] } => {
    const exportData: ModelData[] = [];

    for (const [rootName, meshes] of modelMap.entries()) {
        const rootMesh = scene.getMeshByName(rootName);
        if (!rootMesh) continue;

        const modelName = rootName.replace(/^\/?/, "").split("_")[0];

        const oldPosition = rootMesh.position.asArray();
        const oldRotation = rootMesh.rotationQuaternion;
        const oldScaling = rootMesh.scaling.asArray();
        const parentName = rootMesh.parent && rootMesh.parent instanceof TransformNode
            ? rootMesh.parent.name
            : null;
        let oldMaterial = rootMesh.material;
        let customMaterialApplied = false;
        let appliedMaterialName: string | undefined = undefined;

        if (!oldMaterial) {
            const childWithMaterial = rootMesh.getChildMeshes().find(mesh => mesh.material);
            if (childWithMaterial) {
                oldMaterial = childWithMaterial.material;
                customMaterialApplied = !!childWithMaterial.metadata?.customMaterialApplied;
                appliedMaterialName = childWithMaterial.metadata?.appliedMaterialName;
            }
        } else {
            customMaterialApplied = !!rootMesh.metadata?.customMaterialApplied;
            appliedMaterialName = rootMesh.metadata?.appliedMaterialName;
        }

        let customColorApplied = false;
        let appliedColorHex: string | undefined = undefined;

        const childColorMesh = rootMesh.getChildMeshes().find(mesh => !!mesh.metadata?.customColorApplied);
        if (childColorMesh) {
            customColorApplied = true;
            appliedColorHex = childColorMesh.metadata?.appliedColorHex;
        } else if (rootMesh.metadata?.customColorApplied) {
            customColorApplied = true;
            appliedColorHex = rootMesh.metadata?.appliedColorHex;
        }
        const children = rootMesh.getChildMeshes().map(child => {
            const match = child.name.match(/child_\d+$/);
            const meshSuffix = match ? match[0] : child.name;

            return {
                meshSuffix,
                position: child.position.asArray(),
                rotation: child.rotationQuaternion || undefined,
                scaling: child.scaling.asArray(),
                materialName: child.metadata?.appliedMaterialName || "None",
                colorHex: child.metadata?.appliedColorHex || null,
                textureName: child.metadata?.textureName || null
            };
        });

        exportData.push({
            modelName,
            position: oldPosition,
            rotation: oldRotation,
            scaling: oldScaling,
            materialName: appliedMaterialName || "None",
            colorHex: appliedColorHex || null,
            parentName,
            children
        });
    }

    return { models: exportData };
};


export const importSceneFromData = async (
    data: { models: ModelData[] },
    scene: Scene,
    modelMap: Map<string, any>,
    materialMap: Map<string, any>,
    parentMap?: { [key: string]: TransformNode }
): Promise<void> => {
    if (!Array.isArray(data.models)) {
        throw new Error("Invalid scene format: 'models' must be an array.");
    }

    for (const modelData of data.models) {
        const {
            modelName,
            position,
            rotation,
            scaling,
            materialName,
            colorHex,
            children,
            parentName,
        } = modelData;

        const path = `${modelName}.glb`;

        await new Promise<void>((resolve) => {
            loadModelToScene(
                path,
                scene,
                (newRootName, newMeshes) => {
                    const newRoot = scene.getMeshByName(newRootName);
                    if (!newRoot) return;
                    if (position) newRoot.position.fromArray(position);
                    if (scaling) newRoot.scaling.fromArray(scaling);
                    if (rotation) {
                        newRoot.rotationQuaternion = new Quaternion(rotation._x, rotation._y, rotation._z, rotation._w);
                    }
                    if (parentName && parentMap && parentMap[parentName]) {
                        parentMap[parentName].addChild(newRoot);
                    }
                    const mat = materialMap.get(materialName || "");
                    if (mat) {
                        newMeshes.forEach((mesh) => {
                            applyMaterialToMesh(mesh, mat);
                        });
                    }

                    if (colorHex) {
                        newMeshes.forEach((mesh) => {
                            applyColorToMeshMaterial(mesh, colorHex);
                        });
                    }

                    if (Array.isArray(children)) {
                        for (const childData of children) {
                            const {
                                meshSuffix,
                                position: childPos,
                                scaling: childScale,
                                rotation: childRot,
                                materialName: childMatName,
                                colorHex: childColorHex,
                                textureName,
                            } = childData;

                            const targetMesh = newMeshes.find(m => m.name.endsWith(meshSuffix));
                            if (!targetMesh) continue;

                            if (childPos) targetMesh.position.fromArray(childPos);
                            if (childScale) targetMesh.scaling.fromArray(childScale);
                            if (childRot) {
                                targetMesh.rotationQuaternion = new Quaternion(
                                    childRot._x,
                                    childRot._y,
                                    childRot._z,
                                    childRot._w
                                );
                            }

                            const childMat = materialMap.get(childMatName || "");
                            if (childMat) {
                                applyMaterialToMesh(targetMesh, childMat);
                            }

                            if (childColorHex) {
                                applyColorToMeshMaterial(targetMesh, childColorHex);
                            }

                            if (textureName && textureName !== "None") {
                                applyTextureToMesh(targetMesh, textureName, scene);
                            }
                        }
                    }

                    modelMap.set(newRootName, newMeshes);
                    resolve();
                },
                () => resolve()
            );
        });
    }
};