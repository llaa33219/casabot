import type { ProviderConfig } from "../config/types.js";
import type { ChatProvider } from "./base.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";

export function createCustomProvider(config: ProviderConfig): ChatProvider {
  if (config.type === "custom-anthropic") {
    return new AnthropicProvider(config);
  }
  return new OpenAIProvider(config);
}
