const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { claudeCodeDirs, version, compareVersions, apply, restore } = require("./lib/install");

const CLAUDE_CODE_ID = "anthropic.claude-code";
const ISSUES = "https://github.com/stefan1575/context-gauge-for-claude-code/issues";

function options() {
  const c = vscode.workspace.getConfiguration("contextGauge");
  return { warn: c.get("warnTokens", 150000), alert: c.get("alertTokens", 300000) };
}

// Claude Code installs live beside this extension, in the same extensions folder.
function extensionsRoot(context) {
  const cc = vscode.extensions.getExtension(CLAUDE_CODE_ID);
  return path.dirname(cc ? cc.extensionPath : context.extension.extensionPath);
}

// The running Claude Code and any newer version waiting for a reload.
function targets(context) {
  const cc = vscode.extensions.getExtension(CLAUDE_CODE_ID);
  const running = cc ? version(cc.extensionPath) : null;
  return claudeCodeDirs(extensionsRoot(context))
    .filter((d) => !running || compareVersions(version(d), running) >= 0)
    .map((d) => ({ dir: d, running: !!cc && path.resolve(d) === path.resolve(cc.extensionPath) }));
}

// Paused after "Restore Claude Code" until "Re-apply", so the watcher doesn't undo a restore.
const PAUSED = "paused";
const warned = new Set();

function patchAll(context) {
  if (context.globalState.get(PAUSED)) return;
  const opts = options();
  let reloadNeeded = false;
  for (const t of targets(context)) {
    const name = path.basename(t.dir);
    try {
      if (apply(t.dir, opts) === "patched" && t.running) reloadNeeded = true;
    } catch (e) {
      const key = `${name}: ${e.message}`;
      if (warned.has(key)) continue; // once per window, not on every watcher event
      warned.add(key);
      vscode.window.showWarningMessage(
        `Context Gauge couldn't patch ${name}: ${e.message}. Claude Code is unchanged.`, "Report issue")
        .then((pick) => { if (pick) vscode.env.openExternal(vscode.Uri.parse(ISSUES)); });
    }
  }
  if (reloadNeeded) {
    vscode.window.showInformationMessage("Context Gauge is ready. Reload the window to see it in Claude Code.", "Reload Window")
      .then((pick) => { if (pick) vscode.commands.executeCommand("workbench.action.reloadWindow"); });
  }
}

function activate(context) {
  patchAll(context);

  // Claude Code updates are installed in the background and load on the next reload: patch the
  // new version as soon as it lands, so the patched copy is what loads.
  let timer;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => patchAll(context), 5000); };
  try {
    const watcher = fs.watch(extensionsRoot(context), later);
    context.subscriptions.push({ dispose: () => watcher.close() });
  } catch { /* no watch support: updates are still caught on the next start */ }
  context.subscriptions.push(
    { dispose: () => clearTimeout(timer) },
    vscode.extensions.onDidChange(later),
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("contextGauge")) patchAll(context); }),
    vscode.commands.registerCommand("contextGauge.reapply", async () => {
      await context.globalState.update(PAUSED, false);
      patchAll(context);
    }),
    vscode.commands.registerCommand("contextGauge.restore", async () => {
      await context.globalState.update(PAUSED, true);
      const restored = claudeCodeDirs(extensionsRoot(context)).filter(restore).length;
      const pick = await vscode.window.showInformationMessage(
        restored ? "Claude Code's original files are back. Reload the window to finish. Context Gauge stays off until you run \"Context Gauge: Re-apply\"."
                 : "Claude Code isn't patched.",
        ...(restored ? ["Reload Window"] : []));
      if (pick) vscode.commands.executeCommand("workbench.action.reloadWindow");
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
