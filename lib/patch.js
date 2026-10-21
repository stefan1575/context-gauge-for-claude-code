// Source transform for the Claude Code extension's webview bundle (webview/index.js).
//
// Claude Code's input footer has a context pie that stays hidden until half the context is used,
// and compacts when clicked. This replaces it with a gauge that is always shown: "182k" and a ring
// that is a third full and green below `warn` tokens, two thirds and orange from `warn`, full and
// red from `alert`. It is the same size and font as the prompt-cache timer beside it. Hovering
// shows the extension's own "Context usage" panel (the one /context opens). Clicking does nothing.
//
// The bundle is minified and its names change every release, so every name used here is found by
// the shape of the code around it. When a shape is missing, `patchJs` throws and nothing changes.

const PATCH_VERSION = 4;
const MARK_PREFIX = "/*context-gauge-for-claude-code ";
const mark = (opts) => `${MARK_PREFIX}v${PATCH_VERSION} warn=${opts.warn} alert=${opts.alert}*/`;

const N = "[\\w$]+"; // one minified identifier

class PatchError extends Error {}
const need = (what, m) => {
  if (!m) throw new PatchError(`code not found: ${what}`);
  return m;
};

function patchJs(src, opts) {
  const warn = Math.round(opts.warn), alert = Math.round(opts.alert);

  // Stock gauge: function G({usedTokens,contextWindow,onCompact,buttonClassName}){...return F(PIE,{percentageUsed,...})}
  const g = need("context gauge", new RegExp(
    `function (${N})\\(\\{usedTokens:${N},contextWindow:${N},onCompact:${N},buttonClassName:${N}\\}\\)\\{`).exec(src));
  const gauge = g[1];
  const tail = need("context gauge return", new RegExp(
    `\\}return (${N})\\((${N}),\\{percentageUsed:${N},onCompact:${N},buttonClassName:${N}\\}\\)\\}`)
    .exec(src.slice(g.index, g.index + 1500)));
  const F = tail[1], pieButton = tail[2];
  const gaugeEnd = g.index + tail.index + tail[0].length;

  // Pie button: useState and the tooltip host class.
  const p = src.indexOf(`function ${pieButton}({percentageUsed:`);
  if (p < 0) throw new PatchError("code not found: pie button");
  const pieSrc = src.slice(p, p + 1500);
  const useState = need("useState", new RegExp(`let\\[${N},${N}\\]=(${N})\\(!1\\)`).exec(pieSrc))[1];
  const host = need("tooltip host class", new RegExp(`className:(${N})\\.host`).exec(pieSrc))[1];

  // The /context dialog: useEffect, its body component and classes, and the dialog shell's classes.
  const d = need("context dialog", new RegExp(
    `return (${N})\\(\\(\\)=>\\{let ${N}=!1;return ${N}\\.getContextUsage\\(\\)`).exec(src));
  const useEffect = d[1];
  const dSrc = src.slice(d.index, d.index + 1200);
  const shell = need("dialog shell", new RegExp(`${F}\\((${N}),\\{title:"Context usage"`).exec(dSrc))[1];
  const ctxCls = need("context panel classes", new RegExp(`className:(${N})\\.container`).exec(dSrc))[1];
  const ctxBody = need("context panel", new RegExp(`${F}\\((${N}),\\{usage:${N}\\}\\)`).exec(dSrc))[1];
  const s = src.indexOf(`function ${shell}({title:`);
  if (s < 0) throw new PatchError("code not found: dialog shell function");
  const dlg = need("dialog classes", new RegExp(`className:\\[(${N})\\.dialog`).exec(src.slice(s, s + 2500)))[1];

  // The prompt-cache timer's classes, so the gauge matches its size and font.
  const t = need("cache timer classes", new RegExp(
    `(${N})\\.footerButton,(${N})\\.footerButtonPrimary,(${N})\\.indicator`).exec(src));
  const timerCls = `[${t[1]}.footerButton,${t[2]}.footerButtonPrimary,${t[3]}.indicator].join(" ")`;

  // Call site: pass the session in.
  const call = new RegExp(`(${F}\\(${gauge},\\{)(usedTokens:(${N})\\.usageData\\.value\\.totalTokens,)`, "g");
  const calls = src.match(call) || [];
  if (calls.length !== 1) throw new PatchError(`code not found: gauge call site (${calls.length} matches)`);

  // Token count: the same call as /context, refetched on session switch, ~1.5 s after each reply
  // and on hover. Until it answers, the count of the last reply.
  const body =
    `function ${gauge}({session:s,usedTokens:u}){` +
    `let[c,setC]=${useState}(null),[h,setH]=${useState}(null),sid=s?.sessionId?.value;` +
    `let load=()=>s?.getContextUsage?s.getContextUsage().then((r)=>r&&r.usage?{sid,usage:r.usage}:null,()=>null):Promise.resolve(null);` +
    `${useEffect}(()=>{let dead=!1,t=setTimeout(()=>load().then((v)=>{if(!dead&&v)setC(v)}),u>0?1500:0);` +
      `return()=>{dead=!0,clearTimeout(t)}},[s,sid,u]);` +
    `let cur=c&&c.sid===sid?c.usage:null,tok=cur?cur.totalTokens:u;if(!(tok>0))return null;` +
    `let k=tok>=${alert}?2:tok>=${warn}?1:0,` +
      `col=["var(--vscode-charts-green,#89d185)","var(--vscode-charts-orange,#d18616)","var(--vscode-charts-red,#f14c4c)"][k],` +
      `txt=tok.toLocaleString()+" tokens in context",C=2*Math.PI*3.8,arc=C*(k+1)/3;` +
    `let enter=(e)=>{let r=e.currentTarget.getBoundingClientRect(),W=window.innerWidth,w=Math.min(440,W-16);` +
      `setH({left:Math.max(8,Math.min(r.left,W-w-8)),bottom:window.innerHeight-r.top+8,width:w});load().then((v)=>{if(v)setC(v)})};` +
    `return ${F}("div",{className:${host}.host,children:[` +
      `${F}("span",{className:${timerCls},style:{color:col,paddingRight:8},"aria-label":txt,` +
        `onMouseEnter:enter,onMouseLeave:()=>setH(null),children:[` +
        // The timer's icon is a 20-unit path drawn at .58 scale; r 3.8 + half the stroke matches it.
        `${F}("svg",{width:"20",height:"20",viewBox:"0 0 20 20",fill:"none",children:[` +
          `${F}("circle",{cx:"10",cy:"10",r:"3.8",stroke:"currentColor",strokeOpacity:"0.25",strokeWidth:"1.1"},"a"),` +
          `${F}("circle",{cx:"10",cy:"10",r:"3.8",stroke:"currentColor",strokeWidth:"1.1",strokeLinecap:"round",` +
            `strokeDasharray:arc.toFixed(2)+" "+C.toFixed(2),transform:"rotate(-90 10 10)"},"b")]},"p"),` +
        `${F}("span",{"data-footer-fixed-width":"",children:Math.round(tok/1e3)+"k"},"t")]},"b"),` +
      `h&&${F}("div",{className:${dlg}.dialog,style:{position:"fixed",left:h.left,bottom:h.bottom,width:h.width,maxWidth:440,margin:0,zIndex:1e3,pointerEvents:"none"},children:[` +
        `${F}("div",{className:${dlg}.header,children:${F}("h3",{className:${dlg}.title,children:"Context usage"})},"hd"),` +
        `${F}("div",{className:${dlg}.content,children:${F}("div",{className:${ctxCls}.container,children:` +
          `cur?${F}(${ctxBody},{usage:cur}):${F}("p",{className:${ctxCls}.message,children:"Loading context usage\\u2026"})})},"ct")]},"h")]})}`;

  let out = src.slice(0, g.index) + body + src.slice(gaugeEnd);
  out = out.replace(call, "$1session:$3,$2");
  return `${out}\n${mark(opts)}\n`;
}

module.exports = { patchJs, mark, MARK_PREFIX, PATCH_VERSION, PatchError };
