#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig, saveConfig, getDefaultConfig, ensureDirectories } from "../config/manager.js";
import { createProvider } from "../providers/index.js";
import { loadSkills } from "../skills/loader.js";
import { createConversation } from "../history/store.js";
import { startTUI } from "../tui/app.js";
import { setupWizard } from "./setup.js";

const program = new Command();

program
  .name("casabot")
  .description("CasAbot — 스킬 중심 멀티에이전트 오케스트레이터")
  .version("1.0.0");

program
  .command("setup")
  .description("최초 설정 (공급자, 모델 등 전체 설정)")
  .action(async () => {
    try {
      await setupWizard();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ 설정 중 오류 발생: ${msg}`);
      process.exit(1);
    }
  });

program
  .command("reset")
  .description("초기 설정으로 되돌리기")
  .action(async () => {
    try {
      await saveConfig(getDefaultConfig());
      console.log("✅ 설정이 초기화되었습니다.");
      console.log("'casabot setup' 명령어로 다시 설정하세요.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ 초기화 중 오류 발생: ${msg}`);
      process.exit(1);
    }
  });

program
  .action(async () => {
    try {
      await ensureDirectories();

      const config = await loadConfig();

      if (!config.activeProvider || config.providers.length === 0) {
        console.log("⚠️  공급자가 설정되지 않았습니다.");
        console.log("'casabot setup' 명령어로 먼저 설정하세요.\n");
        process.exit(1);
      }

      const providerConfig = config.providers.find(
        (p) => p.name === config.activeProvider,
      );

      if (!providerConfig) {
        console.error(`❌ 활성 공급자 '${config.activeProvider}'를 찾을 수 없습니다.`);
        console.error("'casabot setup' 명령어로 다시 설정하세요.");
        process.exit(1);
      }

      const provider = createProvider(providerConfig);
      const skills = await loadSkills();
      const conversation = createConversation();

      startTUI(provider, conversation, skills);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ 시작 중 오류 발생: ${msg}`);
      process.exit(1);
    }
  });

program.parse();
