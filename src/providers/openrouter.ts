import type { ProviderConfig } from "../config/types.js";
import { OpenAIProvider } from "./openai.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config, OPENROUTER_BASE_URL);
  }
}
