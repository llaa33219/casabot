import type { ChatProvider } from "../providers/base.js";
import type { Message, Skill, ConversationHistory } from "../config/types.js";
import { TERMINAL_TOOL, executeCommand } from "./tools.js";
import { appendMessage } from "../history/store.js";
import { formatSkillsForPrompt } from "../skills/loader.js";
import { CASABOT_HOME } from "../config/manager.js";

const MAX_ITERATIONS = 20;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("AbortError"));
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(new Error("AbortError")),
        { once: true },
      );
    }),
  ]);
}

export function buildSystemPrompt(skills: Skill[]): string {
  const skillList = formatSkillsForPrompt(skills);

  return `You are the base agent of CasAbot. Cassiopeia A — Freely creates everything, like a supernova explosion.

## Core Principles
1. You are an orchestrator. Do not perform actual tasks directly.
2. Refer to skill documents first. Read the relevant SKILL.md and follow the instructions.
3. Delegate to an appropriate sub-agent if one exists; otherwise, create a new one and delegate.
4. Only perform orchestration (agent creation/delegation/management) directly.
5. Try to solve problems independently using all available information before asking the user. Only ask the user when you truly need information you cannot obtain on your own (e.g. API keys, sudo passwords, personal preferences).
6. When you encounter information worth remembering (e.g. user preferences, API keys, system details), use the memory skill to persist it for future sessions.

## Available Tools
- \`run_command\`: Executes a command in the terminal. Use this single tool to read skills, manage sub-agents, and perform all orchestration.

## Workflow
1. Analyze the user's request.
2. Read relevant skill documents: \`cat <skill-path>\`
3. Create sub-agents or delegate to existing ones following skill instructions.
4. Collect results and report back to the user.

## CasAbot Directory Structure
- Home: ${CASABOT_HOME}
- Skills: ${CASABOT_HOME}/skills/
- Workspaces: ${CASABOT_HOME}/workspaces/
- Conversation History: ${CASABOT_HOME}/history/
- Memory (Memos): ${CASABOT_HOME}/memory/
- Config: ${CASABOT_HOME}/casabot.json

## ${skillList}
`;
}

export async function* runAgent(
  provider: ChatProvider,
  userMessage: string,
  conversation: ConversationHistory,
  skills: Skill[],
  signal: AbortSignal,
): AsyncGenerator<Message> {
  const systemPrompt = buildSystemPrompt(skills);

  const userMsg: Message = { role: "user", content: userMessage };
  await appendMessage(conversation, userMsg);

  const tools = [TERMINAL_TOOL];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) return;

    const messagesWithSystem: Message[] = [
      { role: "system", content: systemPrompt },
      ...conversation.messages,
    ];

    let assistantMsg: Message;
    for (let attempt = 0; ; attempt++) {
      try {
        assistantMsg = await raceAbort(provider.chat(messagesWithSystem, tools), signal);
        break;
      } catch (err: unknown) {
        if (signal.aborted) return;
        if (attempt >= MAX_RETRIES) throw err;

        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const retryMsg: Message = {
          role: "assistant",
          content: `⏳ API request failed: ${errorMsg}. Retrying in ${delay}ms... (${attempt + 1}/${MAX_RETRIES})`,
        };
        yield retryMsg;

        await raceAbort(new Promise((resolve) => setTimeout(resolve, delay)), signal);
      }
    }

    await appendMessage(conversation, assistantMsg);
    yield assistantMsg;

    if (!assistantMsg.toolCalls?.length) {
      return;
    }

    for (const toolCall of assistantMsg.toolCalls) {
      if (signal.aborted) return;

      let result: string;

      if (toolCall.name === "run_command") {
        try {
          const args = JSON.parse(toolCall.arguments) as { command: string };
          result = await executeCommand(args.command);
        } catch {
          result = `Error: Failed to parse tool arguments — ${toolCall.arguments}`;
        }
      } else {
        result = `Unknown tool: ${toolCall.name}`;
      }

      const toolMsg: Message = {
        role: "tool",
        content: result,
        toolCallId: toolCall.id,
      };
      await appendMessage(conversation, toolMsg);
      yield toolMsg;
    }
  }

  const limitMsg: Message = {
    role: "assistant",
    content: "⚠️ Maximum iteration count reached. Please try your request again.",
  };
  await appendMessage(conversation, limitMsg);
  yield limitMsg;
}
