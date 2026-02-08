import type { ChatProvider } from "../providers/base.js";
import type { Message, Skill, ConversationHistory } from "../config/types.js";
import { TERMINAL_TOOL, executeCommand } from "./tools.js";
import { appendMessage } from "../history/store.js";
import { formatSkillsForPrompt } from "../skills/loader.js";
import { CASABOT_HOME } from "../config/manager.js";

const MAX_ITERATIONS = 20;

export function buildSystemPrompt(skills: Skill[]): string {
  const skillList = formatSkillsForPrompt(skills);

  return `당신은 CasAbot의 base 에이전트입니다. Cassiopeia A — 초신성 폭발과 같이 모든 것을 자유롭게 창조합니다.

## 핵심 원칙
1. 당신은 오케스트레이터입니다. 실제 작업을 직접 수행하지 마세요.
2. 스킬 문서를 우선적으로 참조하세요. 필요한 스킬의 SKILL.md를 읽고 지침을 따르세요.
3. 적합한 서브에이전트가 있으면 위임하고, 없으면 새로 만들어서 위임하세요.
4. 오케스트레이션(에이전트 생성/위임/관리)만 직접 수행하세요.

## 사용 가능한 도구
- \`run_command\`: 터미널 명령어를 실행합니다. 이 도구 하나로 스킬을 읽고, 서브에이전트를 관리하고, 모든 오케스트레이션을 수행합니다.

## 작업 순서
1. 사용자의 요청을 분석합니다.
2. 관련 스킬 문서를 읽습니다: \`cat <스킬경로>\`
3. 스킬 지침에 따라 서브에이전트를 생성하거나 기존 에이전트에 위임합니다.
4. 결과를 수집하여 사용자에게 보고합니다.

## CasAbot 디렉토리 구조
- 홈: ${CASABOT_HOME}
- 스킬: ${CASABOT_HOME}/skills/
- 워크스페이스: ${CASABOT_HOME}/workspaces/
- 대화 기록: ${CASABOT_HOME}/history/
- 기록(메모): ${CASABOT_HOME}/memory/
- 설정: ${CASABOT_HOME}/casabot.json

## ${skillList}
`;
}

export async function* runAgent(
  provider: ChatProvider,
  userMessage: string,
  conversation: ConversationHistory,
  skills: Skill[],
): AsyncGenerator<Message> {
  const systemPrompt = buildSystemPrompt(skills);

  const userMsg: Message = { role: "user", content: userMessage };
  await appendMessage(conversation, userMsg);

  const tools = [TERMINAL_TOOL];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const messagesWithSystem: Message[] = [
      { role: "system", content: systemPrompt },
      ...conversation.messages,
    ];
    const assistantMsg = await provider.chat(messagesWithSystem, tools);
    await appendMessage(conversation, assistantMsg);
    yield assistantMsg;

    if (!assistantMsg.toolCalls?.length) {
      return;
    }

    for (const toolCall of assistantMsg.toolCalls) {
      let result: string;

      if (toolCall.name === "run_command") {
        try {
          const args = JSON.parse(toolCall.arguments) as { command: string };
          result = await executeCommand(args.command);
        } catch {
          result = `오류: 도구 인자 파싱 실패 — ${toolCall.arguments}`;
        }
      } else {
        result = `알 수 없는 도구: ${toolCall.name}`;
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
    content: "⚠️ 최대 반복 횟수에 도달했습니다. 요청을 다시 시도해 주세요.",
  };
  await appendMessage(conversation, limitMsg);
  yield limitMsg;
}
