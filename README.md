# Context Gauge for Claude Code

Shows how full the current session's context is in Claude Code's prompt box, all the time, so you
know when to `/clear` without typing `/context`.

- **Always visible:** next to the model picker, `182k` with a small ring. The stock gauge only
  appears after half the context window is used.
- **Three states:**
  - green with the ring a third full, under 150k tokens
  - orange, two thirds full, from 150k
  - red, full, from 300k

  Both thresholds can be changed in settings.
- **Hover for the breakdown:** the same "Context usage" panel `/context` opens, with the
  category bar, memory files and agents.
- **Follows the session you're looking at:** it refreshes when you switch sessions, after each
  reply, and on hover. The number comes from the same call `/context` uses.
- **Does nothing when clicked.** The stock gauge compacts the conversation when you click it.

## How it works, and what that means for you

The Claude Code extension has no API for this, so Context Gauge **edits Claude Code's installed
files**. It changes one file, `webview/index.js` in the Claude Code extension folder:

- **Backup:** the original is saved beside it as `index.js.orig`, and every patch starts from that
  copy.
- **Safety check:** the patch is checked before it is written. If the code it looks for has changed
  in a new Claude Code release, it leaves Claude Code alone and tells you. You then get Claude
  Code's stock gauge until Context Gauge is updated.
- **Claude Code updates:** an update replaces the file. Context Gauge patches the new version as
  soon as it's installed, so it's usually in place before you reload. If it isn't, you'll be asked
  to reload the window.
- **Undo:** run **Context Gauge: Restore Claude Code** from the Command Palette, or uninstall
  Context Gauge. Both put the original file back.

This is an unofficial extension, not made or endorsed by Anthropic. It changes another
extension's files on your machine; if you'd rather not, don't install it.

## Settings

| Setting | Default | |
| --- | --- | --- |
| `contextGauge.warnTokens` | `150000` | Orange from here |
| `contextGauge.alertTokens` | `300000` | Red from here |

Changing a setting re-applies the patch; reload the window to see it.

## Commands

- **Context Gauge: Re-apply** patches again, for example after a restore.
- **Context Gauge: Restore Claude Code** puts the original file back and pauses Context Gauge
  until you re-apply.

## Limits

- **Local only.** It patches the Claude Code installed on your machine. In a Remote (SSH, WSL,
  Dev Container) window where Claude Code runs on the remote side, nothing changes.
- **Needs a reply first.** In a new session the gauge appears once Claude has replied.

## Development

```sh
npm test          # patches a copy of your installed Claude Code bundle and checks it parses
npm run icon      # redraws images/icon.png
npm run package   # builds the .vsix
```

### Publishing

For a new release, bump `version` in `package.json`, add it to `CHANGELOG.md`, run
`npm run package`, then:

- **Open VSX:** `npm run publish:openvsx` (reads the token from `OVSX_PAT`).
- **VS Code Marketplace:** on https://marketplace.visualstudio.com/manage/publishers/stefan1575,
  open the extension's **⋯ → Update** and upload the new `.vsix`, pressing Upload by hand (the
  page's reCAPTCHA rejects automated clicks). The command-line route
  (`npm run publish:marketplace` with a `VSCE_PAT` Azure DevOps token, scope Marketplace: Manage)
  needs an Azure DevOps organization, which for this account asks for an Azure subscription.
- **GitHub:** `gh release create v<version> <file>.vsix`.

## License

MIT
