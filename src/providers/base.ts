import type { Message } from "../config/types.js";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatProvider {
  readonly name: string;
  chat(messages: Message[], tools: ToolDefinition[]): Promise<Message>;
}
