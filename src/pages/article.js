import { postCard } from '../components/postCard.js'
import { site } from '../data.js'
import { fetchPost, likePost, unlikePost, bookmarkPost, unbookmarkPost, fetchPostStats, getUserKey } from '../api.js'

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

// 从 HTML 中提取 h2/h3 生成目录
function buildToc(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const headings = doc.querySelectorAll('h2, h3')
  if (headings.length < 2) return ''
  const items = []
  headings.forEach((h, i) => {
    const id = `toc-${i}`
    const level = h.tagName === 'h2' ? 2 : 3
    const text = h.textContent.trim()
    items.push(`<a class="toc-item toc-l${level}" data-target="${id}" href="#${id}">${esc(text)}</a>`)
  })
  return `
    <nav class="toc" id="toc">
      <div class="toc-title">目录</div>
      ${items.join('')}
    </nav>
  `
}

function renderArticle(container, { id }) {
  container.innerHTML = `
    <div class="page narrow">
      <div style="text-align:center;padding:80px 0;color:var(--text-muted)">
        <div class="skeleton-line" style="width:60%;height:8px;margin:0 auto 16px"></div>
        <div class="skeleton-line" style="width:90%;height:28px;margin:0 auto 16px"></div>
        <div class="skeleton-line" style="width:45%;height:14px;margin:0 auto 32px"></div>
        <div class="skeleton-line" style="width:100%;height:14px;margin:0 auto 8px"></div>
        <div class="skeleton-line" style="width:95%;height:14px;margin:0 auto 8px"></div>
        <div class="skeleton-line" style="width:80%;height:14px;margin:0 auto"></div>
      </div>
    </div>
    ${footerHTML()}`

  fetchPost(id).then(({ post, related }) => {
    const dateFmt = (post.created_at || '').replace('T', ' ').slice(0, 10)
    const readMin = Math.max(1, Math.round(post.body_html.length / 800))
    const tocHtml = buildToc(post.body_html)

    container.innerHTML = `
      <div class="article-layout">
        <div class="page narrow article-main">
          <div class="article-head anim-up">
            <div class="post-meta">
              <span class="tag">${esc(post.tag)}</span>
              <span>${dateFmt}</span>
              <span>·</span>
              <span>约 ${readMin} 分钟</span>
              <span>·</span>
              <span id="viewCount">${post.view_count || 0} 次浏览</span>
            </div>
            <h1 class="article-title">${esc(post.title)}</h1>
            <p class="article-lead">${esc(post.excerpt)}</p>
          </div>
          <div class="article-body anim-fade" id="articleBody">${post.body_html}</div>

          <div class="article-actions">
            <button class="action-btn" id="btnLike" title="点赞">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span id="likeCount">0</span>
            </button>
            <button class="action-btn" id="btnBookmark" title="收藏">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span id="bmCount">0</span>
            </button>
          </div>

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
        <aside class="article-toc">
          ${tocHtml}
        </aside>
      </div>
      ${footerHTML()}
    `

    // 给 h2/h3 加 id
    const body = container.querySelector('#articleBody')
    if (body) {
      const headings = body.querySelectorAll('h2, h3')
      headings.forEach((h, i) => { h.id = `toc-${i}` })

      // 目录高亮
      const tocItems = container.querySelectorAll('.toc-item')
      const onScroll = () => {
        let current = null
        headings.forEach((h, i) => {
          if (h.getBoundingClientRect().top <= 120) current = i
        })
        tocItems.forEach((item, i) => {
          item.classList.toggle('active', current === i)
        })
      }
      window.addEventListener('scroll', onScroll, { passive: true })

      // 目录点击平滑滚动
      tocItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault()
          const target = container.querySelector(`#${item.dataset.target}`)
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })
    }

    // 点赞/收藏
    const postId = post.id
    const btnLike = container.querySelector('#btnLike')
    const btnBookmark = container.querySelector('#btnBookmark')
    let liked = false, bookmarked = false

    // 获取当前状态
    fetchPostStats(postId).then(({ like_count, bookmark_count }) => {
      container.querySelector('#likeCount').textContent = like_count
      container.querySelector('#bmCount').textContent = bookmark_count
    }).catch(() => {})

    // 检查本地是否已点赞
    const likedKey = 'liked-' + postId
    const bmKey = 'bm-' + postId
    liked = localStorage.getItem(likedKey) === '1'
    bookmarked = localStorage.getItem(bmKey) === '1'
    if (liked) btnLike.classList.add('active')
    if (bookmarked) btnBookmark.classList.add('active')

    btnLike.addEventListener('click', () => {
      if (liked) {
        unlikePost(postId).then(d => {
          liked = false
          btnLike.classList.remove('active')
          localStorage.removeItem(likedKey)
          container.querySelector('#likeCount').textContent = d.like_count
        }).catch(() => {})
      } else {
        likePost(postId).then(d => {
          liked = true
          btnLike.classList.add('active')
          localStorage.setItem(likedKey, '1')
          container.querySelector('#likeCount').textContent = d.like_count
        }).catch(() => {})
      }
    })

    btnBookmark.addEventListener('click', () => {
      if (bookmarked) {
        unbookmarkPost(postId).then(d => {
          bookmarked = false
          btnBookmark.classList.remove('active')
          localStorage.removeItem(bmKey)
          container.querySelector('#bmCount').textContent = d.bookmark_count
        }).catch(() => {})
      } else {
        bookmarkPost(postId).then(d => {
          bookmarked = true
          btnBookmark.classList.add('active')
          localStorage.setItem(bmKey, '1')
          container.querySelector('#bmCount').textContent = d.bookmark_count
        }).catch(() => {})
      }
    })

    // 阅读进度条
    const bar = document.createElement('div')
    bar.className = 'read-progress'
    document.body.appendChild(bar)
    const onProgress = () => {
      const h = document.documentElement
      const total = h.scrollHeight - h.clientHeight
      bar.style.width = (total > 0 ? (h.scrollTop / total) * 100 : 0) + '%'
    }
    window.addEventListener('scroll', onProgress, { passive: true })

    return function cleanup() {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onProgress)
      bar.remove()
    }
  }).catch(err => {
    import('../data.js').then(({ posts }) => {
      const post = posts.find(p => p.id === id)
      if (!post) {
        container.innerHTML = `<div class="page narrow"><div class="empty-state"><div class="icon">∅</div><p>文章不存在</p></div></div>${footerHTML()}`
        return
      }
      const related = posts.filter(p => p.id !== id).slice(0, 3)
      const dateFmt = post.date
      container.innerHTML = `
        <div class="article-layout">
        <div class="page narrow article-main">
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
          <div class="article-actions">
            <button class="action-btn" disabled title="API 不可用"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>—</span></button>
            <button class="action-btn" disabled title="API 不可用"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>—</span></button>
          </div>
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
