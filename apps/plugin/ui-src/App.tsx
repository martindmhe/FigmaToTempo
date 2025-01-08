import { useEffect, useState, useRef } from "react";
import { PluginUI } from "plugin-ui";
import {
  Framework,
  PluginSettings,
  ConversionMessage,
  Message,
  HTMLPreview,
  LinearGradientConversion,
  SolidColorConversion,
  ErrorMessage,
  SettingsChangedMessage,
  RequestSelectedDataMessage,
  Warning,
} from "types";
import { postUISettingsChangingMessage, triggerOpenTempo } from "./messaging";
import callOpenAI from "../../../packages/backend/src/ai/openai";
import { c } from "vite/dist/node/types.d-aGj9QkWt";

interface AppState {
  code: string;
  selectedFramework: Framework;
  isLoading: boolean;
  htmlPreview: HTMLPreview;
  settings: PluginSettings | null;
  colors: SolidColorConversion[];
  gradients: LinearGradientConversion[];
  warnings: Warning[];
}

const emptyPreview = { size: { width: 0, height: 0 }, content: "" };

const returnEditedCode = async (code: string) => {
  const response = await callOpenAI(`${code}, This code was generated from Figma. Please refactor it to be production-ready, ensuring best practices are followed, and return only the updated code in plain text format. Do not include explanations, comments, or markdown.`)
  return response.replace(/```[a-z]*\n?|\n?```/g, '')
}

export default function App() {
  const [state, setState] = useState<AppState>({
    code: "",
    selectedFramework: "HTML",
    isLoading: false,
    htmlPreview: emptyPreview,
    settings: null,
    colors: [],
    gradients: [],
    warnings: [],
  });

  const rootStyles = getComputedStyle(document.documentElement);
  const figmaColorBgValue = rootStyles
    .getPropertyValue("--figma-color-bg")
    .trim();

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const untypedMessage = event.data.pluginMessage as Message;
      console.log("[ui] message received:", untypedMessage);

      switch (untypedMessage.type) {
        case "code":
          const conversionMessage = untypedMessage as ConversionMessage;
          setState((prevState) => ({
            ...prevState,
            ...conversionMessage,
            selectedFramework: conversionMessage.settings.framework,
          }));
          break;

        case "pluginSettingChanged":
          const settingsMessage = untypedMessage as SettingsChangedMessage;
          setState((prevState) => ({
            ...prevState,
            settings: settingsMessage.settings,
            selectedFramework: settingsMessage.settings.framework,
          }));
          break;

        case "selectedDataResponse":
          const selectedData = untypedMessage as RequestSelectedDataMessage;
          const context = selectedData.data ?? "{}";
          const { url } = selectedData;

          console.log(url)

          setState((prevState) => {
            console.log(prevState.code);
            // handleOpenTempo(context, prevState.code);
            return prevState;
          });

          break;

        case "empty":
          // const emptyMessage = untypedMessage as EmptyMessage;
          setState((prevState) => ({
            ...prevState,
            code: "",
            htmlPreview: emptyPreview,
            warnings: [],
            colors: [],
            gradients: [],
          }));
          break;

        case "error":
          const errorMessage = untypedMessage as ErrorMessage;

          setState((prevState) => ({
            ...prevState,
            colors: [],
            gradients: [],
            code: `Error :(\n// ${errorMessage.error}`,
          }));
          break;
        default:
          break;
      }
    };

    return () => {
      window.onmessage = null;
    };
  }, []);

  useEffect(() => {
    if (state.selectedFramework === null) {
      const timer = setTimeout(
        () => setState((prevState) => ({ ...prevState, isLoading: true })),
        300,
      );
      return () => clearTimeout(timer);
    } else {
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }
  }, [state.selectedFramework]);

  if (state.selectedFramework === null) {
    return state.isLoading ? (
      <div className="w-full h-96 justify-center text-center items-center dark:text-white text-lg">
        Loading Plugin...
      </div>
    ) : null;
  }

  const handleFrameworkChange = (updatedFramework: Framework) => {
    setState((prevState) => ({
      ...prevState,
      // code: "// Loading...",
      selectedFramework: updatedFramework,
    }));
    postUISettingsChangingMessage("framework", updatedFramework, {
      targetOrigin: "*",
    });
  };
  // console.log("state.code", state.code.slice(0, 25));

  const handleOpenTempo = async (context: string, code: string) => {

    if (context) {
      const response = await fetch('http://localhost:3001/figma/storeContext', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          figma_context: context,
          initial_code: code,
          user_id: "12345",
        }
        ),
      })
  
      const jsonResponse = await response.json();
      const id = jsonResponse[0].id;
  
      // temporarily hardcoding values
      const base_url = `http://localhost:3050/canvases/c876fb21-bbd7-4a69-9f63-c08760697502/editor`
  
      window.open(`${base_url}?figmaContextId=${id}`, '_blank');
    }
  }

  return (
    <div className={`${figmaColorBgValue === "#ffffff" ? "" : "dark"}`}>
      <PluginUI
        code={state.code}
        warnings={state.warnings}
        selectedFramework={state.selectedFramework}
        setSelectedFramework={handleFrameworkChange}
        htmlPreview={state.htmlPreview}
        settings={state.settings}
        onPreferenceChanged={(key: string, value: boolean | string) =>
          postUISettingsChangingMessage(key, value, { targetOrigin: "*" })
        }
        colors={state.colors}
        gradients={state.gradients}
        openTempo={triggerOpenTempo}
      />
    </div>
  );
}
