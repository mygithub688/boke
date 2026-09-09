import { site } from '../data.js'
import { postCard } from '../components/postCard.js'
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

function renderHome(container) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  container.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-inner">
          <div class="hero-date">${dateStr}</div>
          <h1>在代码与生活的缝隙里，记录关于<em>技术</em>、<em>硬件</em>与<em>思考</em>的一切。</h1>
          <p class="hero-bio">${site.bio}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/#latest" onclick="event.preventDefault(); document.getElementById('latest')?.scrollIntoView({behavior:'smooth'})">
              开始阅读
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
            <a class="btn btn-ghost" href="#/about">关于我</a>
          </div>
        </div>
        <div class="hero-clock">
          <div class="time">${timeStr}</div>
          <div class="date">${now.getFullYear()} · ${now.getMonth() + 1} · ${now.getDate()}</div>
        </div>
      </section>

      <section id="latest">
        <div class="section-label">
          <h2>最新文章</h2>
          <span class="en">Latest Posts</span>
          <span class="count" id="postCount">…</span>
        </div>
        <div class="post-grid" id="postGrid">
          <p style="color:var(--text-muted);grid-column:1/-1;padding:40px 0;text-align:center">加载中…</p>
        </div>
      </section>

      <section id="tags">
        <div class="section-label">
          <h2>标签</h2>
          <span class="en">Tags</span>
        </div>
        <div class="tags-cloud" id="tagsCloud">
          <p style="color:var(--text-muted)">加载中…</p>
        </div>
      </section>
    </div>
    ${footerHTML()}
  `

  // 从 API 拉取文章和标签
  fetchPosts().then(({ posts: posts, tags: tagNames }) => {
    const featured = posts.find(p => p.is_featured) || posts[0]
    const rest = posts.filter(p => p.id !== featured?.id)

    container.querySelector('#postCount').textContent = `${posts.length} 篇`
    container.querySelector('#postGrid').innerHTML = featured
      ? postCard(featured, { featured: true }) + rest.map(p => postCard(p)).join('')
      : '<p style="color:var(--text-muted);grid-column:1/-1">暂无文章</p>'

    // 标签：从 API 获取带计数的标签
    fetchTagsData().then(tags => {
      container.querySelector('#tagsCloud').innerHTML = tags.map(t =>
        `<a class="tag-pill" href="#/search?q=${encodeURIComponent(t.name)}">${t.name}<span class="n">${t.count}</span></a>`
      ).join('')
    })
  }).catch(() => {
    // API 不可用时回退到本地数据
    import('../data.js').then(({ posts, tags }) => {
      const featured = posts.find(p => p.featured) || posts[0]
      const rest = posts.filter(p => p.id !== featured.id)
      container.querySelector('#postCount').textContent = `${posts.length} 篇`
      container.querySelector('#postGrid').innerHTML =
        postCard(featured, { featured: true }) + rest.map(p => postCard(p)).join('')
      container.querySelector('#tagsCloud').innerHTML = tags.map(t =>
        `<a class="tag-pill" href="#/search?q=${encodeURIComponent(t.name)}">${t.name}<span class="n">${t.count}</span></a>`
      ).join('')
    })
  })
}

async function fetchTagsData() {
  const res = await fetch('http://localhost:3001/api/tags')
  const d = await res.json()
  return d.tags
}

export default {
  render(container) { renderHome(container) },
  cleanup() {}
}
