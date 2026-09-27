// 友链页
import { site } from '../data.js'
import { fetchLinks } from '../api.js'

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

function renderLinks(container) {
  container.innerHTML = `
    <div class="page">
      <div class="links-hero anim-up">
        <h1>友情链接 <span class="en">Links</span></h1>
        <p>值得常去的角落。想交换友链？通过页脚邮箱联系我。</p>
      </div>
      <div class="links-grid" id="linksGrid">
        <p style="color:var(--text-muted);text-align:center;grid-column:1/-1">加载中…</p>
      </div>
    </div>
    ${footerHTML()}
  `

  const grid = container.querySelector('#linksGrid')
  fetchLinks().then(({ links }) => {
    grid.innerHTML = links.length ? links.map(l => `
      <a class="link-card anim-up" href="${esc(l.url)}" target="_blank" rel="noopener">
        <div class="link-avatar">${esc((l.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="link-info">
          <div class="link-name">${esc(l.name)}</div>
          <div class="link-desc">${esc(l.description || new URL(l.url).hostname)}</div>
        </div>
        <span class="link-arrow">→</span>
      </a>`).join('')
      : '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1">还没有友链，快去管理面板添加吧</p>'
  }).catch(() => {
    grid.innerHTML = '<p style="color:#e07070;text-align:center;grid-column:1/-1">友链加载失败，请确认后端服务已启动</p>'
  })
}

export default {
  render(container) { renderLinks(container) },
  cleanup() {}
}
