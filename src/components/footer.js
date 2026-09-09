import { site } from '../data.js'

export default {
  render(container) {
    container.innerHTML = `
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
}
