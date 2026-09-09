import { site } from '../data.js'

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

function render404(container, path) {
  const code = 404
  const glitch = () => {
    const el = document.querySelector('.nf-code')
    if (!el) return
    el.style.transform = `translate(${(Math.random()-0.5)*4}px, ${(Math.random()-0.5)*4}px)`
    el.style.textShadow = `${(Math.random()-0.5)*8}px 0 rgba(212,169,98,0.5), ${(Math.random()-0.5)*-8}px 0 rgba(180,80,80,0.3)`
    setTimeout(glitch, 150)
  }

  container.innerHTML = `
    <div class="page">
      <div class="not-found">
        <div class="nf-code">${code}</div>
        <div class="nf-sub">404 NOT FOUND</div>
        <p class="nf-msg">
          你访问的页面 <code>${path || '未知路径'}</code> 不存在。<br>
          它可能已被删除，或者你走错了路。
        </p>
        <div class="nf-actions">
          <a class="btn btn-primary" href="#/">回到首页</a>
          <a class="btn btn-ghost" href="#/about">关于我</a>
        </div>
        <div class="nf-stars">
          ${Array.from({length: 20}, () => `<span class="nf-star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*3}s">${['✦','✧','·','⋆'][Math.floor(Math.random()*4)]}</span>`).join('')}
        </div>
      </div>
    </div>
    ${footerHTML()}
  `

  glitch()
}

export default {
  render(container, params) { render404(container, params?.path) },
  cleanup() {}
}
