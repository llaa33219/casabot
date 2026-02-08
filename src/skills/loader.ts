import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { PATHS } from "../config/manager.js";
import type { Skill } from "../config/types.js";

export async function loadSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];
  const skillsDir = PATHS.skills;

  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return skills;
  }

  for (const entry of entries) {
    const entryPath = join(skillsDir, entry);
    const entryStat = await stat(entryPath).catch(() => null);
    if (!entryStat?.isDirectory()) continue;

    const skillFile = join(entryPath, "SKILL.md");
    const content = await readFile(skillFile, "utf-8").catch(() => null);
    if (!content) continue;

    const parsed = matter(content);
    const frontmatter = parsed.data as Record<string, unknown>;

    skills.push({
      name: (frontmatter.name as string) ?? entry,
      description: (frontmatter.description as string) ?? "",
      metadata: frontmatter.metadata as Record<string, unknown> ?? {},
      instructions: parsed.content.trim(),
      path: skillFile,
    });
  }

  return skills;
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "사용 가능한 스킬이 없습니다.";

  const lines = ["사용 가능한 스킬 목록:"];
  for (const skill of skills) {
    lines.push(`\n### ${skill.name}`);
    if (skill.description) lines.push(skill.description);
    lines.push(`경로: ${skill.path}`);
  }
  return lines.join("\n");
}
