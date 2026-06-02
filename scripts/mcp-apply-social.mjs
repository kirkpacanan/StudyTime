/**
 * Prints migration SQL paths for Supabase MCP apply_migration.
 * Usage: node scripts/mcp-apply-social.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrations = [
  ["social_identity", "20240601000000_social_identity.sql"],
  ["social_friends", "20240601001000_friends.sql"],
  ["social_presence", "20240601002000_presence.sql"],
  ["social_activity_feed", "20240601003000_activity_feed.sql"],
  ["social_repair", "20240601005000_social_repair.sql"],
];

for (const [name, file] of migrations) {
  const sql = readFileSync(resolve(root, "supabase/migrations", file), "utf8");
  console.log(JSON.stringify({ name, bytes: sql.length, sql }));
}
