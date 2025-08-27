import { Scene, PBRMaterial, Color3 } from '@babylonjs/core';

export const createMaterials = (scene: Scene) => {
    const materials = new Map<string, PBRMaterial>();

    const gold = new PBRMaterial("gold", scene);
    gold.albedoColor = new Color3(1.0, 0.788, 0.2);
    gold.metallic = 1.0;
    gold.roughness = 0.2;
    materials.set("gold", gold);

    const silver = new PBRMaterial("silver", scene);
    silver.albedoColor = new Color3(0.75, 0.75, 0.75);
    silver.metallic = 1.0;
    silver.roughness = 0.3;
    materials.set("silver", silver);

    const copper = new PBRMaterial("copper", scene);
    copper.albedoColor = new Color3(0.72, 0.45, 0.20);
    copper.metallic = 1.0;
    copper.roughness = 0.4;
    materials.set("copper", copper);

    const carbon = new PBRMaterial("carbon", scene);
    carbon.albedoColor = new Color3(0.1, 0.1, 0.1);
    carbon.metallic = 1.0;
    carbon.roughness = 0.6;
    materials.set("carbon", carbon);

    return materials;
};
