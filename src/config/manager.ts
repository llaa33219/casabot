import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { CasabotConfig } from "./types.js";

export const CASABOT_HOME = join(homedir(), "casabot");

export const PATHS = {
  config: join(CASABOT_HOME, "casabot.json"),
  skills: join(CASABOT_HOME, "skills"),
  workspaces: join(CASABOT_HOME, "workspaces"),
  history: join(CASABOT_HOME, "history"),
  memory: join(CASABOT_HOME, "memory"),
} as const;

const SKILL_DIRS = ["agent", "config", "chat", "service", "memory", "subskills"];

export function getDefaultConfig(): CasabotConfig {
  return {
    providers: [],
    activeProvider: "",
    baseModel: "",
  };
}

export async function ensureDirectories(): Promise<void> {
  const dirs = [
    CASABOT_HOME,
    PATHS.skills,
    PATHS.workspaces,
    PATHS.history,
    PATHS.memory,
    ...SKILL_DIRS.map((d) => join(PATHS.skills, d)),
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

export async function loadConfig(): Promise<CasabotConfig> {
  try {
    const raw = await readFile(PATHS.config, "utf-8");
    return JSON.parse(raw) as CasabotConfig;
  } catch {
    return getDefaultConfig();
  }
}

export async function saveConfig(config: CasabotConfig): Promise<void> {
  await ensureDirectories();
  await writeFile(PATHS.config, JSON.stringify(config, null, 2), "utf-8");
}
