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
  Canvas
} from "types";
import { postUISettingsChangingMessage, triggerOpenTempo } from "./messaging";
import callOpenAI from "../../../packages/backend/src/ai/openai";
import axios from "axios";
import { SupabaseClient, createClient } from "@supabase/supabase-js";


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
  const [authTokens, setAuthTokens] = useState<AuthTokens | null>(null);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(
    null
  );

  const [canvases, setCanvases] = useState<any[]>([]);

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
          .from("canvases")
          .select(`
            *,
            projects:project_id (
              name
            )
          `)
          .eq("owner_user_id", authTokens.user_id)
          .eq("env", "DEV");

        if (error) {
          console.error("Error fetching canvases:", error);
        }

        if (data) {
          const canvasesWithProjectNames = data.map(canvas => ({
            ...canvas,
            project_name: canvas.projects?.name
          }));
          setCanvases(canvasesWithProjectNames);
          console.log("canvases:", canvasesWithProjectNames);
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
              addFigmaToExistingProject(url, prevState.code, selectedData.canvas_id);
              return prevState;
            }

            addFigmaToNewProject(url, prevState.code, name);

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

  const addFigmaToExistingProject = async (image_url: string, code: string, canvas_id: string, context: string = "") => {

      console.log(image_url, code, context)

      const response = await fetch('http://localhost:3001/figma/storeContext', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          figma_context: context,
          initial_code: code,
          user_id: authTokens?.user_id,
          image_url: image_url
        }
        ),
      })
  
      const jsonResponse = await response.json();
      const id = jsonResponse[0].id;
  
      // temporarily hardcoding values
      const url = `http://localhost:3050/canvases/${canvas_id}/editor`
  
      window.open(`${url}?figmaContextId=${id}`, '_blank');

  }

  const addFigmaToNewProject = async (image_url: string, code: string, name: string, context: string = "") => {
    console.log(image_url, code, context)

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

    console.log('figma_context:', context);
    console.log('initial_code:', code);
    console.log('image_url:', image_url);


      const storeContextResponse = await fetch('http://localhost:3001/figma/storeContext', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          figma_context: context,
          initial_code: code,
          component_name: name,
          user_id: "123456789",
          image_url: image_url
        }),
      })

      const jsonResponse = await storeContextResponse.json();  
      const id = jsonResponse[0].id;
  
      // temporarily hardcoding values
      const base_url = `http://localhost:3050/canvases/${canvas.id}/editor`
  
      window.open(`${base_url}?figmaContextId=${id}`, '_blank');
  }

  if (authTokens) {

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
          userCanvases={canvases.map((canvas) => ({canvas_id: canvas.id, project_name: canvas.project_name}))}
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
