import { exec } from "child_process";
import { promisify } from "util";
import type { ToolDefinition } from "../providers/base.js";

const execAsync = promisify(exec);

const MAX_BUFFER = 10 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export const TERMINAL_TOOL: ToolDefinition = {
  name: "run_command",
  description:
    "Executes a command in the terminal. Use this to read skill documents, manage sub-agents, or perform system tasks.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Terminal command to execute",
      },
    },
    required: ["command"],
  },
};

export async function executeCommand(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      shell: "/bin/bash",
    });
    const output = [stdout, stderr].filter(Boolean).join("\n");
    return output || "(Command completed with no output)";
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message: string };
    const parts = [error.stdout, error.stderr, error.message].filter(Boolean);
    return `Error occurred:\n${parts.join("\n")}`;
  }
}
