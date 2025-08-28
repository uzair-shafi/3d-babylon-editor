import { useControls, button } from "leva";
import { useRef, useEffect } from "react";

export const useEditorControls = (
  handleExportScene: () => void,
  handleImportScene: (file: File) => void,
  handleClearSelection: () => void
) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";
    input.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        handleImportScene(file);
      }
    });

    document.body.appendChild(input);
    fileInputRef.current = input;

    return () => {
      document.body.removeChild(input);
    };
  }, [handleImportScene]);
  const controls = useControls("Editor Controls", {
    Model: {
      options: [
        "None",
        "wall.glb",
        "frame1.glb",
        "table1.glb",
        "table2.glb",
        "chair1.glb",
        "chair2.glb",
        "chair3.glb",
        "vase1.glb",
        "vase2.glb",
        "vase3.glb",
      ],
      value: "None",
    },
    Texture: {
      options: ["None", "monalisa.jpg", "scene.jpg"],
      value: "None",
    },
    Material: {
      options: ["gold", "silver", "copper", "carbon"],
      value: "select material",
    },
    Color: { value: "#00aaff" },
    "Clear Selection": button(() => {
      handleClearSelection();
    }),
    "Export Scene": button(() => {
      handleExportScene();
    }),
    "Import Scene": button(() => {
      fileInputRef.current?.click();
    }),
  });

  const instructions = useControls("Instructions", {
    " ": {
      value:
        "• Select models from dropdown\n\n• Single right mouse click to select object part\n\n• Right mouse click with CTRL key to select whole object\n\n• Double click anywhere on empty canvas to clear selection\n\n• Select whole object with right mouse clcik and CTRL key and then select any same category object to replace with\n\n• Left mouse clcik on any object to duplicate or remove object menu\n\n• Refresh the page before importing scene",
      disabled: false,
      multiline: false,
      rows: 30,
    },
  });
  return {
    ...controls,
  };
};
