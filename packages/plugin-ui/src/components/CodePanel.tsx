import {
  Framework,
  LocalCodegenPreferenceOptions,
  PluginSettings,
  SelectPreferenceOptions,
  Canvas
} from "types";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark as theme } from "react-syntax-highlighter/dist/esm/styles/prism";
import copy from "copy-to-clipboard";
import SelectableToggle from "./SelectableToggle";

interface CodePanelProps {
  code: string;
  selectedFramework: Framework;
  settings: PluginSettings | null;
  preferenceOptions: LocalCodegenPreferenceOptions[];
  selectPreferenceOptions: SelectPreferenceOptions[];
  onPreferenceChanged: (key: string, value: boolean | string) => void;
  openTempo: (operation: "new" | "existing", canvas_id?: string) => void;
  // userCanvases: Canvas[];
  projects: any[];
  canvases: any[];
}

const CodePanel = (props: CodePanelProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filteredCanvases, setFilteredCanvases] = useState<any[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const [syntaxHovered, setSyntaxHovered] = useState(false);
  const [isCanvasDropdownOpen, setIsCanvasDropdownOpen] = useState(false);
  const {
    code,
    preferenceOptions,
    selectPreferenceOptions,
    selectedFramework,
    settings,
    onPreferenceChanged,
  } = props;
  const isEmpty = code === "";

  // Add your clipboard function here or any other actions
  const handleButtonClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 250);
    copy(code);
  };

  const handleButtonHover = () => setSyntaxHovered(true);
  const handleButtonLeave = () => setSyntaxHovered(false);

  const selectableSettingsFiltered = selectPreferenceOptions.filter(
    (preference) =>
      preference.includedLanguages?.includes(props.selectedFramework),
  );

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    // setFilteredCanvases(props.filterCanvasesByProject(projectId));
    setIsCanvasDropdownOpen(true);
    setFilteredCanvases(props.canvases.filter((canvas) => canvas.project_id === projectId));
  };

  return (
    <div className="w-full flex flex-col gap-2 mt-2">
      {/* <div className="flex items-center justify-between w-full">
        <p className="text-lg font-medium text-center dark:text-white rounded-lg">
          Code
        </p>
        {isEmpty === false && (
          <>
            <button
              className={`px-4 py-1 text-sm font-semibold border border-green-500 rounded-md shadow-sm hover:bg-green-500 dark:hover:bg-green-600 hover:text-white hover:border-transparent transition-all duration-300 ${
                isPressed
                  ? "bg-green-500 dark:text-white hover:bg-green-500 ring-4 ring-green-300 ring-opacity-50 animate-pulse"
                  : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600"
              }`}
              onClick={handleButtonClick}
              onMouseEnter={handleButtonHover}
              onMouseLeave={handleButtonLeave}
            >
              Copy
            </button>
          </>
        )}
      </div> */}
      {isEmpty === false && (
        <div className="flex items-center gap-4 w-full">
          <div className="flex flex-col gap-2 relative">
            <select
              className="px-4 py-1 text-sm text-white bg-neutral-700 font-semibold border border-green-500 rounded-md shadow-sm"
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              <option value="">Choose Existing Project</option>
              {props.projects.map((project) => (
                <option key={project.project_id} value={project.project_id}>
                  {project.title ?? "Untitled Project"}
                </option>
              ))}
            </select>
            
          </div>
          <button
            className={`px-4 py-1 text-sm font-semibold border border-green-500 rounded-md shadow-sm hover:bg-green-500 dark:hover:bg-green-600 hover:text-white hover:border-transparent transition-all duration-300 ${
              isPressed
                ? "bg-green-500 dark:text-white hover:bg-green-500 ring-4 ring-green-300 ring-opacity-50 animate-pulse"
                : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600"
            }`}
            onClick={() => props.openTempo("new")}
            onMouseEnter={handleButtonHover}
            onMouseLeave={handleButtonLeave}
          >
            Open in new Tempo app
          </button>
        </div>
      )}

      {selectedProject && (
        <div className="w-full h-20 overflow-scroll scrollbar-hide" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <p>Open in canvas:</p>
          {filteredCanvases.map((canvas, idx) => (
        <button onClick={() => props.openTempo("existing", canvas.canvas_id)}>{canvas.name}</button>
          ))}
        </div>
      )}


      <div
        className={`rounded-lg ring-green-600 transition-all duratio overflow-clip ${
          syntaxHovered ? "ring-2" : "ring-0"
        }`}
      >
        {isEmpty ? (
          <h3>No layer is selected. Please select a layer.</h3>
        ) : (
          <SyntaxHighlighter
            language="dart"
            style={theme}
            customStyle={{
              fontSize: 12,
              borderRadius: 8,
              marginTop: 0,
              marginBottom: 0,
              backgroundColor: syntaxHovered ? "#1E2B1A" : "#1B1B1B",
              transitionProperty: "all",
              transitionTimingFunction: "ease",
              transitionDuration: "0.2s",
            }}
          >
            {code}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};
export default CodePanel;
