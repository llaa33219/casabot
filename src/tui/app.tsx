import React, { useState, useCallback, useEffect, useMemo } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import type { ChatProvider } from "../providers/base.js";
import type { ConversationHistory, Message, Skill } from "../config/types.js";
import { runAgent } from "../agent/base.js";

marked.use(markedTerminal());

function renderMarkdown(content: string): string {
  const result = marked.parse(content);
  if (typeof result === "string") return result.trimEnd();
  return content;
}

function truncateOutput(content: string, maxLines = 8): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n  … ${lines.length - maxLines} more lines`
  );
}

function estimateMessageLines(message: Message, width: number): number {
  const contentWidth = Math.max(width - 10, 20);
  const countLines = (text: string): number =>
    text.split("\n").reduce(
      (sum, line) =>
        sum + Math.max(1, Math.ceil((line.length || 1) / contentWidth)),
      0,
    );

  if (message.role === "user") {
    return 2 + countLines(message.content);
  }
  if (message.role === "tool") {
    return 3 + countLines(truncateOutput(message.content));
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    let lines = 2;
    if (message.content) lines += countLines(message.content);
    lines += 4 + (message.toolCalls?.length ?? 0);
    return lines;
  }
  if (message.role === "assistant") {
    return 2 + countLines(message.content);
  }
  return 2;
}

function HRule({ width }: { width: number }): React.ReactElement {
  return (
    <Box paddingX={1}>
      <Text dimColor>{"─".repeat(Math.max(width - 4, 10))}</Text>
    </Box>
  );
}

function Header(): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} paddingTop={1}>
      <Gradient name="vice">
        <Text bold>{"✦  CasAbot"}</Text>
      </Gradient>
      <Text dimColor>
        {"Cassiopeia A — Freely creates everything, like a supernova explosion."}
      </Text>
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
        <Text>{content}</Text>
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
        <Text>{renderMarkdown(content)}</Text>
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
          <Text>{renderMarkdown(message.content)}</Text>
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
              <Text color="white">{display}</Text>
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
      <Text dimColor>{truncateOutput(content)}</Text>
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
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
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

function ScrollIndicator({
  direction,
  count,
}: {
  direction: "above" | "below";
  count: number;
}): React.ReactElement {
  const arrow = direction === "above" ? "▲" : "▼";
  return (
    <Box justifyContent="center" paddingX={2}>
      <Text dimColor>
        {`${arrow} ${count} more ${count === 1 ? "message" : "messages"} ${direction}`}
      </Text>
    </Box>
  );
}

interface AppProps {
  provider: ChatProvider;
  conversation: ConversationHistory;
  skills: Skill[];
}

// border(2) + header(3) + hrules(2) + input(3) + status(1) = 11
const CHROME_HEIGHT = 11;

function App({
  provider,
  conversation,
  skills,
}: AppProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [termSize, setTermSize] = useState({
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  });

  useEffect(() => {
    const onResize = () => {
      setTermSize({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24,
      });
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  useEffect(() => {
    setScrollOffset((prev) => (prev === 0 ? 0 : prev + 1));
  }, [messages.length]);

  const messagesHeight = Math.max(termSize.rows - CHROME_HEIGHT, 4);

  const { visibleMessages, hiddenAbove, hiddenBelow } = useMemo(() => {
    if (messages.length === 0) {
      return { visibleMessages: [] as Message[], hiddenAbove: 0, hiddenBelow: 0 };
    }

    const endIndex = messages.length - scrollOffset;
    let usedLines = isProcessing ? 2 : 0;
    let startIndex = endIndex;

    for (let i = endIndex - 1; i >= 0; i--) {
      const lines = estimateMessageLines(messages[i], termSize.columns);
      if (usedLines + lines > messagesHeight && startIndex < endIndex) break;
      usedLines += lines;
      startIndex = i;
    }

    return {
      visibleMessages: messages.slice(startIndex, endIndex),
      hiddenAbove: startIndex,
      hiddenBelow: scrollOffset,
    };
  }, [messages, scrollOffset, messagesHeight, termSize.columns, isProcessing]);

  const maxScrollOffset = useMemo(() => {
    return Math.max(0, messages.length - 1);
  }, [messages.length]);

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
    if (key.upArrow) {
      setScrollOffset((prev) => Math.min(prev + 1, maxScrollOffset));
    }
    if (key.downArrow) {
      setScrollOffset((prev) => Math.max(prev - 1, 0));
    }
  });

  const userCount = messages.filter((m) => m.role === "user").length;

  return (
    <Box
      flexDirection="column"
      width={termSize.columns}
      height={termSize.rows}
      borderStyle="round"
      borderColor="gray"
    >
      <Header />
      <HRule width={termSize.columns} />

      <Box
        flexDirection="column"
        height={messagesHeight}
        overflowY="hidden"
        justifyContent="flex-end"
      >
        {messages.length === 0 && !isProcessing ? (
          <WelcomeHint />
        ) : (
          <>
            {hiddenAbove > 0 && (
              <ScrollIndicator direction="above" count={hiddenAbove} />
            )}
            {visibleMessages.map((msg, i) => (
              <MessageView key={hiddenAbove + i} message={msg} />
            ))}
            {isProcessing && <ProcessingIndicator />}
            {hiddenBelow > 0 && (
              <ScrollIndicator direction="below" count={hiddenBelow} />
            )}
          </>
        )}
      </Box>

      <HRule width={termSize.columns} />

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
        <Text dimColor>{"Ctrl+C exit  ↑↓ scroll"}</Text>
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
