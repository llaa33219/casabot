export type ProviderType =
  | "openai"
  | "anthropic"
  | "huggingface"
  | "openrouter"
  | "custom-openai"
  | "custom-anthropic";

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  apiKey: string;
  endpoint?: string;
  model: string;
  isDefault: boolean;
}

export interface CasabotConfig {
  providers: ProviderConfig[];
  activeProvider: string;
  baseModel: string;
}

export interface Skill {
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  instructions: string;
  path: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ConversationHistory {
  id: string;
  startedAt: string;
  messages: Message[];
}
