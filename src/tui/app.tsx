import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { render, Box, Text, Static, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import type { ChatProvider } from "../providers/base.js";
import type { ConversationHistory, Message, Skill } from "../config/types.js";
import { runAgent } from "../agent/base.js";

import {
  createConversation,
  listConversations,
  saveConversation,
  appendMessage,
} from "../history/store.js";

const BRAND_BLUE = "#2BADEE";
const BRAND_RED = "#EA3A23";

function renderMarkdown(content: string): string {
  const width = Math.max((process.stdout.columns ?? 80) - 8, 40);
  const md = new Marked({ gfm: true });
  md.use(markedTerminal({ showSectionPrefix: false, tab: 2, width, reflowText: true }));
  return (md.parse(content, { async: false }) as string).trimEnd();
}

function truncateOutput(content: string, maxLines = 8): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n  … ${lines.length - maxLines} more lines`
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getPreview(conv: ConversationHistory, maxLen = 50): string {
  const firstUser = conv.messages.find((m) => m.role === "user");
  if (!firstUser) return "(empty session)";
  const text = firstUser.content.replace(/\n/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

function HRule({ columns }: { columns: number }): React.ReactElement {
  return (
    <Box paddingX={1} width={columns}>
      <Text dimColor>{"─".repeat(Math.max(columns - 4, 1))}</Text>
    </Box>
  );
}

function HeaderBlock({ columns }: { columns: number }): React.ReactElement {
  return (
    <Box flexDirection="column" paddingTop={1} width={columns}>
      <Box paddingX={2}>
        <Gradient colors={[BRAND_RED, BRAND_BLUE]}>
          <Text bold>{"✦  CasAbot"}</Text>
        </Gradient>
      </Box>
      <Box paddingX={2}>
        <Text wrap="wrap" dimColor>
          {"Cassiopeia A — Freely creates everything, like a supernova explosion."}
        </Text>
      </Box>
      <HRule columns={columns} />
    </Box>
  );
}

function UserMessageView({ content, columns }: { content: string; columns: number }): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1} width={columns}>
      <Text color={BRAND_RED} bold>
        {"▶ You"}
      </Text>
      <Box marginLeft={2} width={Math.max(columns - 6, 10)}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}

function AssistantMessageView({
  content,
  columns,
}: {
  content: string;
  columns: number;
}): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1} width={columns}>
      <Text color={BRAND_BLUE} bold>
        {"✦ CasAbot"}
      </Text>
      <Box marginLeft={2} width={Math.max(columns - 6, 10)}>
        <Text wrap="wrap">{renderMarkdown(content)}</Text>
      </Box>
    </Box>
  );
}

function ToolCallsView({
  message,
  columns,
}: {
  message: Message;
  columns: number;
}): React.ReactElement {
  const boxWidth = Math.max(columns - 6, 10);
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1} width={columns}>
      <Text color={BRAND_BLUE} bold>
        {"✦ CasAbot"}
      </Text>
      {message.content ? (
        <Box marginLeft={2} width={boxWidth}>
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
        width={boxWidth}
        overflow="hidden"
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
          const maxArgLen = Math.max(boxWidth - tc.name.length - 8, 20);
          if (display.length > maxArgLen) {
            display = display.slice(0, maxArgLen - 1) + "…";
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
  columns,
}: {
  content: string;
  columns: number;
}): React.ReactElement {
  const boxWidth = Math.max(columns - 6, 10);
  return (
    <Box
      flexDirection="column"
      marginLeft={4}
      marginRight={2}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      width={boxWidth}
      overflow="hidden"
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
  columns,
}: {
  message: Message;
  columns: number;
}): React.ReactElement {
  if (message.role === "user") {
    return <UserMessageView content={message.content} columns={columns} />;
  }
  if (message.role === "tool") {
    return <ToolResultView content={message.content} columns={columns} />;
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    return <ToolCallsView message={message} columns={columns} />;
  }
  if (message.role === "assistant") {
    return <AssistantMessageView content={message.content} columns={columns} />;
  }
  return <Text wrap="wrap">{message.content}</Text>;
}

function WelcomeHint({ columns }: { columns: number }): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1} marginBottom={1} width={columns}>
      <Text dimColor>{"Type a message below to get started."}</Text>
      <Text dimColor>{"CasAbot will orchestrate agents to help you."}</Text>
    </Box>
  );
}

function ProcessingIndicator({ columns }: { columns: number }): React.ReactElement {
  return (
    <Box paddingX={2} marginTop={1} gap={1} width={columns}>
      <Text color="yellow">
        <Spinner type="dots" />
      </Text>
      <Text color="yellow">{"Thinking…"}</Text>
    </Box>
  );
}

interface HistoryBrowserProps {
  columns: number;
  currentId: string;
  onSelect: (conversation: ConversationHistory) => void;
  onBack: () => void;
}

function HistoryBrowser({
  columns,
  currentId,
  onSelect,
  onBack,
}: HistoryBrowserProps): React.ReactElement {
  const [conversations, setConversations] = useState<ConversationHistory[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listConversations()
      .then((convs) => {
        setConversations(convs);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  useInput((ch, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return && conversations.length > 0) {
      onSelect(conversations[selectedIndex]);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow && conversations.length > 0) {
      setSelectedIndex((prev) => Math.min(conversations.length - 1, prev + 1));
    }
  });

  const boxWidth = Math.max(columns - 4, 10);

  return (
    <Box flexDirection="column" paddingTop={1} width={columns}>
      <Box paddingX={2}>
        <Gradient colors={[BRAND_RED, BRAND_BLUE]}>
          <Text bold>{"📋 Session History"}</Text>
        </Gradient>
      </Box>

      <HRule columns={columns} />

      {isLoading ? (
        <Box paddingX={2} marginTop={1} gap={1}>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text color="yellow">{"Loading sessions…"}</Text>
        </Box>
      ) : conversations.length === 0 ? (
        <Box paddingX={2} marginTop={1}>
          <Text dimColor>{"No previous sessions found."}</Text>
        </Box>
      ) : (
        <Box
          flexDirection="column"
          marginX={2}
          marginTop={1}
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          paddingY={1}
          width={boxWidth}
          overflow="hidden"
        >
          {conversations.map((conv, i) => {
            const isSelected = i === selectedIndex;
            const isCurrent = conv.id === currentId;
            const dateStr = formatDate(conv.startedAt);
            const preview = getPreview(conv, Math.max(boxWidth - dateStr.length - 12, 20));
            const msgCount = conv.messages.filter((m) => m.role === "user").length;

            return (
              <Box key={conv.id} width={boxWidth - 4}>
                <Text
                  color={isSelected ? BRAND_BLUE : undefined}
                  bold={isSelected}
                  dimColor={!isSelected}
                >
                  {isSelected ? " ▶ " : "   "}
                </Text>
                <Text
                  color={isSelected ? BRAND_BLUE : undefined}
                  bold={isSelected}
                  dimColor={!isSelected}
                >
                  {dateStr}
                </Text>
                <Text dimColor={!isSelected}>{" │ "}</Text>
                <Text
                  color={isSelected ? "white" : undefined}
                  dimColor={!isSelected}
                  wrap="truncate"
                >
                  {preview}
                </Text>
                {isCurrent ? (
                  <Text color={BRAND_RED} bold>{" (current)"}</Text>
                ) : null}
                <Text dimColor>
                  {` [${msgCount}]`}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      <HRule columns={columns} />

      <Box paddingX={2} width={columns} justifyContent="space-between">
        <Text dimColor>{"↑↓ navigate  Enter select  ESC back"}</Text>
        <Text dimColor>{`${conversations.length} sessions`}</Text>
      </Box>
    </Box>
  );
}

type DisplayItem =
  | { key: string; type: "header" }
  | { key: string; type: "message"; message: Message };

type AppMode = "chat" | "history";

interface AppProps {
  provider: ChatProvider;
  conversation: ConversationHistory;
  skills: Skill[];
}

function App({
  provider,
  conversation: initialConversation,
  skills,
}: AppProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<AppMode>("chat");
  const conversationRef = useRef<ConversationHistory>(initialConversation);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();
  const { stdout } = useStdout();
  const columns = stdout.columns ?? 80;

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;

      if (trimmed === "/new") {
        setInput("");
        if (conversationRef.current.messages.length > 0) {
          await saveConversation(conversationRef.current);
        }
        process.stdout.write("\x1Bc");
        const newConv = createConversation();
        conversationRef.current = newConv;
        setMessages([]);
        return;
      }

      if (trimmed === "/history") {
        setInput("");
        if (conversationRef.current.messages.length > 0) {
          await saveConversation(conversationRef.current);
        }
        setMode("history");
        return;
      }

      setInput("");
      setIsProcessing(true);

      const userMsg: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const generator = runAgent(
          provider,
          trimmed,
          conversationRef.current,
          skills,
          controller.signal,
        );
        for await (const msg of generator) {
          if (controller.signal.aborted) break;
          setMessages((prev) => [...prev, msg]);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Error: ${errorMsg}` },
          ]);
        }
      }

      if (controller.signal.aborted) {
        const cancelMsg: Message = {
          role: "assistant",
          content: "⏹ Cancelled.",
        };
        setMessages((prev) => [...prev, cancelMsg]);
        await appendMessage(conversationRef.current, cancelMsg);
      }

      abortControllerRef.current = null;
      setIsProcessing(false);
    },
    [isProcessing, provider, skills],
  );

  const handleHistorySelect = useCallback(async (conv: ConversationHistory) => {
    if (conversationRef.current.messages.length > 0) {
      await saveConversation(conversationRef.current);
    }
    process.stdout.write("\x1Bc");
    conversationRef.current = conv;
    setMessages([...conv.messages]);
    setMode("chat");
  }, []);

  useInput((ch, key) => {
    if (mode !== "chat") return;

    if (isProcessing) {
      if (key.escape || (key.ctrl && ch === "c")) {
        handleCancel();
      }
    } else {
      if (key.ctrl && ch === "c") {
        exit();
      }
    }
  });

  const userCount = messages.filter((m) => m.role === "user").length;

  const convId = conversationRef.current.id;

  const items = useMemo(
    (): DisplayItem[] => [
      { key: `header-${convId}`, type: "header" },
      ...messages.map(
        (msg, i): DisplayItem => ({
          key: `${convId}-msg-${i}`,
          type: "message",
          message: msg,
        }),
      ),
    ],
    [messages, convId],
  );

  if (mode === "history") {
    return (
      <HistoryBrowser
        columns={columns}
        currentId={conversationRef.current.id}
        onSelect={handleHistorySelect}
        onBack={() => setMode("chat")}
      />
    );
  }

  return (
    <Box flexDirection="column" width={columns}>
      <Static items={items}>
        {(item) => {
          if (item.type === "header") {
            return (
              <Box key={item.key} flexDirection="column" width={columns}>
                <HeaderBlock columns={columns} />
              </Box>
            );
          }
          return (
            <Box key={item.key} flexDirection="column" width={columns}>
              <MessageView message={item.message} columns={columns} />
            </Box>
          );
        }}
      </Static>

      {messages.length === 0 && !isProcessing && <WelcomeHint columns={columns} />}
      {isProcessing && <ProcessingIndicator columns={columns} />}

      <HRule columns={columns} />

      <Box paddingX={1} width={columns}>
        <Box
          borderStyle="round"
          borderColor={isProcessing ? "gray" : BRAND_BLUE}
          paddingX={1}
          width={Math.max(columns - 2, 10)}
          overflow="hidden"
        >
          <Text color={BRAND_BLUE} bold>
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

      <Box paddingX={2} width={columns} justifyContent="space-between">
        <Text dimColor>
          {isProcessing
            ? "ESC / Ctrl+C cancel"
            : "/new  /history  Ctrl+C exit"}
        </Text>
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
