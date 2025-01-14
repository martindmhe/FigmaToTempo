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
  ReturnSelectedDataMessage,
  AuthMessage,
  Warning,
  Canvas,
  Project
} from "types";
import { postUISettingsChangingMessage, triggerOpenTempo } from "./messaging";
import axios from "axios";
import { SupabaseClient, createClient } from "@supabase/supabase-js";

import { ParentNode } from "types";


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

interface AuthTokens {
  supabase_token: string;
  github_token: string;
  user_id: string;
}

const emptyPreview = { size: { width: 0, height: 0 }, content: "" };


const processFigmaData = (figmaData: ParentNode) => {
  const processNode = (node: any, indent: string = ''): string => {
    let result = `${indent}<${node.type}`;
    
    // Add attributes
    if (node.id) result += ` id="${node.id}"`;
    if (node.name) result += ` name="${node.name}"`;
    
    // Handle children
    if (node.children && node.children.length > 0) {
      result += '>\n';
      result += node.children.map(child => processNode(child, indent + '  ')).join('\n');
      result += `\n${indent}</${node.type}>`;
    } else {
      result += ' />';
    }
    
    return result;
  };

  return processNode(figmaData);
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
  const [authTokens, setAuthTokens] = useState<AuthTokens | null>(null);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(
    null
  );

  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // temp wrapper function to avoid prop drilling supabase JWT
  const tempTriggerOpenTempoWrapper = (supabaseJWT: string) => {
    return (operation: "new" | "existing", canvas_id?: string) => {
      triggerOpenTempo(operation, supabaseJWT, canvas_id);
    }
  }
  
  useEffect(() => {
    const supabaseJWT = authTokens?.supabase_token;

    if (supabaseJWT && !supabaseClient) {
      const supabase: SupabaseClient = createClient(
        "https://bzcxxroyylqcbnrgyxhx.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6Y3h4cm95eWxxY2Jucmd5eGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM3Mjg5MTEsImV4cCI6MjA0OTMwNDkxMX0.P6eCMFLf2HsWyN9H8ssvWXKnpxz-6zXK00rYp4ERZ8Q",
        {
          global: {
            headers: {
              Authorization: `Bearer ${supabaseJWT}`,
            },
          },
        }
      );

      // Need to set this as well
      supabase.realtime.setAuth(supabaseJWT);

      setSupabaseClient(supabase);
    }
  }, [authTokens]);

  useEffect(() => {
    console.log("attempting to fetch canvases")
    console.log(authTokens)
    console.log(supabaseClient)
    if (authTokens && supabaseClient) {
      const fetchCanvases = async () => {
        const { data, error } = await supabaseClient
          .from("project_canvas_mappings")
          .select("*")
          .eq("owner_user_id", authTokens.user_id)
          .eq("env", "DEV");

        if (error) {
          console.error("Error fetching canvases:", error);
        }

        if (data) {
          console.log(data)
          setProjects(data.map((mapping) => ({
              project_id: mapping.project_id,
              title: mapping.title,
            })));

          setCanvases(data.map((mapping) => ({
            project_id: mapping.project_id,
            canvas_id: mapping.canvas_id,
            name: mapping.name,
          })))
        }
      };

      fetchCanvases();
    }
  }, [authTokens, supabaseClient]);

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
          console.log("selectedDataResponse", untypedMessage);
          const selectedData = untypedMessage as ReturnSelectedDataMessage;
          const name = selectedData.name;
          const operation = selectedData.operation;
          const { url } = selectedData;

          setState((prevState) => {
            if (operation === "existing") {
              if (!selectedData.canvas_id) {
                console.error("canvas_id is missing from selectedData");
                return prevState;
              }
              addFigmaToExistingProject(url, prevState.code, selectedData.canvas_id, selectedData.figma_data, selectedData.frame_images);
              return prevState;
            }

            addFigmaToNewProject(url, prevState.code, name, selectedData.figma_data, selectedData.frame_images);

            return prevState;
          });

          break;
        
        case "auth_token":
          const authData = untypedMessage as AuthMessage;
          console.log("authenticated: ", authData)
          if (authData.user_auth) {
            console.log("setting auth token")
            setAuthTokens(authData.user_auth);
          } else {
            setAuthTokens(null);
          }

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
  }, [authTokens]);

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

  useEffect(() => {
    console.log("tokens updated:", authTokens);
  }, [authTokens]);

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

  const addFigmaToExistingProject = async (image_url: string, code: string, canvas_id: string, figma_data: string, frame_images: string) => {


      if (!authTokens) {
        console.error("Authorization tokens are missing");
        return;
      }
      console.log(image_url, code, figma_data)

      const response = await fetch('http://localhost:3001/figma/context', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authTokens.supabase_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          figma_context: figma_data,
          initial_code: code,
          user_id: authTokens?.user_id,
          image_url: image_url,
          frame_images: frame_images
        }
        ),
      })
  
      const jsonResponse = await response.json();
      const id = jsonResponse[0].id;
  
      // temporarily hardcoding values
      const url = `http://localhost:3050/canvases/${canvas_id}/editor`
  
      window.open(`${url}?figmaContextId=${id}`, '_blank');

  }

  const addFigmaToNewProject = async (image_url: string, code: string, name: string, figma_data: string, frame_images: string) => {

    if (!authTokens) {
      console.error("Authorization tokens are missing");
      return;
    }

    const createProjectResponse = await axios.post('http://localhost:3001/figma/addToNew', { 
      github_token: authTokens.github_token,
      component_name: name.replace(" ", "_").toLowerCase(),
    }, {
      headers: {
        Authorization: `Bearer ${authTokens.supabase_token}`,
      },
    }) as any;

    const { project, canvas } = createProjectResponse.data;

    console.log('figma_context:', figma_data);
    console.log('initial_code:', code);
    console.log('image_url:', image_url);


      const storeContextResponse = await fetch('http://localhost:3001/figma/context', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authTokens.supabase_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          figma_context: figma_data,
          initial_code: code,
          component_name: name,
          image_url: image_url,
          frame_images: frame_images,
        }),
      })

      const jsonResponse = await storeContextResponse.json();  
      const id = jsonResponse[0].id;
  
      // temporarily hardcoding values
      const base_url = `http://localhost:3050/canvases/${canvas.id}/editor`
  
      window.open(`${base_url}?figmaContextId=${id}`, '_blank');
  }

  const filterCanvasesByProject = (projectId: string) => {
    return canvases.filter((canvas) => canvas.project_id === projectId);
  };

  if (authTokens) {

    return (
      <div className={`${figmaColorBgValue === "#ffffff" ? "" : "dark"}`}>
        <PluginUI
          code={state.code}
          warnings={[]}
          selectedFramework={"Tailwind"}
          setSelectedFramework={() => {}}
          htmlPreview={state.htmlPreview}
          settings={state.settings}
          onPreferenceChanged={(key: string, value: boolean | string) =>
            postUISettingsChangingMessage(key, value, { targetOrigin: "*" })
          }
          colors={state.colors}
          gradients={state.gradients}
          openTempo={tempTriggerOpenTempoWrapper(authTokens.supabase_token)}
          projects={projects}
          canvases={canvases}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full h-full items-center justify-center">
      <button className=" text-white" onClick={() => {
        parent.postMessage({ pluginMessage: { type: "auth" } }, '*');
      }}>
        Login To Tempo
      </button>
    </div>
  )

}
