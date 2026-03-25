# claude-statusline-usage

Claude Code statusline with pace-aware rate limit gauges.

```
📂 my-project  🤖 Opus 4.6 (1M context) 2%   🕐 █████████│██▌░░   🗓  ██████████│█░░░
```

- 🕐 5-hour session limit gauge
- 🗓 7-day weekly limit gauge
- Pace marker (`│`) shows expected usage based on elapsed time
- Color shifts green → yellow → red as you outpace your budget
- Half-block characters (`▌`) for 2x gauge resolution
- Context window usage (%) next to model name

## Install

```bash
npm i -g claude-statusline-usage
```

That's it. `settings.json` is configured automatically.

## Manual setup

If auto-config didn't work, add this to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-statusline-usage"
  }
}
```

## Uninstall

```bash
npm uninstall -g claude-statusline-usage
```

Remove the `statusLine` entry from `~/.claude/settings.json` manually.

## License

MIT
