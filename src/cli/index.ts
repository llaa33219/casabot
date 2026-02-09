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
  .description("CasAbot — Skill-based Multi-Agent Orchestrator")
  .version("1.0.0");

program
  .command("setup")
  .description("Initial setup (providers, models, and all settings)")
  .action(async () => {
    try {
      await setupWizard();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error during setup: ${msg}`);
      process.exit(1);
    }
  });

program
  .command("reset")
  .description("Reset to default settings")
  .action(async () => {
    try {
      await saveConfig(getDefaultConfig());
      console.log("✅ Settings have been reset.");
      console.log("Run 'casabot setup' to reconfigure.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error during reset: ${msg}`);
      process.exit(1);
    }
  });

program
  .action(async () => {
    try {
      await ensureDirectories();

      const config = await loadConfig();

      if (!config.activeProvider || config.providers.length === 0) {
        console.log("⚠️  No provider configured.");
        console.log("Run 'casabot setup' first.\n");
        process.exit(1);
      }

      const providerConfig = config.providers.find(
        (p) => p.name === config.activeProvider,
      );

      if (!providerConfig) {
        console.error(`❌ Active provider '${config.activeProvider}' not found.`);
        console.error("Run 'casabot setup' to reconfigure.");
        process.exit(1);
      }

      const provider = createProvider(providerConfig);
      const skills = await loadSkills();
      const conversation = createConversation();

      startTUI(provider, conversation, skills);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error during startup: ${msg}`);
      process.exit(1);
    }
  });

program.parse();
