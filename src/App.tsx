import { BabylonCanvas } from './components/BabylonCanvas';
import { useEditorControls } from './components/UIControls';

function App() {
  const handleExportScene = () => {
    console.log("Exporting...");
  };
  const handleImportScene = (file: File) => {
    console.log("Importing...");
  };
  const handleClearSelection = () => {
    console.log("Clearing...");
  };
  const {
    Color,
    Material,
    Model,
    Texture,

  } = useEditorControls(handleExportScene, handleImportScene, handleClearSelection);

  return (
    <BabylonCanvas
      boxColor={Color}
      materialName={Material}
      selectedModel={Model}
      textureName={Texture}
    />

  );
}

export default App;
