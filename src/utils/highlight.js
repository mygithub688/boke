// 零依赖代码高亮：支持 js/ts/py/rust/bash/json/css/c 系常见语法
// 用法：highlightElement(el, lang) —— 传入 pre>code 元素，就地替换 innerHTML

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const LANGS = {
  js: {
    keywords: /\b(const|let|var|function|return|if|else|for|while|class|extends|new|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|switch|case|break|continue|do|yield|delete|void|static|get|set)\b/,
    builtins: /\b(console|document|window|Math|JSON|Object|Array|String|Number|Boolean|Promise|Map|Set|Date|Error|fetch|localStorage|setTimeout|setInterval|require|module|process)\b/
  },
  python: {
    keywords: /\b(def|return|if|elif|else|for|while|class|import|from|as|with|try|except|finally|raise|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|global|nonlocal|yield|async|await|assert|del)\b/,
    builtins: /\b(print|len|range|enumerate|zip|open|str|int|float|list|dict|set|tuple|type|isinstance|super|sorted|map|filter|sum|min|max|abs)\b/
  },
  rust: {
    keywords: /\b(fn|let|mut|const|static|if|else|match|for|while|loop|return|struct|enum|impl|trait|use|pub|mod|crate|self|Self|where|async|await|move|ref|as|in|dyn|unsafe|type|break|continue|true|false)\b/,
    builtins: /\b(Some|None|Ok|Err|Vec|String|str|Option|Result|Box|Rc|Arc|println|print|format|vec)\b/
  },
  bash: {
    keywords: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|local|export|source|alias|exit|echo|cd|sudo|set|shift|read)\b/,
    builtins: /\b(git|npm|node|python|pip|curl|wget|docker|apt|apk|brew|ls|cp|mv|rm|mkdir|cat|grep|sed|awk|chmod|chown|tar|ssh|systemctl|pm2|wsl)\b/
  },
  css: {
    keywords: /#[0-9a-fA-F]{3,8}\b|\.[a-zA-Z_][\w-]*|:[a-z-]+(?:\([^)]*\))?/,
    builtins: /\b(display|position|flex|grid|color|background|margin|padding|border|width|height|font|top|right|bottom|left|opacity|transform|transition|animation|box-shadow|border-radius|align|justify)\b/
  },
  json: { keywords: /\b(true|false|null)\b/, builtins: /()$/ }
}
const ALIAS = { javascript: 'js', typescript: 'js', jsx: 'js', tsx: 'js', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', html: 'css', xml: 'css', yml: 'bash', yaml: 'bash', c: 'js', cpp: 'js', java: 'js', go: 'js', ts: 'js' }

function highlight(code, lang) {
  const cfg = LANGS[lang]
  if (!cfg) return esc(code)

  // 主扫描器：依次匹配 注释/字符串/数字/关键词/内置名，其余原样输出
  const parts = [
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/,        // 1 注释（py/bash 用 #，c 系用 // /**/）
    /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/, // 2 字符串
    /(\b\d+(?:\.\d+)?\b)/,                            // 3 数字
  ]
  const master = new RegExp(
    parts.map(r => r.source).join('|'),
    'g'
  )

  let out = ''
  let last = 0
  for (const m of code.matchAll(master)) {
    out += esc(code.slice(last, m.index))
    const [full] = m
    if (m[1]) out += `<span class="tok-com">${esc(full)}</span>`
    else if (m[2]) out += `<span class="tok-str">${esc(full)}</span>`
    else out += `<span class="tok-num">${esc(full)}</span>`
    last = m.index + full.length
  }
  out += esc(code.slice(last))

  // 关键词 / 内置名（对已转义的纯文本再走一遍，避免破坏 span 标签：只匹配词边界）
  out = out.replace(new RegExp(`(^|[^\\w<])(${cfg.keywords.source}|${cfg.builtins.source})(?=[^\\w]|$)`, 'g'), (s, pre, word) => {
    const cls = cfg.keywords.test(word) ? 'tok-kw' : 'tok-bi'
    return `${pre}<span class="${cls}">${word}</span>`
  })
  return out
}

// 无语言标注时按代码特征嗅探
function sniffLang(code) {
  if (/\bfn\s+\w+|let\s+mut|impl\s+|match\s+[^{]+\{|println!/.test(code)) return 'rust'
  if (/\bdef\s+\w+\(|\bimport\s+\w+|from\s+\w+\s+import|print\(/.test(code)) return 'python'
  if (/^\s*\$\s|\bapt(-get)?\s|\bgit\s+(clone|add|commit)|\bnpm\s|\bwsl\s|\bapk\s+add/.test(code)) return 'bash'
  if (/^#include|\bstd::|printf\(/.test(code)) return 'js'
  if (/^\s*(ldc|i32|i64)\.|IL:/.test(code)) return undefined // IL 汇编不高亮
  return 'js'
}

// 给文章页的 pre>code 元素就地高亮
export function highlightArticleCode(container) {
  container.querySelectorAll('pre > code').forEach(codeEl => {
    if (codeEl.dataset.hl) return
    codeEl.dataset.hl = '1'
    const cls = codeEl.className || ''
    const m = cls.match(/language-([\w+#-]+)/)
    const raw = m ? m[1].toLowerCase() : ''
    let lang = raw ? (ALIAS[raw] || (LANGS[raw] ? raw : undefined)) : sniffLang(codeEl.textContent)
    if (lang && !LANGS[lang]) lang = undefined
    codeEl.innerHTML = highlight(codeEl.textContent, lang)
  })
}
