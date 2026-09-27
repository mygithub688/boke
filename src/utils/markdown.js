// 简化版 Markdown → HTML（零依赖）
// 支持：#/##/###/#### 标题、**粗体**、*斜体*、`行内代码`、``` 代码块、
// [链接](url)、![图片](url)、- 无序列表、1. 有序列表、> 引用、--- 分隔线、段落
// 输出风格与现有文章 body_html 一致（h2/h3 + p + ul + blockquote + pre>code）

export function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')

  const blockStart = /^(#{1,4}\s|```|>\s|\s*[-*]\s|\s*\d+[.、]\s|-{3,}\s*$)/

  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim()
      const buf = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++ // 跳过闭合 ```
      out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(buf.join('\n'))}</code></pre>`)
      continue
    }

    // 标题（# → h2，### → h4，因为文章主标题是 h1）
    const h = line.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      const level = Math.min(h[1].length + 1, 5)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
      i++
      continue
    }

    // 分隔线
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr/>'); i++; continue }

    // 引用
    if (/^>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`)
      continue
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${buf.join('')}</ul>`)
      continue
    }

    // 有序列表
    if (/^\s*\d+[.、]\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*\d+[.、]\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\s*\d+[.、]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>${buf.join('')}</ol>`)
      continue
    }

    // 空行
    if (!line.trim()) { i++; continue }

    // 段落（连续非空行合并，直到遇到块级标记）
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() && !blockStart.test(lines[i])) {
      buf.push(lines[i]); i++
    }
    out.push(`<p>${inline(buf.join('<br/>'))}</p>`)
  }

  return out.join('\n')
}
