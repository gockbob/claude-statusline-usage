#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
const claudeDir = path.dirname(settingsPath);

try {
  // Ensure ~/.claude directory exists
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // Read existing settings or start fresh
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  }

  // Patch statusLine
  settings.statusLine = {
    type: "command",
    command: "claude-statusline-usage",
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log("\x1b[32m✔\x1b[0m claude-statusline-usage configured in ~/.claude/settings.json");
  console.log("  Restart Claude Code to apply.");
} catch (err) {
  console.warn("⚠ Could not auto-configure settings.json:", err.message);
  console.warn('  Manually add to ~/.claude/settings.json:');
  console.warn('  { "statusLine": { "type": "command", "command": "claude-statusline-usage" } }');
}
