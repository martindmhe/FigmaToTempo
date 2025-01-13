import { Message, SettingWillChangeMessage, SelectedDataRequestedMessage, UIMessage } from "types";

if (!parent || !parent.postMessage) {
  throw new Error("parent.postMessage() is not defined");
}
const postMessage = (message: UIMessage, options?: WindowPostMessageOptions) =>
  parent.postMessage(message, options);

export const postUIMessage = (
  message: Message,
  options?: WindowPostMessageOptions,
) => postMessage({ pluginMessage: message }, options);

export const postUISettingsChangingMessage = <T>(
  key: string,
  value: T,
  options?: WindowPostMessageOptions,
) => {
  const message: SettingWillChangeMessage<T> = {
    type: "pluginSettingWillChange",
    key,
    value,
  };
  postUIMessage(message, options);
};

export const triggerOpenTempo = (operation: "new" | "existing", supabaseJWT: string, canvas_id?:string, options?: WindowPostMessageOptions) => {
  // fetch necessary selected data as context
  const message: SelectedDataRequestedMessage = {
    type: "requestSelectedData",
    operation,
    supabaseJWT,
    canvas_id
  };
  parent.postMessage({pluginMessage: message}, "*");
};
