// Runs the patch against the Claude Code extension installed on this machine (its bundle is
// Anthropic's and isn't in this repo). Skipped when none is installed.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { patchJs, mark, PatchError } = require("../lib/patch");
const { claudeCodeDirs, apply, restore, state } = require("../lib/install");

const opts = { warn: 150000, alert: 300000 };
const roots = [".vscode", ".vscode-insiders", ".cursor", ".vscode-oss"].map((d) => path.join(os.homedir(), d, "extensions"));
const installed = roots.flatMap(claudeCodeDirs).pop();
const pristine = installed && (() => {
  const f = path.join(installed, "webview", "index.js");
  return fs.existsSync(f + ".orig") ? fs.readFileSync(f + ".orig", "utf8") : fs.readFileSync(f, "utf8");
})();

test("patches the installed Claude Code bundle into code that parses", { skip: !installed && "Claude Code not installed" }, () => {
  const out = patchJs(pristine, opts);
  new vm.Script(out);
  assert.ok(out.endsWith(`${mark(opts)}\n`));
  assert.ok(out.includes("getContextUsage().then((r)=>r&&r.usage"), "gauge reads /context usage");
  assert.ok(out.includes("tok>=300000?2:tok>=150000?1:0"), "thresholds baked in");
  assert.ok(!/if\([\w$]+>=50\)return null\}return/.test(out), "stock half-full gate removed");
});

test("apply, re-apply and restore round-trip on a copy", { skip: !installed && "Claude Code not installed" }, () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cg-")), "anthropic.claude-code-9.9.9-test");
  fs.mkdirSync(path.join(dir, "webview"), { recursive: true });
  const file = path.join(dir, "webview", "index.js");
  fs.writeFileSync(file, pristine);
  assert.strictEqual(state(dir, opts), "stock");
  assert.strictEqual(apply(dir, opts), "patched");
  assert.strictEqual(apply(dir, opts), "unchanged");
  const other = { warn: 100000, alert: 200000 };
  assert.strictEqual(state(dir, other), "outdated");
  assert.strictEqual(apply(dir, other), "patched");
  assert.ok(fs.readFileSync(file, "utf8").includes("tok>=200000?2:tok>=100000?1:0"), "re-applied from the original, not stacked");
  assert.ok(restore(dir));
  assert.strictEqual(fs.readFileSync(file, "utf8"), pristine);
  fs.rmSync(path.dirname(dir), { recursive: true });
});

test("refuses code it doesn't recognise", () => {
  assert.throws(() => patchJs("function x(){}", opts), PatchError);
});
