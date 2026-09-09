import { postCard } from '../components/postCard.js'
import { site } from '../data.js'
import { fetchPost, fetchPosts } from '../api.js'

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

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function renderArticle(container, { id }) {
  const placeholder = `
    <div class="page narrow">
      <div style="text-align:center;padding:80px 0;color:var(--text-muted)">加载中…</div>
    </div>
    ${footerHTML()}`
  container.innerHTML = placeholder

  fetchPost(id).then(({ post, related }) => {
    const dateFmt = post.created_at?.replace('T', ' ').slice(0, 10) || post.created_at || ''
    const readMin = Math.max(1, Math.round(post.body_html.length / 800))

    container.innerHTML = `
      <div class="page narrow">
        <div class="article-head anim-up">
          <div class="post-meta">
            <span class="tag">${esc(post.tag)}</span>
            <span>${dateFmt}</span>
            <span>·</span>
            <span>约 ${readMin} 分钟</span>
          </div>
          <h1 class="article-title">${esc(post.title)}</h1>
          <p class="article-lead">${esc(post.excerpt)}</p>
        </div>
        <div class="article-body anim-fade">${post.body_html}</div>
        <div class="article-end">
          <a class="back-link" href="#/">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            返回文章列表
          </a>
          <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">END</span>
        </div>
        <section class="related">
          <div class="section-label">
            <h2>继续读</h2>
            <span class="en">Keep Reading</span>
          </div>
          <div class="related-grid">
            ${related.map(p => postCard(p)).join('')}
          </div>
        </section>
      </div>
      ${footerHTML()}
    `

    // 阅读进度条
    const bar = document.createElement('div')
    bar.className = 'read-progress'
    document.body.appendChild(bar)
    const onScroll = () => {
      const h = document.documentElement
      const total = h.scrollHeight - h.clientHeight
      bar.style.width = (total > 0 ? (h.scrollTop / total) * 100 : 0) + '%'
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return function cleanup() {
      window.removeEventListener('scroll', onScroll)
      bar.remove()
    }
  }).catch(err => {
    // API 不可用时回退到本地数据
    import('../data.js').then(({ posts }) => {
      const post = posts.find(p => p.id === id)
      if (!post) {
        container.innerHTML = `<div class="page narrow"><div class="empty-state"><div class="icon">∅</div><p>文章不存在</p></div></div>${footerHTML()}`
        return
      }
      const related = posts.filter(p => p.id !== id).slice(0, 2)
      const dateFmt = post.date
      container.innerHTML = `
        <div class="page narrow">
          <div class="article-head anim-up">
            <div class="post-meta">
              <span class="tag">${esc(post.tag)}</span>
              <span>${dateFmt}</span>
              <span>·</span>
              <span>约 ${post.readMin} 分钟</span>
            </div>
            <h1 class="article-title">${esc(post.title)}</h1>
            <p class="article-lead">${esc(post.excerpt)}</p>
          </div>
          <div class="article-body anim-fade">${post.body}</div>
          <div class="article-end">
            <a class="back-link" href="#/">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              返回文章列表
            </a>
            <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">END</span>
          </div>
          <section class="related">
            <div class="section-label"><h2>继续读</h2><span class="en">Keep Reading</span></div>
            <div class="related-grid">${related.map(p => postCard(p)).join('')}</div>
          </section>
        </div>
        ${footerHTML()}
      `
    })
  })
}

export default {
  render(container, params) { return renderArticle(container, params) },
  cleanup() {}
}
