import { postCard } from '../components/postCard.js'
import { site } from '../data.js'
import { fetchPost, likePost, unlikePost, bookmarkPost, unbookmarkPost, fetchPostStats, getUserKey, aiSummary, fetchComments, addComment, deleteComment, incrementView } from '../api.js'
import { highlightArticleCode } from '../utils/highlight.js'

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

// AI 摘要卡片：有缓存直接展示，否则给生成按钮
function aiSummaryHtml(post) {
  const slug = esc(post.slug)
  if (post.ai_summary) {
    return `
      <div class="ai-summary" id="aiSummaryBox">
        <div class="ai-summary-head">
          <span class="ai-spark">✦</span> AI 摘要
          <span class="ai-summary-meta">由本地大模型生成</span>
        </div>
        <p>${esc(post.ai_summary)}</p>
      </div>`
  }
  return `
    <div class="ai-summary" id="aiSummaryBox">
      <div class="ai-summary-head">
        <span class="ai-spark">✦</span> AI 摘要
        <span class="ai-summary-meta">由本地大模型生成</span>
      </div>
      <p class="ai-summary-empty" id="aiSummaryEmpty">
        这篇文章还没有 AI 摘要。
        <button class="btn btn-ghost ai-gen-btn" id="aiGenBtn">✦ 生成摘要</button>
      </p>
    </div>`
}

function bindAiSummary(container, post) {
  const btn = container.querySelector('#aiGenBtn')
  if (!btn) return
  btn.addEventListener('click', async () => {
    const box = container.querySelector('#aiSummaryEmpty')
    btn.disabled = true
    box.innerHTML = '<span class="ai-loading">✦ 本地大模型正在阅读全文，生成摘要中…</span>'
    try {
      const { summary } = await aiSummary(post.slug)
      box.outerHTML = `<p>${esc(summary)}</p>`
    } catch (err) {
      box.innerHTML = `摘要生成失败：${esc(err.message)} <button class="btn btn-ghost ai-gen-btn" id="aiGenBtn">重试</button>`
      bindAiSummary(container, post)
    }
  })
}

// ===== 评论区 =====
function commentsHtml(total) {
  return `
    <section class="comments" id="commentsSection">
      <div class="section-label">
        <h2>评论</h2>
        <span class="en" id="commentTotal">${total}</span>
      </div>
      <form class="comment-form" id="commentForm">
        <div class="comment-form-row">
          <input type="text" name="nickname" placeholder="昵称（必填）" maxlength="30" required />
        </div>
        <textarea name="content" rows="3" placeholder="说点什么…" maxlength="1000" required></textarea>
        <div class="comment-form-actions">
          <button type="submit" class="btn btn-primary">发表评论</button>
        </div>
      </form>
      <div class="comment-list" id="commentList">
        <p class="comment-empty">加载中…</p>
      </div>
    </section>`
}

function commentItemHtml(c) {
  const canDelete = !!localStorage.getItem('blog-token')
  return `
    <div class="comment-item" data-id="${c.id}">
      <div class="comment-head">
        <span class="comment-avatar">${esc(c.nickname.slice(0, 1).toUpperCase())}</span>
        <span class="comment-nick">${esc(c.nickname)}</span>
        <span class="comment-time">${(c.created_at || '').replace('T', ' ').slice(0, 16)}</span>
        ${canDelete ? '<span class="comment-del" title="删除">✕</span>' : ''}
      </div>
      <div class="comment-body">${esc(c.content)}</div>
    </div>`
}

function bindComments(container, postId) {
  const list = container.querySelector('#commentList')
  const totalEl = container.querySelector('#commentTotal')

  async function load() {
    try {
      const { comments, total } = await fetchComments(postId)
      totalEl.textContent = total
      list.innerHTML = comments.length
        ? comments.map(commentItemHtml).join('')
        : '<p class="comment-empty">还没有评论，坐个沙发？</p>'
      list.querySelectorAll('.comment-del').forEach(el => {
        el.addEventListener('click', async () => {
          if (!confirm('确定删除这条评论？')) return
          try { await deleteComment(el.closest('.comment-item').dataset.id); load() }
          catch (err) { alert(err.message) }
        })
      })
    } catch {
      list.innerHTML = '<p class="comment-empty">评论加载失败</p>'
    }
  }
  load()

  container.querySelector('#commentForm').addEventListener('submit', async e => {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      await addComment(postId, { nickname: fd.get('nickname').trim(), content: fd.get('content').trim() })
      e.target.reset()
      load()
    } catch (err) {
      alert(err.message)
    }
  })
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
          ${aiSummaryHtml(post)}
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
            <button class="action-btn" id="btnTts" title="AI 朗读（浏览器语音合成）">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              <span id="ttsLabel">朗读</span>
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

          ${commentsHtml(0)}
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
      // 代码高亮
      highlightArticleCode(body)

      // 代码块一键复制
      body.querySelectorAll('pre').forEach(pre => {
        if (pre.querySelector('.copy-btn')) return
        pre.style.position = 'relative'
        const btn = document.createElement('button')
        btn.className = 'copy-btn'
        btn.type = 'button'
        btn.textContent = '复制'
        btn.addEventListener('click', async () => {
          const code = pre.querySelector('code') || pre
          try {
            await navigator.clipboard.writeText(code.innerText)
            btn.textContent = '已复制 ✓'
          } catch {
            btn.textContent = '复制失败'
          }
          setTimeout(() => { btn.textContent = '复制' }, 1600)
        })
        pre.appendChild(btn)
      })

      // 图片灯箱
      body.addEventListener('click', e => {
        const img = e.target.closest('img')
        if (!img) return
        const overlay = document.createElement('div')
        overlay.className = 'lightbox'
        overlay.innerHTML = `<img src="${img.src}" alt="${img.alt || ''}" />`
        document.body.appendChild(overlay)
        overlay.addEventListener('click', () => overlay.remove())
        const onEsc = ev => { if (ev.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onEsc) } }
        document.addEventListener('keydown', onEsc)
      })

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

    // AI 摘要 + 评论区
    bindAiSummary(container, post)
    bindComments(container, post.id)

    // 浏览量去重上报（同一访客每篇每天只计一次）
    incrementView(post.id).then(({ view_count }) => {
      const vc = container.querySelector('#viewCount')
      if (vc) vc.textContent = `${view_count} 次浏览`
    }).catch(() => {})

    // AI 朗读（浏览器 speechSynthesis）
    const btnTts = container.querySelector('#btnTts')
    const ttsLabel = container.querySelector('#ttsLabel')
    btnTts.addEventListener('click', () => {
      const synth = window.speechSynthesis
      if (!synth) { ttsLabel.textContent = '不支持' ; return }
      if (synth.speaking) {
        synth.cancel()
        ttsLabel.textContent = '朗读'
        return
      }
      const plain = (post.title + '。' + post.excerpt + '。' + post.body_html)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 5000)
      const utter = new SpeechSynthesisUtterance(plain)
      utter.lang = 'zh-CN'
      utter.rate = 1.05
      const voice = synth.getVoices().find(v => v.lang.startsWith('zh')) 
      if (voice) utter.voice = voice
      utter.onend = () => { ttsLabel.textContent = '朗读' }
      ttsLabel.textContent = '停止'
      synth.speak(utter)
    })

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
