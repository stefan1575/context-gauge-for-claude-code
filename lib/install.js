// Applies and removes the patch on installed copies of the Claude Code extension.
// The untouched bundle is kept beside it as index.js.orig; every patch starts from that copy,
// so applying again (new thresholds, new patch version) never stacks edits.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { patchJs, mark, MARK_PREFIX } = require("./patch");

const CLAUDE_CODE_DIR = /^anthropic\.claude-code-(\d+)\.(\d+)\.(\d+)/;

function version(dir) {
  const m = CLAUDE_CODE_DIR.exec(path.basename(dir));
  return m ? m.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

// Installed Claude Code versions in an extensions folder, oldest first.
function claudeCodeDirs(extensionsRoot) {
  let names;
  try { names = fs.readdirSync(extensionsRoot); } catch { return []; }
  return names
    .map((n) => path.join(extensionsRoot, n))
    .filter((d) => version(d) && fs.existsSync(path.join(d, "webview", "index.js")))
    .sort((a, b) => compareVersions(version(a), version(b)));
}

const bundle = (dir) => path.join(dir, "webview", "index.js");

// "patched" | "outdated" (patched with other settings or an older patch) | "stock"
function state(dir, opts) {
  const src = fs.readFileSync(bundle(dir), "utf8");
  if (src.includes(mark(opts))) return "patched";
  return src.includes(MARK_PREFIX) ? "outdated" : "stock";
}

// Returns "patched" or "unchanged"; throws (leaving the files as they were) when it can't patch.
function apply(dir, opts) {
  const file = bundle(dir), orig = file + ".orig";
  const current = fs.readFileSync(file, "utf8");
  if (current.includes(mark(opts))) return "unchanged";
  let pristine;
  if (fs.existsSync(orig)) pristine = fs.readFileSync(orig, "utf8");
  else if (current.includes(MARK_PREFIX)) throw new Error("bundle is patched but its index.js.orig backup is missing; reinstall Claude Code");
  else pristine = current;

  const out = patchJs(pristine, opts);
  new vm.Script(out, { filename: file }); // refuse to write anything that doesn't parse
  if (!fs.existsSync(orig)) fs.writeFileSync(orig, pristine);
  fs.writeFileSync(file, out);
  return "patched";
}

// Puts the original bundle back. Returns true when something was restored.
function restore(dir) {
  const file = bundle(dir), orig = file + ".orig";
  if (!fs.existsSync(orig)) return false;
  fs.copyFileSync(orig, file);
  fs.unlinkSync(orig);
  return true;
}

module.exports = { claudeCodeDirs, version, compareVersions, state, apply, restore };
