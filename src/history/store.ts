import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { PATHS } from "../config/manager.js";
import type { ConversationHistory, Message } from "../config/types.js";

export function createConversation(): ConversationHistory {
  return {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    messages: [],
  };
}

function historyPath(id: string): string {
  return join(PATHS.history, `${id}.json`);
}

export async function saveConversation(conversation: ConversationHistory): Promise<void> {
  const filePath = historyPath(conversation.id);
  await writeFile(filePath, JSON.stringify(conversation, null, 2), "utf-8");
}

export async function loadConversation(id: string): Promise<ConversationHistory | null> {
  try {
    const raw = await readFile(historyPath(id), "utf-8");
    return JSON.parse(raw) as ConversationHistory;
  } catch {
    return null;
  }
}

export async function listConversations(): Promise<ConversationHistory[]> {
  let files: string[];
  try {
    files = await readdir(PATHS.history);
  } catch {
    return [];
  }

  const conversations: ConversationHistory[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(join(PATHS.history, file), "utf-8").catch(() => null);
    if (!raw) continue;
    conversations.push(JSON.parse(raw) as ConversationHistory);
  }

  conversations.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return conversations;
}

export async function appendMessage(
  conversation: ConversationHistory,
  message: Message,
): Promise<void> {
  conversation.messages.push(message);
  await saveConversation(conversation);
}
