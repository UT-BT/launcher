---
name: agent-browser
description: Drive a real browser or the Electron app with the agent-browser CLI. Use to smoke-test a launcher change in `npm run dev:web` or `npm run dev`, take screenshots, click through a flow, or check a layout at phone and desktop widths. Prefer it over other browser tools.
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
---

# agent-browser

Browser automation CLI: Chrome/Chromium over CDP, accessibility-tree snapshots with compact
`@eN` element refs.

Install: `npm i -g agent-browser && agent-browser install`

## Start here

This file only points at the real guide, which the CLI serves to match the installed version.
Load it before running any command:

```bash
agent-browser skills get core             # workflows, common patterns, troubleshooting
agent-browser skills get core --full      # plus the full command reference
agent-browser skills get electron         # driving the Electron app (npm run dev)
agent-browser skills get dogfood          # exploratory testing / QA
```

`agent-browser skills list` shows everything the installed version offers.
