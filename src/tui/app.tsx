import React, { useState, useCallback, useMemo } from "react";
import { render, Box, Text, Static, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import type { ChatProvider } from "../providers/base.js";
import type { ConversationHistory, Message, Skill } from "../config/types.js";
import { runAgent } from "../agent/base.js";

marked.use({ gfm: true });

function renderMarkdown(content: string): string {
  const width = Math.max((process.stdout.columns ?? 80) - 8, 40);
  marked.use(markedTerminal({ showSectionPrefix: false, tab: 2, width }));
  return (marked.parse(content, { async: false }) as string).trimEnd();
}

function truncateOutput(content: string, maxLines = 8): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n  … ${lines.length - maxLines} more lines`
  );
}

function HRule(): React.ReactElement {
  const { stdout } = useStdout();
  const width = stdout.columns ?? 80;
  return (
    <Box paddingX={1}>
      <Text dimColor>{"─".repeat(Math.max(width - 4, 10))}</Text>
    </Box>
  );
}

function HeaderBlock(): React.ReactElement {
  return (
    <Box flexDirection="column" paddingTop={1}>
      <Box paddingX={2}>
        <Gradient name="vice">
          <Text bold>{"✦  CasAbot"}</Text>
        </Gradient>
      </Box>
      <Box paddingX={2}>
        <Text dimColor>
          {"Cassiopeia A — Freely creates everything, like a supernova explosion."}
        </Text>
      </Box>
      <HRule />
    </Box>
  );
}

function UserMessageView({ content }: { content: string }): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1}>
      <Text color="green" bold>
        {"▶ You"}
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}

function AssistantMessageView({
  content,
}: {
  content: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1}>
      <Text color="cyan" bold>
        {"✦ CasAbot"}
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{renderMarkdown(content)}</Text>
      </Box>
    </Box>
  );
}

function ToolCallsView({
  message,
}: {
  message: Message;
}): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1}>
      <Text color="cyan" bold>
        {"✦ CasAbot"}
      </Text>
      {message.content ? (
        <Box marginLeft={2}>
          <Text wrap="wrap">{renderMarkdown(message.content)}</Text>
        </Box>
      ) : null}
      <Box
        flexDirection="column"
        marginLeft={2}
        marginTop={1}
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
      >
        <Text color="yellow" bold>
          {"⚡ Tool Calls"}
        </Text>
        {message.toolCalls?.map((tc, i) => {
          let display = tc.arguments;
          try {
            const args = JSON.parse(tc.arguments) as Record<string, unknown>;
            if (typeof args.command === "string") display = args.command;
          } catch {
            /* keep raw */
          }
          return (
            <Box key={i}>
              <Text dimColor>{tc.name}</Text>
              <Text>{" → "}</Text>
              <Text color="white" wrap="wrap">{display}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function ToolResultView({
  content,
}: {
  content: string;
}): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      marginLeft={4}
      marginRight={2}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Text dimColor bold>
        {"📋 Result"}
      </Text>
      <Text dimColor wrap="wrap">{truncateOutput(content)}</Text>
    </Box>
  );
}

function MessageView({
  message,
}: {
  message: Message;
}): React.ReactElement {
  if (message.role === "user") {
    return <UserMessageView content={message.content} />;
  }
  if (message.role === "tool") {
    return <ToolResultView content={message.content} />;
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    return <ToolCallsView message={message} />;
  }
  if (message.role === "assistant") {
    return <AssistantMessageView content={message.content} />;
  }
  return <Text>{message.content}</Text>;
}

function WelcomeHint(): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1} marginBottom={1}>
      <Text dimColor>{"Type a message below to get started."}</Text>
      <Text dimColor>{"CasAbot will orchestrate agents to help you."}</Text>
    </Box>
  );
}

function ProcessingIndicator(): React.ReactElement {
  return (
    <Box paddingX={2} marginTop={1} gap={1}>
      <Text color="yellow">
        <Spinner type="dots" />
      </Text>
      <Text color="yellow">{"Thinking…"}</Text>
    </Box>
  );
}

type DisplayItem =
  | { key: string; type: "header" }
  | { key: string; type: "message"; message: Message };

interface AppProps {
  provider: ChatProvider;
  conversation: ConversationHistory;
  skills: Skill[];
}

function App({
  provider,
  conversation,
  skills,
}: AppProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { exit } = useApp();

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;

      setInput("");
      setIsProcessing(true);

      const userMsg: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const generator = runAgent(provider, trimmed, conversation, skills);
        for await (const msg of generator) {
          setMessages((prev) => [...prev, msg]);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ Error: ${errorMsg}` },
        ]);
      }

      setIsProcessing(false);
    },
    [isProcessing, provider, conversation, skills],
  );

  useInput((ch, key) => {
    if (key.ctrl && ch === "c") {
      exit();
    }
  });

  const userCount = messages.filter((m) => m.role === "user").length;

  const items = useMemo((): DisplayItem[] => [
    { key: "header", type: "header" },
    ...messages.map((msg, i): DisplayItem => ({
      key: `msg-${i}`,
      type: "message",
      message: msg,
    })),
  ], [messages]);

  return (
    <Box flexDirection="column">
      <Static items={items}>
        {(item) => {
          if (item.type === "header") {
            return (
              <Box key={item.key} flexDirection="column">
                <HeaderBlock />
              </Box>
            );
          }
          return (
            <Box key={item.key} flexDirection="column">
              <MessageView message={item.message} />
            </Box>
          );
        }}
      </Static>

      {messages.length === 0 && !isProcessing && <WelcomeHint />}
      {isProcessing && <ProcessingIndicator />}

      <HRule />

      <Box paddingX={1}>
        <Box
          borderStyle="round"
          borderColor={isProcessing ? "gray" : "cyan"}
          paddingX={1}
          width="100%"
        >
          <Text color="cyan" bold>
            {"❯ "}
          </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={(val: string) => {
              handleSubmit(val).catch(() => {});
            }}
            placeholder="Type your message…"
            focus={!isProcessing}
            showCursor
          />
        </Box>
      </Box>

      <Box paddingX={2} justifyContent="space-between">
        <Text dimColor>{"Ctrl+C exit"}</Text>
        <Text dimColor>
          {userCount} {userCount === 1 ? "message" : "messages"}
        </Text>
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
