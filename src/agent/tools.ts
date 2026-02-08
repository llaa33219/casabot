import { exec } from "child_process";
import { promisify } from "util";
import type { ToolDefinition } from "../providers/base.js";

const execAsync = promisify(exec);

const MAX_BUFFER = 10 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export const TERMINAL_TOOL: ToolDefinition = {
  name: "run_command",
  description:
    "터미널에서 명령어를 실행합니다. 스킬 문서를 읽거나, 서브에이전트를 관리하거나, 시스템 작업을 수행할 때 사용합니다.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "실행할 터미널 명령어",
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
    return output || "(명령어가 출력 없이 완료되었습니다)";
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message: string };
    const parts = [error.stdout, error.stderr, error.message].filter(Boolean);
    return `오류 발생:\n${parts.join("\n")}`;
  }
}
