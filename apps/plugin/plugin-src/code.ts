import { tailwindCodeGenTextStyles } from "./../../../packages/backend/src/tailwind/tailwindMain";
import {
  run,
  flutterMain,
  tailwindMain,
  swiftuiMain,
  convertIntoNodes,
  htmlMain,
  postSettingsChanged,
} from "backend";
import { retrieveGenericSolidUIColors } from "backend/src/common/retrieveUI/retrieveColors";
import { flutterCodeGenTextStyles } from "backend/src/flutter/flutterMain";
import { htmlCodeGenTextStyles } from "backend/src/html/htmlMain";
import { swiftUICodeGenTextStyles } from "backend/src/swiftui/swiftuiMain";
import { PluginSettings, SettingWillChangeMessage, SelectedDataRequestedMessage } from "types";

let userPluginSettings: PluginSettings;

export const defaultPluginSettings: PluginSettings = {
  framework: "HTML",
  jsx: false,
  optimizeLayout: true,
  showLayerNames: false,
  inlineStyle: true,
  responsiveRoot: false,
  flutterGenerationMode: "snippet",
  swiftUIGenerationMode: "snippet",
  roundTailwindValues: false,
  roundTailwindColors: false,
  customTailwindColors: false,
};

// A helper type guard to ensure the key belongs to the PluginSettings type
function isKeyOfPluginSettings(key: string): key is keyof PluginSettings {
  return key in defaultPluginSettings;
}

const getUserSettings = async () => {
  const possiblePluginSrcSettings =
    (await figma.clientStorage.getAsync("userPluginSettings")) ?? {};

  const updatedPluginSrcSettings = {
    ...defaultPluginSettings,
    ...Object.keys(defaultPluginSettings).reduce((validSettings, key) => {
      if (
        isKeyOfPluginSettings(key) &&
        key in possiblePluginSrcSettings &&
        typeof possiblePluginSrcSettings[key] ===
          typeof defaultPluginSettings[key]
      ) {
        validSettings[key] = possiblePluginSrcSettings[key] as any;
      }
      return validSettings;
    }, {} as Partial<PluginSettings>),
  };

  userPluginSettings = updatedPluginSrcSettings as PluginSettings;
};

const initSettings = async () => {
  await getUserSettings();
  postSettingsChanged(userPluginSettings);
  safeRun(userPluginSettings);
};

const safeRun = (settings: PluginSettings) => {
  try {
    run(settings);
  } catch (e) {
    if (e && typeof e === "object" && "message" in e) {
      const error = e as Error;
      console.log("error: ", error.stack);
      figma.ui.postMessage({ type: "error", error: error.message });
    }
  }
};


const findNodesWithImageFills = (root: SceneNode): SceneNode[] => {
  const result: SceneNode[] = [];

  function traverse(node: SceneNode) {
    if ('fills' in node && Array.isArray(node.fills)) {
      const hasImageFill = node.fills.some((f) => f.type === 'IMAGE');
      if (hasImageFill) {
        result.push(node);
      }
    }
    if ('children' in node) {
      for (const child of node.children) {
        traverse(child as SceneNode);
      }
    }
  }

  traverse(root);
  return result;
}

const standardMode = async () => {
  figma.showUI(__html__, { width: 450, height: 700, themeColors: true });
  await initSettings();

  // Listen for selection changes
  figma.on("selectionchange", () => {
    safeRun(userPluginSettings);
  });

  // Listen for document changes
  figma.on("documentchange", () => {
    safeRun(userPluginSettings);
  });

  figma.ui.onmessage = async (msg) => {
    console.log("[node] figma.ui.onmessage", msg);

    if (msg.type === "pluginSettingWillChange") {
      const { key, value } = msg as SettingWillChangeMessage<unknown>;
      (userPluginSettings as any)[key] = value;
      figma.clientStorage.setAsync("userPluginSettings", userPluginSettings);
      safeRun(userPluginSettings);
    }
    
    if (msg.type === "requestSelectedData") {
      const { operation, canvas_id, supabaseJWT } = msg as SelectedDataRequestedMessage;

      if (operation == "existing" && !canvas_id) {
        figma.ui.postMessage({ type: "error", error: "No canvas ID provided for existing canvas" });
      }
      // Collect selected node data
      const selection = figma.currentPage.selection;

      const frame = selection[0];

      const nodesWithImages = findNodesWithImageFills(frame);

      let uploadResults: Array<{ nodeId: string; url: string }> = [];
      for (const node of nodesWithImages) {
        const imageFills = (node.fills as Paint[]).filter(
          (fill) => fill.type === 'IMAGE'
        ) as ImagePaint[];
    
        for (const fill of imageFills) {
          if (!fill.imageHash) continue;
    
          const image = figma.getImageByHash(fill.imageHash);
          if (!image) continue;

          const bytes = await image.getBytesAsync();
          const base64 = figma.base64Encode(bytes);
      // Check file size (base64 string length * 0.75 gives approximate size in bytes)
      const fileSizeInMB = (base64.length * 0.75) / (1024 * 1024);
      console.log(`${node.id} File size: ${fileSizeInMB.toFixed(2)}MB`);
      if (fileSizeInMB > 5) {
        console.log(`Skipping ${node.id}: file size ${fileSizeInMB.toFixed(2)}MB exceeds 5MB limit`);
        continue;
      }

      const fileName = `node-${node.id}-${Date.now()}.png`;
      const response = await fetch("http://localhost:3001/imageUpload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseJWT}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ file: base64, fileName: `${fileName}` })
      });
          const { url: publicUrl } = await response.json();
    
          uploadResults.push({ nodeId: node.id, url: publicUrl });
        }
      }

      console.log("Image upload results:", uploadResults);
      
      const parseSelectedData = (nodeList: any) => {
        return nodeList.map((node: any) => {

          const data: any = {
            id: node.id,
            name: node.name,
            type: node.type,
            visible: node.visible,
            locked: node.locked,
            parent: node.parent?.id || null,
            x: node.x,
            y: node.y,
          };
    
          // Additional fields based on node type
          if (node.type === "TEXT") {
            const textNode = node as TextNode;
            Object.assign(data, {
              characters: textNode.characters,
              fontSize: textNode.fontSize,
              fontName: textNode.fontName,
              textAlignHorizontal: textNode.textAlignHorizontal,
              textAlignVertical: textNode.textAlignVertical,
              lineHeight: textNode.lineHeight,
              letterSpacing: textNode.letterSpacing,
              fills: textNode.fills,
            });
          } else if (node.type === "FRAME") {
            const frameNode = node as FrameNode;
            Object.assign(data, {
              id: node.id,
              children: frameNode.children.map((child) => child.id),
              layoutMode: frameNode.layoutMode,
              paddingLeft: frameNode.paddingLeft,
              paddingRight: frameNode.paddingRight,
              paddingTop: frameNode.paddingTop,
              paddingBottom: frameNode.paddingBottom,
              itemSpacing: frameNode.itemSpacing,
              fills: frameNode.fills,
              strokes: frameNode.strokes,
              cornerRadius: frameNode.cornerRadius,
            });
          } else if (node.type === "GROUP") {
            const groupNode = node as GroupNode;
            Object.assign(data, {
              id: node.id,
              children: parseSelectedData(groupNode.children),
            });
          } 
          return data;
        })

      }

      const selectedFrameName = selection[0].name;

      const pngData = await frame.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 1 }
      });

      const base64PNG = figma.base64Encode(pngData);

      try {
        const response = await fetch("http://localhost:3001/imageUpload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseJWT}`,
            "Content-Type": "application/json"

          },
          body: JSON.stringify({ file: base64PNG, fileName: `${selectedFrameName.replace(' ', '_').toLowerCase()}.png` })
        });
        const responseData = await response.json();
        console.log("Image upload response:", responseData);
        
        figma.ui.postMessage({
          type: "selectedDataResponse",
          name: selectedFrameName,
          url: responseData.url,
          figma_data: JSON.stringify(parseSelectedData(selection)),
          frame_images: JSON.stringify(uploadResults),
          operation,
          canvas_id
        });
      } catch (error) {
        console.error(error);
      }
    }

    if (msg.type === "auth") {

      // temporarily remove auth token caching for testing
      const user_auth = await figma.clientStorage.getAsync("auth_token");
      if (user_auth) {
        console.log("cached token found");
        figma.ui.postMessage({ type: "auth_token", user_auth });
        return;
      }

      const keysResponse = await fetch("http://localhost:3001/figma/auth/generateKeys");
      const { read_key, write_key } = await keysResponse.json();
      console.log("Keys:", read_key, write_key);
      figma.showUI(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>OAuth Login</title>
          </head>
          <body>
            <h1>Loading...</h1>
            <script>
              console.log("test")
              window.location.href = "http://localhost:3001/figma/auth/login?write_key=${write_key}";
            </script>
          </body>
        </html>
    `, { width: 400, height: 400 });

      const checkAuth = async () => {
        try {
          const response = await fetch(`http://localhost:3001/figma/auth/${read_key}`);
          const data = await response.json();
          console.log("Auth check response:", data);
          if (data.supabase_token && data.github_token) {
            
            const { github_token, supabase_token, user_id } = data;

            await figma.clientStorage.setAsync("auth_token", { github_token, supabase_token, user_id });

            console.log("Received token:", supabase_token);
            console.log("Received github token: ", github_token);
            console.log("Received user", user_id);

            figma.showUI(__html__, { width: 450, height: 700, themeColors: true })

            figma.ui.postMessage({ type: "auth_token", user_auth: { 
              supabase_token,
              github_token,
              user_id
            } });

            // figma.closePlugin();

            return;
          }
        } catch (error) {
          console.error("Auth check failed:", error);
        }
        
        setTimeout(checkAuth, 1000);
      };

      checkAuth();

    }

  };
};

const codegenMode = async () => {
  // figma.showUI(__html__, { visible: false });
  await getUserSettings();

  figma.codegen.on("generate", ({ language, node }) => {
    const convertedSelection = convertIntoNodes([node], null);

    switch (language) {
      case "html":
        return [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: false },
              true,
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(false),
            language: "HTML",
          },
        ];
      case "html_jsx":
        return [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: true },
              true,
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(true),
            language: "HTML",
          },
        ];
      case "tailwind":
      case "tailwind_jsx":
        return [
          {
            title: `Code`,
            code: tailwindMain(convertedSelection, {
              ...userPluginSettings,
              jsx: language === "tailwind_jsx",
            }),
            language: "HTML",
          },
          // {
          //   title: `Style`,
          //   code: tailwindMain(convertedSelection, defaultPluginSettings),
          //   language: "HTML",
          // },
          {
            title: `Tailwind Colors`,
            code: retrieveGenericSolidUIColors("Tailwind")
              .map((d) => {
                let str = `${d.hex};`;
                if (d.colorName !== d.hex) {
                  str += ` // ${d.colorName}`;
                }
                if (d.meta) {
                  str += ` (${d.meta})`;
                }
                return str;
              })
              .join("\n"),
            language: "JAVASCRIPT",
          },
          {
            title: `Text Styles`,
            code: tailwindCodeGenTextStyles(),
            language: "HTML",
          },
        ];
      case "flutter":
        return [
          {
            title: `Code`,
            code: flutterMain(convertedSelection, {
              ...userPluginSettings,
              flutterGenerationMode: "snippet",
            }),
            language: "SWIFT",
          },
          {
            title: `Text Styles`,
            code: flutterCodeGenTextStyles(),
            language: "SWIFT",
          },
        ];
      case "swiftUI":
        return [
          {
            title: `SwiftUI`,
            code: swiftuiMain(convertedSelection, {
              ...userPluginSettings,
              swiftUIGenerationMode: "snippet",
            }),
            language: "SWIFT",
          },
          {
            title: `Text Styles`,
            code: swiftUICodeGenTextStyles(),
            language: "SWIFT",
          },
        ];
      default:
        break;
    }

    const blocks: CodegenResult[] = [];
    return blocks;
  });
};

switch (figma.mode) {
  case "default":
  case "inspect":
    standardMode();
    break;
  case "codegen":
    codegenMode();
    break;
  default:
    break;
}


// const parseSelectedData = (nodeList: any) => {
      //   return nodeList.map((node: any) => {

      //     const data: any = {
      //       id: node.id,
      //       name: node.name,
      //       type: node.type,
      //       visible: node.visible,
      //       locked: node.locked,
      //       parent: node.parent?.id || null,
      //       x: node.x,
      //       y: node.y,
      //     };
    
      //     // Additional fields based on node type
      //     if (node.type === "TEXT") {
      //       const textNode = node as TextNode;
      //       Object.assign(data, {
      //         characters: textNode.characters,
      //         fontSize: textNode.fontSize,
      //         fontName: textNode.fontName,
      //         textAlignHorizontal: textNode.textAlignHorizontal,
      //         textAlignVertical: textNode.textAlignVertical,
      //         lineHeight: textNode.lineHeight,
      //         letterSpacing: textNode.letterSpacing,
      //         fills: textNode.fills,
      //       });
      //     } else if (node.type === "FRAME") {
      //       const frameNode = node as FrameNode;
      //       Object.assign(data, {
      //         children: frameNode.children.map((child) => child.id),
      //         layoutMode: frameNode.layoutMode,
      //         paddingLeft: frameNode.paddingLeft,
      //         paddingRight: frameNode.paddingRight,
      //         paddingTop: frameNode.paddingTop,
      //         paddingBottom: frameNode.paddingBottom,
      //         itemSpacing: frameNode.itemSpacing,
      //         fills: frameNode.fills,
      //         strokes: frameNode.strokes,
      //         cornerRadius: frameNode.cornerRadius,
      //       });
      //     } else if (node.type === "RECTANGLE") {
      //       const rectNode = node as RectangleNode;
      //       Object.assign(data, {
      //         width: rectNode.width,
      //         height: rectNode.height,
      //         cornerRadius: rectNode.cornerRadius,
      //         fills: rectNode.fills,
      //         strokes: rectNode.strokes,
      //         strokeWeight: rectNode.strokeWeight,
      //       });
      //     } else if (node.type === "ELLIPSE") {
      //       const ellipseNode = node as EllipseNode;
      //       Object.assign(data, {
      //         width: ellipseNode.width,
      //         height: ellipseNode.height,
      //         fills: ellipseNode.fills,
      //         strokes: ellipseNode.strokes,
      //         strokeWeight: ellipseNode.strokeWeight,
      //         arcData: ellipseNode.arcData,
      //       });
      //     } else if (node.type === "GROUP") {
      //       const groupNode = node as GroupNode;
      //       Object.assign(data, {
      //         children: parseSelectedData(groupNode.children),
      //       });
      //     } else if (node.type === "LINE") {
      //       const lineNode = node as LineNode;
      //       Object.assign(data, {
      //         width: lineNode.width,
      //         strokes: lineNode.strokes,
      //         strokeWeight: lineNode.strokeWeight,
      //       });
      //     } else if (node.type === "VECTOR") {
      //       const vectorNode = node as VectorNode;
      //       Object.assign(data, {
      //         vectorPaths: vectorNode.vectorPaths,
      //         fills: vectorNode.fills,
      //         strokes: vectorNode.strokes,
      //         strokeWeight: vectorNode.strokeWeight,
      //       });
      //     }
    
      //     return data;
      //   })

      // }


