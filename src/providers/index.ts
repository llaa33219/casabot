import type { ProviderConfig } from "../config/types.js";
import type { ChatProvider } from "./base.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenRouterProvider } from "./openrouter.js";
import { HuggingFaceProvider } from "./huggingface.js";
import { createCustomProvider } from "./custom.js";

export type { ChatProvider, ToolDefinition } from "./base.js";

export function createProvider(config: ProviderConfig): ChatProvider {
  switch (config.type) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "openrouter":
      return new OpenRouterProvider(config);
    case "huggingface":
      return new HuggingFaceProvider(config);
    case "custom-openai":
    case "custom-anthropic":
      return createCustomProvider(config);
    default: {
      const exhaustive: never = config.type;
      throw new Error(`Unknown provider type: ${exhaustive}`);
    }
  }
}
