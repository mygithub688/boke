import { site } from '../data.js'
import { postCard } from '../components/postCard.js'
import { fetchPosts, fetchTags, searchPosts } from '../api.js'

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

function skeletonCards(n = 6) {
  return Array.from({ length: n }, () => `
    <div class="post-card skeleton">
      <div class="skeleton-line" style="width:40%"></div>
      <div class="skeleton-line" style="width:85%"></div>
      <div class="skeleton-line" style="width:100%"></div>
      <div class="skeleton-line" style="width:70%"></div>
      <div class="skeleton-line" style="width:50%"></div>
    </div>
  `).join('')
}

let state = { tag: null, page: 1, total: 0 }

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
        <div class="tag-filter" id="tagFilter"></div>
        <div class="post-grid" id="postGrid">${skeletonCards(6)}</div>
        <div class="pagination" id="pagination"></div>
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

  loadTags(container)
  loadPosts(container, 1, null)
}

function loadTags(container) {
  fetchTags().then(({ tags }) => {
    const el = container.querySelector('#tagsCloud')
    if (!el) return
    el.innerHTML = tags.filter(t => t.count > 0).map(t =>
      `<a class="tag-pill" href="#/search?q=${encodeURIComponent(t.name)}">${t.name}<span class="n">${t.count}</span></a>`
    ).join('')

    // 标签筛选条
    const filter = container.querySelector('#tagFilter')
    if (filter) {
      filter.innerHTML = `<span class="tag-filter-item active" data-tag="">全部</span>` +
        tags.filter(t => t.count > 0).map(t =>
          `<span class="tag-filter-item" data-tag="${t.name}">${t.name}</span>`
        ).join('')
      filter.querySelectorAll('.tag-filter-item').forEach(item => {
        item.addEventListener('click', () => {
          filter.querySelectorAll('.tag-filter-item').forEach(i => i.classList.remove('active'))
          item.classList.add('active')
          const tag = item.dataset.tag || null
          state.tag = tag
          state.page = 1
          loadPosts(container, 1, tag)
        })
      })
    }
  }).catch(() => {
    const el = container.querySelector('#tagsCloud')
    if (el) el.innerHTML = '<span style="color:var(--text-muted)">标签加载失败</span>'
  })
}

function loadPosts(container, page, tag) {
  state.page = page
  state.tag = tag

  const grid = container.querySelector('#postGrid')
  const countEl = container.querySelector('#postCount')
  const pagEl = container.querySelector('#pagination')
  if (!grid) return

  grid.innerHTML = skeletonCards(6)

  fetchPosts({ tag, page, limit: 6 }).then(({ posts, total, pages }) => {
    state.total = total
    countEl.textContent = tag ? `${total} 篇（${tag}）` : `${total} 篇`

    if (posts.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:40px 0;text-align:center">该标签下暂无文章</p>'
    } else {
      // 第一页第一篇为精选大图
      const featuredIdx = (page === 1 && !tag) ? posts.findIndex(p => p.is_featured) : -1
      let html = ''
      if (featuredIdx >= 0) {
        html += postCard(posts[featuredIdx], { featured: true })
        posts.splice(featuredIdx, 1)
      }
      html += posts.map(p => postCard(p)).join('')
      grid.innerHTML = html
    }

    // 分页
    if (pages > 1) {
      let pagHtml = ''
      for (let i = 1; i <= pages; i++) {
        pagHtml += `<span class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</span>`
      }
      pagEl.innerHTML = `<div class="pagination-inner">${pagHtml}</div>`
      pagEl.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.dataset.page)
          loadPosts(container, p, tag)
          document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' })
        })
      })
    } else {
      pagEl.innerHTML = ''
    }
  }).catch(() => {
    // API 不可用：回退本地数据
    import('../data.js').then(({ posts, tags }) => {
      let filtered = posts
      if (tag) filtered = posts.filter(p => p.tag === tag)
      countEl.textContent = `${filtered.length} 篇`
      const featured = filtered.find(p => p.featured) || filtered[0]
      const rest = filtered.filter(p => p.id !== featured?.id)
      grid.innerHTML = featured
        ? postCard(featured, { featured: true }) + rest.map(p => postCard(p)).join('')
        : '<p style="color:var(--text-muted);grid-column:1/-1">暂无文章</p>'
      pagEl.innerHTML = ''
    })
  })
}

export default {
  render(container) { renderHome(container) },
  cleanup() {}
}
