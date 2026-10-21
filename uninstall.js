// Run by VS Code (as "vscode:uninstall") after the extension is uninstalled: puts Claude Code's
// original files back. Runs in plain Node without the VS Code API; this extension's folder sits in
// the same extensions folder as Claude Code's.
const path = require("path");
const { claudeCodeDirs, restore } = require("./lib/install");

for (const dir of claudeCodeDirs(path.dirname(__dirname))) restore(dir);
