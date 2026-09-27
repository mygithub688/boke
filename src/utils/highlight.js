// 零依赖代码高亮：支持 js/ts/py/rust/bash/json/css/c 系常见语法
// 单遍扫描：注释/字符串/数字/关键词/内置名 一次 matchAll 完成，避免二次替换破坏标签
// 用法：highlightElement(el) —— 传入文章容器，就地高亮其中 pre>code

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function span(cls, text) {
  return `<span class="${cls}">${esc(text)}</span>`
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
    hashComments: false,
    keywords: /#[0-9a-fA-F]{3,8}\b|\.[a-zA-Z_][\w-]*|::?[a-z-]+(?:\([^)]*\))?/,
    builtins: /\b(display|position|flex|grid|color|background|margin|padding|border|width|height|font|top|right|bottom|left|opacity|transform|transition|animation|box-shadow|border-radius|align|justify)\b/
  },
  json: {
    hashComments: false,
    keywords: /\b(true|false|null)\b/,
    builtins: /__()__/
  }
}
const ALIAS = { javascript: 'js', typescript: 'js', jsx: 'js', tsx: 'js', ts: 'js', c: 'js', cpp: 'js', java: 'js', go: 'js', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', html: 'css', xml: 'css', yml: 'bash', yaml: 'bash' }

function highlight(code, lang) {
  const cfg = LANGS[lang]
  if (!cfg) return esc(code)

  // 注释风格按语言区分：css/json 只有 /* */，其余支持 //、#、/* */
  const commentSrc = cfg.hashComments === false
    ? '(\\/\\*[\\s\\S]*?\\*\\/)'
    : '(\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)'
  const stringSrc = '("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)'

  const master = new RegExp([
    commentSrc,                               // 1 注释
    stringSrc,                                // 2 字符串
    '(\\b\\d+(?:\\.\\d+)?\\b)',               // 3 数字
    `(?:${cfg.keywords.source})`,             // 关键词
    `(?:${cfg.builtins.source})`              // 内置名
  ].join('|'), 'g')

  let out = ''
  let last = 0
  for (const m of code.matchAll(master)) {
    const full = m[0]
    out += esc(code.slice(last, m.index))
    if (m[1]) out += span('tok-com', full)
    else if (m[2]) out += span('tok-str', full)
    else if (m[3]) out += span('tok-num', full)
    else if (cfg.keywords.test(full)) out += span('tok-kw', full)
    else out += span('tok-bi', full)
    last = m.index + full.length
  }
  out += esc(code.slice(last))
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
