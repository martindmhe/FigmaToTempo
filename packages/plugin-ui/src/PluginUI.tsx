import { useState } from "react";
import copy from "copy-to-clipboard";
import Preview from "./components/Preview";
import GradientsPanel from "./components/GradientsPanel";
import ColorsPanel from "./components/ColorsPanel";
import WarningIcon from "./components/WarningIcon";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark as theme } from "react-syntax-highlighter/dist/esm/styles/prism";
import SelectableToggle from "./components/SelectableToggle";
import {
  Framework,
  HTMLPreview,
  LinearGradientConversion,
  PluginSettings,
  SolidColorConversion,
  Warning,
  Canvas
} from "types";
import {
  preferenceOptions,
  selectPreferenceOptions,
} from "./codegenPreferenceOptions";

type PluginUIProps = {
  code: string;
  htmlPreview: HTMLPreview;
  warnings: Warning[];
  selectedFramework: Framework;
  setSelectedFramework: (framework: Framework) => void;
  settings: PluginSettings | null;
  onPreferenceChanged: (key: string, value: boolean | string) => void;
  colors: SolidColorConversion[];
  gradients: LinearGradientConversion[];
  openTempo: (operation: "new" | "existing", canvas_id?: string) => void;
  projects: any[];
  canvases: any[];
};

const frameworks: Framework[] = ["HTML", "Tailwind", "Flutter", "SwiftUI"];

export const PluginUI = (props: PluginUIProps) => {
  const [isResponsiveExpanded, setIsResponsiveExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filteredCanvases, setFilteredCanvases] = useState<Canvas[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const [syntaxHovered, setSyntaxHovered] = useState(false);
  const [isCanvasDropdownOpen, setIsCanvasDropdownOpen] = useState(false);
  const isEmpty = props.code === "";

  const warnings = props.warnings ?? [];

  const handleButtonClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 250);
    copy(props.code);
  };

  const handleButtonHover = () => setSyntaxHovered(true);
  const handleButtonLeave = () => setSyntaxHovered(false);

  const selectableSettingsFiltered = selectPreferenceOptions.filter(
    (preference) =>
      preference.includedLanguages?.includes(props.selectedFramework),
  );

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setIsCanvasDropdownOpen(true);
    setFilteredCanvases(props.canvases.filter((canvas) => canvas.project_id === projectId));
  };

  return (
    <div className="flex flex-col h-full dark:text-white">
      <div className="p-2 grid grid-cols-4 sm:grid-cols-2 md:grid-cols-4 gap-1">
      </div>
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex flex-col items-center px-4 py-2 gap-2 dark:bg-transparent">
          {isEmpty === false && props.htmlPreview && (
            <Preview
              htmlPreview={props.htmlPreview}
              isResponsiveExpanded={isResponsiveExpanded}
              setIsResponsiveExpanded={setIsResponsiveExpanded}
            />
          )}
         
          <div className="w-full flex flex-col gap-2 mt-2">
            {isEmpty === false && (
              <div className="flex items-center gap-4 w-full">
                <div className="flex flex-col gap-2 relative">
                  <select
                    className="px-4 py-1 text-sm text-white bg-neutral-700 font-semibold border border-green-500 rounded-md shadow-sm"
                    onChange={(e) => handleProjectChange(e.target.value)}
                  >
                    <option value="" disabled selected>
                      Choose Existing Project
                    </option>
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
              <div className="w-full h-20 overflow-scroll">
                <p>Open in canvas:</p>
                {filteredCanvases.map((canvas, idx) => (
                  <button onClick={() => props.openTempo("existing", canvas.canvas_id)}>{canvas.name}</button>
                ))}
              </div>
            )}

            {/* {isEmpty === false && (
              <div className="flex gap-2 justify-center flex-col p-2 dark:bg-black dark:bg-opacity-25 bg-neutral-100 ring-1 ring-neutral-200 dark:ring-neutral-700 rounded-lg text-sm">
                <div className="flex gap-2 items-center flex-wrap">
                  {preferenceOptions
                    .filter((preference) =>
                      preference.includedLanguages?.includes(props.selectedFramework),
                    )
                    .map((preference) => (
                      <SelectableToggle
                        key={preference.propertyName}
                        title={preference.label}
                        description={preference.description}
                        isSelected={
                          props.settings?.[preference.propertyName] ?? preference.isDefault
                        }
                        onSelect={(value) => {
                          props.onPreferenceChanged(preference.propertyName, value);
                        }}
                        buttonClass="bg-green-100 dark:bg-black dark:ring-green-800 ring-green-500"
                        checkClass="bg-green-400 dark:bg-black dark:bg-green-500 dark:border-green-500 ring-green-300 border-green-400"
                      />
                    ))}
                </div>
                {selectableSettingsFiltered.length > 0 && (
                  <>
                    <div className="w-full h-px bg-neutral-200 dark:bg-neutral-700" />

                    <div className="flex gap-2 items-center flex-wrap">
                      {selectableSettingsFiltered.map((preference) => (
                        <>
                          {preference.options.map((option) => (
                            <SelectableToggle
                              key={option.label}
                              title={option.label}
                              isSelected={
                                option.value ===
                                (props.settings?.[preference.propertyName] ??
                                  option.isDefault)
                              }
                              onSelect={() => {
                                props.onPreferenceChanged(
                                  preference.propertyName,
                                  option.value,
                                );
                              }}
                              buttonClass="bg-blue-100 dark:bg-black dark:ring-blue-800"
                              checkClass="bg-blue-400 dark:bg-black dark:bg-blue-500 dark:border-blue-500 ring-blue-300 border-blue-400"
                            />
                          ))}
                        </>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )} */}

            <div
              className={`rounded-lg ring-green-600 transition-all duratio overflow-clip ${
                syntaxHovered ? "ring-2" : "ring-0"
              }`}
            >
              {isEmpty ? (
                <h3>No layer is selected. Please select a layer.</h3>
              ) : ( <></>
                // <SyntaxHighlighter
                //   language="dart"
                //   style={theme}
                //   customStyle={{
                //     fontSize: 12,
                //     borderRadius: 8,
                //     marginTop: 0,
                //     marginBottom: 0,
                //     backgroundColor: syntaxHovered ? "#1E2B1A" : "#1B1B1B",
                //     transitionProperty: "all",
                //     transitionTimingFunction: "ease",
                //     transitionDuration: "0.2s",
                //   }}
                // >
                //   {props.code}
                // </SyntaxHighlighter>
              )}
            </div>
          </div>

          {/* {props.colors.length > 0 && (
            <ColorsPanel
              colors={props.colors}
              onColorClick={(value) => {
                copy(value);
              }}
            />
          )}

          {props.gradients.length > 0 && (
            <GradientsPanel
              gradients={props.gradients}
              onColorClick={(value) => {
                copy(value);
              }}
            />
          )} */}
        </div>
      </div>
    </div>
  );
};
