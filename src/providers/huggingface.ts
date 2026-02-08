import type { ProviderConfig } from "../config/types.js";
import { OpenAIProvider } from "./openai.js";

const HUGGINGFACE_BASE_URL = "https://api-inference.huggingface.co/v1";

export class HuggingFaceProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config, HUGGINGFACE_BASE_URL);
  }
}
