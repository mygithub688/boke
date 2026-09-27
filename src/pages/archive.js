// 归档页：按年份分组的时间线
import { site } from '../data.js'
import { fetchArchive } from '../api.js'

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

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

function renderArchive(container) {
  container.innerHTML = `
    <div class="page narrow">
      <div class="archive-hero anim-up">
        <h1>归档 <span class="en">Archive</span></h1>
        <p id="archiveTotal">加载中…</p>
      </div>
      <div id="archiveBody"><p style="color:var(--text-muted);text-align:center;padding:40px 0">加载中…</p></div>
    </div>
    ${footerHTML()}
  `

  const body = container.querySelector('#archiveBody')
  fetchArchive().then(({ posts }) => {
    container.querySelector('#archiveTotal').textContent = `共 ${posts.length} 篇文章`

    if (!posts.length) {
      body.innerHTML = '<div class="empty-state"><div class="icon">∅</div><p>还没有发布任何文章</p></div>'
      return
    }

    // 按年份分组
    const byYear = new Map()
    for (const p of posts) {
      const year = (p.created_at || '').slice(0, 4)
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push(p)
    }

    body.innerHTML = [...byYear.entries()].map(([year, list]) => `
      <div class="archive-year anim-up">
        <div class="archive-year-label">
          <span class="year-num">${esc(year)}</span>
          <span class="year-count">${list.length} 篇</span>
        </div>
        <div class="archive-list">
          ${list.map(p => {
            const d = (p.created_at || '').slice(5, 10)
            return `
              <a class="archive-item" href="#/post/${esc(p.slug)}">
                <span class="archive-date">${esc(d)}</span>
                <span class="archive-title">${esc(p.title)}</span>
                <span class="archive-tag">${esc(p.tag)}</span>
              </a>`
          }).join('')}
        </div>
      </div>`).join('')
  }).catch(() => {
    body.innerHTML = '<p style="color:#e07070;text-align:center">归档加载失败，请确认后端服务已启动</p>'
  })
}

export default {
  render(container) { renderArchive(container) },
  cleanup() {}
}
