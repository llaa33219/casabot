import React, { useState, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import type { ChatProvider } from "../providers/base.js";
import type { ConversationHistory, Message, Skill } from "../config/types.js";
import { runAgent } from "../agent/base.js";

function truncateOutput(content: string, maxLines = 5): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join("\n") + `\n  ... (${lines.length - maxLines}줄 더)`;
}

function MessageView({ message }: { message: Message }): React.ReactElement {
  if (message.role === "user") {
    return (
      <Box>
        <Text color="green" bold>{"사용자: "}</Text>
        <Text>{message.content}</Text>
      </Box>
    );
  }

  if (message.role === "tool") {
    return (
      <Box flexDirection="column">
        <Text dimColor bold>{"[도구 결과]"}</Text>
        <Text dimColor>{truncateOutput(message.content)}</Text>
      </Box>
    );
  }

  if (message.role === "assistant") {
    if (message.toolCalls?.length) {
      return (
        <Box flexDirection="column">
          <Text color="cyan" bold>{"CasAbot: "}</Text>
          {message.content ? <Text color="cyan">{message.content}</Text> : null}
          {message.toolCalls.map((tc, i) => {
            const args = (() => {
              try { return JSON.parse(tc.arguments) as { command?: string }; } catch { return {}; }
            })();
            return (
              <Text key={i} dimColor>
                {"  ⚡ "}{tc.name}: {args.command ?? tc.arguments}
              </Text>
            );
          })}
        </Box>
      );
    }

    return (
      <Box>
        <Text color="cyan" bold>{"CasAbot: "}</Text>
        <Text color="cyan">{message.content}</Text>
      </Box>
    );
  }

  return <Text>{message.content}</Text>;
}

interface AppProps {
  provider: ChatProvider;
  conversation: ConversationHistory;
  skills: Skill[];
}

function App({ provider, conversation, skills }: AppProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { exit } = useApp();

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    setInput("");
    setIsProcessing(true);

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const generator = runAgent(provider, text, conversation, skills);
      for await (const msg of generator) {
        setMessages((prev) => [...prev, msg]);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ 오류 발생: ${errorMsg}` },
      ]);
    }

    setIsProcessing(false);
  }, [input, isProcessing, provider, conversation, skills]);

  useInput((ch, key) => {
    if (key.ctrl && ch === "c") {
      exit();
      return;
    }

    if (isProcessing) return;

    if (key.return) {
      handleSubmit().catch(() => {});
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (ch && !key.ctrl && !key.meta) {
      setInput((prev) => prev + ch);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {"🌟 CasAbot > "}
        </Text>
        <Text dimColor>Cassiopeia A — 초신성 폭발과 같이 모든 것을 자유롭게 창조한다.</Text>
      </Box>

      {messages.map((msg, i) => (
        <MessageView key={i} message={msg} />
      ))}

      {isProcessing && (
        <Text color="yellow">{"⏳ 처리 중..."}</Text>
      )}

      <Box marginTop={1}>
        <Text color="green" bold>{"❯ "}</Text>
        <Text>{input}</Text>
        {!isProcessing && <Text dimColor>{"█"}</Text>}
      </Box>
    </Box>
  );
}

export function startTUI(
  provider: ChatProvider,
  conversation: ConversationHistory,
  skills: Skill[],
): void {
  render(
    <App provider={provider} conversation={conversation} skills={skills} />,
  );
}
