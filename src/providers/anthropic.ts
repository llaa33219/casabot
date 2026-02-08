import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { Message, ProviderConfig } from "../config/types.js";
import type { ChatProvider, ToolDefinition } from "./base.js";

function toAnthropicMessages(messages: Message[]): { system: string; msgs: MessageParam[] } {
  let system = "";
  const msgs: MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system += (system ? "\n\n" : "") + msg.content;
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls?.length) {
      const content: Anthropic.ContentBlockParam[] = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: JSON.parse(tc.arguments),
        });
      }
      msgs.push({ role: "assistant", content });
      continue;
    }

    if (msg.role === "tool") {
      msgs.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId!,
            content: msg.content,
          },
        ],
      });
      continue;
    }

    msgs.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  return { system, msgs };
}

function toAnthropicTools(tools: ToolDefinition[]): Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Tool["input_schema"],
  }));
}

export class AnthropicProvider implements ChatProvider {
  readonly name: string;
  private client: Anthropic;
  private model: string;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.model = config.model;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.endpoint ? { baseURL: config.endpoint } : {}),
    });
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<Message> {
    const { system, msgs } = toAnthropicMessages(messages);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: msgs,
      ...(tools.length > 0 ? { tools: toAnthropicTools(tools) } : {}),
    });

    let textContent = "";
    const toolCalls: Message["toolCalls"] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    const result: Message = {
      role: "assistant",
      content: textContent,
    };

    if (toolCalls.length > 0) {
      result.toolCalls = toolCalls;
    }

    return result;
  }
}
