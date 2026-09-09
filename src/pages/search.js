import { postCard } from '../components/postCard.js'
import { site } from '../data.js'
import { fetchPosts } from '../api.js'

function footerHTML() {
  return `
    <footer class="footer">
      <div class="footer-inner">
        <div>
          <div class="footer-brand">${site.name} · ${site.nameEn}</div>
          <div class="footer-note">${site.bio}</div>
        </div>
        <div class="footer-links">
          <a href="${site.links.github}" target="_blank" rel="noopener">GitHub</a>
          <a href="${site.links.weibo}">微博</a>
          <a href="mailto:${site.links.email}">邮箱</a>
        </div>
        <div class="footer-copy">
          <span>© ${new Date().getFullYear()} ${site.name}. 保留所有权利。</span>
          <span>Built with Vanilla JS · 无框架 · 无依赖</span>
        </div>
      </div>
    </footer>
  `
}

function parseQuery() {
  const hash = window.location.hash.slice(1)
  const qIdx = hash.indexOf('?')
  if (qIdx < 0) return {}
  const params = {}
  hash.slice(qIdx + 1).split('&').forEach(pair => {
    const [k, v] = pair.split('=')
    if (k) params[k] = decodeURIComponent(v || '')
  })
  return params
}

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function renderSearch(container) {
  const { q = '', tag = '' } = parseQuery()
  const query = q.toLowerCase()
  const label = tag ? `标签：${tag}` : query ? `搜索"${q}"` : '全部文章'
  const sub = tag ? 'Tag' : 'Search'

  container.innerHTML = `
    <div class="page">
      <div class="section-label">
        <h2>${esc(label)}</h2>
        <span class="en">${sub}</span>
        <span class="count" id="searchCount">…</span>
      </div>
      <div class="post-grid" id="searchGrid">
        <p style="color:var(--text-muted);grid-column:1/-1;padding:40px 0;text-align:center">加载中…</p>
      </div>
    </div>
    ${footerHTML()}
  `

  fetchPosts().then(({ posts }) => {
    let results
    if (tag) {
      results = posts.filter(p => p.tag === tag)
    } else if (query) {
      results = posts.filter(p =>
        p.title.toLowerCase().includes(query) ||
        (p.excerpt || '').toLowerCase().includes(query) ||
        p.tag.toLowerCase().includes(query)
      )
    } else {
      results = posts
    }

    container.querySelector('#searchCount').textContent = `${results.length} 篇结果`
    container.querySelector('#searchGrid').innerHTML = results.length
      ? results.map(p => postCard(p)).join('')
      : `<div class="empty-state" style="grid-column:1/-1">
           <div class="icon">⌕</div>
           <p>没有找到匹配的文章</p>
           <p style="margin-top:12px"><a href="#/" style="color:var(--accent)">← 返回首页</a></p>
         </div>`
  }).catch(() => {
    container.querySelector('#searchGrid').innerHTML = '<p style="color:#e07070;grid-column:1/-1;text-align:center">无法连接服务器</p>'
  })
}

export default {
  render(container) { renderSearch(container) },
  cleanup() {}
}
