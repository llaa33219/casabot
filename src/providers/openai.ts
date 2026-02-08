import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionMessageFunctionToolCall, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Message, ProviderConfig } from "../config/types.js";
import type { ChatProvider, ToolDefinition } from "./base.js";

function toOpenAIMessages(messages: Message[]): ChatCompletionMessageParam[] {
  return messages.map((msg): ChatCompletionMessageParam => {
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: msg.content,
        tool_call_id: msg.toolCallId!,
      };
    }
    if (msg.role === "assistant" && msg.toolCalls?.length) {
      return {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return {
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    };
  });
}

function toOpenAITools(tools: ToolDefinition[]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export class OpenAIProvider implements ChatProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;

  constructor(config: ProviderConfig, baseURL?: string) {
    this.name = config.name;
    this.model = config.model;
    const resolvedBaseURL = config.endpoint ?? baseURL;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(resolvedBaseURL ? { baseURL: resolvedBaseURL } : {}),
    });
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<Message> {
    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: toOpenAIMessages(messages),
      ...(tools.length > 0 ? { tools: toOpenAITools(tools) } : {}),
    };

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];
    const msg = choice.message;

    const result: Message = {
      role: "assistant",
      content: msg.content ?? "",
    };

    if (msg.tool_calls?.length) {
      result.toolCalls = msg.tool_calls
        .filter((tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === "function")
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }));
    }

    return result;
  }
}
