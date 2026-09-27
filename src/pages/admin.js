import {
  fetchPosts, fetchTags, fetchStats, fetchAdminPosts,
  createPost, updatePost, deletePost, toggleDraft,
  createTag, deleteTag, logout, fetchMe, changePassword,
  aiWrite, aiDigest, uploadImage, fetchAdminComments, deleteComment,
  fetchLinks, createLink, deleteLink, fetchStatsChart
} from '../api.js'

function toast(msg, isError = false) {
  const el = document.createElement('div')
  el.className = 'toast' + (isError ? ' error' : '')
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2500)
}

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

// ===== 侧栏 =====
function sidebarHTML(user, active) {
  return `
    <div class="admin-sidebar">
      <div class="sidebar-brand">
        指挥官
        <span class="en">Admin Panel</span>
      </div>
      <a href="#/admin" class="${active === 'dashboard' ? 'active' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        仪表盘
      </a>
      <a href="#/admin/posts" class="${active === 'posts' ? 'active' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        文章管理
      </a>
      <a href="#/admin/tags" class="${active === 'tags' ? 'active' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        标签管理
      </a>
      <a href="#/admin/comments" class="${active === 'comments' ? 'active' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        评论管理
      </a>
      <a href="#/admin/links" class="${active === 'links' ? 'active' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        友链管理
      </a>
      <a href="#/admin/settings" class="${active === 'settings' ? 'active' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>
        账户设置
      </a>
      <div class="sidebar-footer">
        <div class="user-name">${esc(user?.displayName || user?.username || '')}</div>
        <span class="logout-btn" id="logoutBtn">退出登录</span>
      </div>
    </div>
  `
}

// ===== 仪表盘 =====
async function renderDashboard(container, user) {
  container.innerHTML = `
    <div class="admin-layout">
      ${sidebarHTML(user, 'dashboard')}
      <div class="admin-main">
        <h1>仪表盘</h1>
        <div class="stats-row" id="statsRow">
          <div class="stat-card"><div class="stat-value">…</div><div class="stat-label">加载中</div></div>
        </div>
        <div class="editor-panel" style="margin-top:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h2 style="font-family:var(--font-serif);font-size:18px;margin:0">近 30 天访问趋势 <span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono)">PV / UV</span></h2>
            <button class="btn btn-ghost" id="digestBtn" title="调用本地大模型，把今天的 AI 资讯写成文章发布">✦ 生成今日 AI 日报</button>
          </div>
          <canvas id="statsChart" height="220" style="width:100%"></canvas>
          <div class="chart-legend">
            <span><i class="legend-dot" style="background:var(--accent)"></i>PV 浏览</span>
            <span><i class="legend-dot" style="background:var(--green)"></i>UV 独立访客</span>
          </div>
        </div>
        <div id="dashContent"></div>
      </div>
    </div>
  `

  document.querySelector('#logoutBtn').addEventListener('click', () => { logout(); window.location.hash = '/' })

  // AI 日报（手动触发）
  container.querySelector('#digestBtn')?.addEventListener('click', async e => {
    const btn = e.currentTarget
    btn.disabled = true
    btn.textContent = '✦ 生成中，模型写作需要一两分钟…'
    try {
      const d = await aiDigest()
      toast(d.message)
    } catch (err) { toast(err.message, true) }
    btn.disabled = false
    btn.textContent = '✦ 生成今日 AI 日报'
  })

  // 近 30 天 PV/UV 折线图（纯 canvas，零依赖）
  function drawChart(chart) {
    const canvas = container.querySelector('#statsChart')
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth || 600
    const H = 220
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const padL = 36, padR = 10, padT = 12, padB = 24
    const maxVal = Math.max(10, ...chart.map(d => Math.max(d.pv, d.uv)))
    const x = i => padL + (i / Math.max(1, chart.length - 1)) * (W - padL - padR)
    const y = v => padT + (1 - v / maxVal) * (H - padT - padB)
    const styles = getComputedStyle(document.documentElement)
    const accent = styles.getPropertyValue('--accent').trim() || '#d4a962'
    const green = styles.getPropertyValue('--green').trim() || '#8fb98a'
    const border = styles.getPropertyValue('--border').trim() || '#352e28'
    const muted = styles.getPropertyValue('--text-muted').trim() || '#7a7062'

    ctx.clearRect(0, 0, W, H)
    ctx.font = '10px monospace'
    ctx.fillStyle = muted
    // 横向网格
    for (let g = 0; g <= 4; g++) {
      const gy = padT + (g / 4) * (H - padT - padB)
      ctx.strokeStyle = border
      ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillText(String(Math.round(maxVal * (1 - g / 4))), 4, gy + 3)
    }
    // 日期刻度（每 7 天）
    chart.forEach((d, i) => {
      if (i % 7 === 0) ctx.fillText(d.day, x(i) - 10, H - 6)
    })

    const line = (key, color) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.8
      ctx.beginPath()
      chart.forEach((d, i) => { i === 0 ? ctx.moveTo(x(i), y(d[key])) : ctx.lineTo(x(i), y(d[key])) })
      ctx.stroke()
      ctx.fillStyle = color
      chart.forEach((d, i) => { ctx.beginPath(); ctx.arc(x(i), y(d[key]), 2, 0, 7); ctx.fill() })
    }
    line('pv', accent)
    line('uv', green)
  }

  try {
    const stats = await fetchStats()
    container.querySelector('#statsRow').innerHTML = `
      <div class="stat-card"><div class="stat-value">${stats.postCount}</div><div class="stat-label">已发布</div></div>
      <div class="stat-card"><div class="stat-value">${stats.draftCount || 0}</div><div class="stat-label">草稿</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalViews || 0}</div><div class="stat-label">总浏览量</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalLikes || 0}</div><div class="stat-label">总点赞</div></div>
      <div class="stat-card"><div class="stat-value">${stats.tagCount}</div><div class="stat-label">标签</div></div>
    `

    let html = ''

    // 最近文章
    if (stats.recentPosts?.length) {
      html += `
      <h2 style="font-family:var(--font-serif);font-size:18px;margin-bottom:16px">最近文章</h2>
      <table class="admin-table">
        <thead><tr><th>标题</th><th>标签</th><th>状态</th><th>浏览</th><th>日期</th></tr></thead>
        <tbody>
          ${stats.recentPosts.map(p => `
            <tr>
              <td class="post-title-cell">${esc(p.title)}</td>
              <td><span class="tag">${esc(p.tag)}</span></td>
              <td>${p.is_draft ? '<span class="draft-badge">草稿</span>' : '<span class="pub-badge">已发布</span>'}</td>
              <td style="font-family:var(--font-mono);font-size:13px">${p.view_count || 0}</td>
              <td style="font-family:var(--font-mono);font-size:13px">${(p.created_at||'').slice(0,10)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    }

    // 热门文章
    if (stats.topViewed?.length && stats.topViewed.some(p => p.view_count > 0)) {
      html += `
      <h2 style="font-family:var(--font-serif);font-size:18px;margin:28px 0 16px">热门文章</h2>
      <table class="admin-table">
        <thead><tr><th>标题</th><th>浏览量</th></tr></thead>
        <tbody>
          ${stats.topViewed.map((p, i) => `
            <tr>
              <td class="post-title-cell">${i + 1}. ${esc(p.title)}</td>
              <td style="font-family:var(--font-mono);font-size:13px">${p.view_count}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    }

    container.querySelector('#dashContent').innerHTML = html

    // 图表数据
    fetchStatsChart().then(d => drawChart(d.chart)).catch(() => {})
  } catch (err) {
    container.querySelector('#statsRow').innerHTML = `<div class="stat-card"><div class="stat-value" style="font-size:16px">加载失败</div><div class="stat-label">${esc(err.message)}</div></div>`
  }
}

// ===== 文章管理 =====
async function renderPosts(container, user, { editingId = null } = {}) {
  container.innerHTML = `
    <div class="admin-layout">
      ${sidebarHTML(user, 'posts')}
      <div class="admin-main">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px">
          <h1 style="margin-bottom:0">${editingId ? '编辑文章' : '文章管理'}</h1>
          ${!editingId ? '<button class="btn btn-primary" id="newPostBtn">+ 新建文章</button>' : '<button class="btn btn-ghost" id="backToPosts">← 返回列表</button>'}
        </div>
        <div id="contentArea"></div>
      </div>
    </div>
  `
  document.querySelector('#logoutBtn').addEventListener('click', () => { logout(); window.location.hash = '/' })

  const content = container.querySelector('#contentArea')

  if (!editingId) {
    content.innerHTML = '<p style="color:var(--text-muted)">加载中…</p>'
    try {
      // 用 admin API 获取所有文章（含草稿）
      const { posts } = await fetchAdminPosts()
      content.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>标题</th><th>标签</th><th>状态</th><th>浏览</th><th>日期</th><th>操作</th></tr></thead>
          <tbody>
            ${posts.map(p => `
              <tr>
                <td class="post-title-cell">${esc(p.title)}</td>
                <td><span class="tag">${esc(p.tag)}</span></td>
                <td>${p.is_draft ? '<span class="draft-badge">草稿</span>' : '<span class="pub-badge">已发布</span>'}</td>
                <td style="font-family:var(--font-mono);font-size:13px">${p.view_count || 0}</td>
                <td style="font-family:var(--font-mono);font-size:13px">${(p.created_at||'').slice(0,10)}</td>
                <td>
                  <div class="action-btns">
                    <button class="action-btn" data-action="edit" data-id="${p.id}">编辑</button>
                    <button class="action-btn" data-action="view" data-slug="${p.slug}">预览</button>
                    <button class="action-btn" data-action="draft" data-id="${p.id}" data-draft="${p.is_draft}">${p.is_draft ? '发布' : '存草稿'}</button>
                    <button class="action-btn danger" data-action="delete" data-id="${p.id}">删除</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      `

      content.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const { action, id, slug, draft } = btn.dataset
          if (action === 'edit') window.location.hash = `/admin/posts/${id}`
          if (action === 'view') window.location.hash = `/post/${slug}`
          if (action === 'draft') {
            try {
              await toggleDraft(id)
              toast(draft === '1' ? '已发布' : '已存为草稿')
              renderPosts(container, user)
            } catch (err) { toast(err.message, true) }
          }
          if (action === 'delete') {
            if (!confirm('确定删除这篇文章？此操作不可撤销。')) return
            try { await deletePost(id); toast('已删除'); renderPosts(container, user) }
            catch (err) { toast(err.message, true) }
          }
        })
      })

      container.querySelector('#newPostBtn').addEventListener('click', () => {
        window.location.hash = '/admin/posts/new'
      })
    } catch (err) {
      content.innerHTML = `<p style="color:#e07070">${esc(err.message)}</p>`
    }
  } else {
    // 编辑/新建表单
    const isNew = editingId === 'new'
    let post = null
    if (!isNew) {
      try {
        const d = await fetchAdminPosts()
        post = d.posts.find(p => p.id === parseInt(editingId))
      } catch (err) {
        content.innerHTML = `<p style="color:#e07070">${esc(err.message)}</p>`
        return
      }
      if (!post) { content.innerHTML = '<p>文章不存在</p>'; return }
    }

    let tagList = []
    try { const d = await fetchTags(); tagList = d.tags.map(t => t.name) } catch {}

    content.innerHTML = `
      <div class="editor-panel">
        <h2>${isNew ? '新建文章' : '编辑：' + esc(post?.title || '')}</h2>
        <form id="postForm">
          <div class="form-group">
            <label>标题</label>
            <input type="text" name="title" value="${esc(post?.title || '')}" required />
          </div>
          <div class="form-group">
            <label>标签</label>
            <input type="text" name="tag" value="${esc(post?.tag || '')}" list="tagList" required />
            <datalist id="tagList">${tagList.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
          </div>
          <div class="form-group">
            <label>摘要</label>
            <textarea name="excerpt" rows="3" placeholder="一两句话概括">${esc(post?.excerpt || '')}</textarea>
          </div>
          <div class="form-group">
            <label>正文（HTML）</label>
            <div class="editor-toolbar">
              <span class="toolbar-label">✦ AI 助手</span>
              <button type="button" class="tool-btn" data-ai="polish" title="润色正文">润色</button>
              <button type="button" class="tool-btn" data-ai="continue" title="接着正文续写">续写</button>
              <button type="button" class="tool-btn" data-ai="title" title="根据正文生成候选标题">起标题</button>
              <button type="button" class="tool-btn" data-ai="tags" title="根据正文推荐标签">荐标签</button>
              <button type="button" class="tool-btn" data-ai="excerpt" title="生成一句摘要">写摘要</button>
              <span style="flex:1"></span>
              <button type="button" class="tool-btn" id="imgUploadBtn" title="上传图片并插入到正文">🖼 插图</button>
              <input type="file" id="imgInput" accept="image/*" hidden />
            </div>
            <textarea name="body" rows="16" required>${esc(post?.body_html || '')}</textarea>
          </div>
          <div class="form-group" style="display:flex;gap:20px;align-items:center">
            <label style="margin:0;display:flex;align-items:center;gap:6px">
              <input type="checkbox" name="featured" ${post?.is_featured ? 'checked' : ''} />
              精选
            </label>
            <label style="margin:0;display:flex;align-items:center;gap:6px">
              <input type="checkbox" name="draft" ${post?.is_draft ? 'checked' : ''} />
              草稿（不公开）
            </label>
          </div>
          <div class="editor-actions">
            <button type="button" class="btn btn-ghost" id="cancelBtn">${isNew ? '取消' : '返回列表'}</button>
            <button type="submit" class="btn btn-primary">${isNew ? '创建文章' : '保存修改'}</button>
          </div>
        </form>
      </div>
    `

    const form = content.querySelector('#postForm')
    content.querySelector('#cancelBtn').addEventListener('click', () => { window.location.hash = '/admin/posts' })
    container.querySelector('#backToPosts')?.addEventListener('click', () => { window.location.hash = '/admin/posts' })

    // ===== 编辑器 AI 助手 =====
    const bodyTa = form.querySelector('textarea[name=body]')
    const titleInput = form.querySelector('input[name=title]')
    const tagInput = form.querySelector('input[name=tag]')
    const excerptTa = form.querySelector('textarea[name=excerpt]')
    let aiBusy = false

    form.querySelectorAll('.tool-btn[data-ai]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (aiBusy) return
        const action = btn.dataset.ai
        const content = bodyTa.value.trim()
        if (!content) { toast('正文是空的，先写点什么', true); return }
        aiBusy = true
        const old = btn.textContent
        btn.textContent = '…'
        try {
          const { result } = await aiWrite(action, content)
          if (action === 'polish') {
            bodyTa.value = result
            toast('已润色，请检查后保存')
          } else if (action === 'continue') {
            bodyTa.value = bodyTa.value.replace(/\s*$/, '\n') + '\n' + result
            toast('已续写追加到正文末尾')
          } else if (action === 'title') {
            const candidates = result.split('\n').map(s => s.replace(/^[\d.、\-\s]+/, '').trim()).filter(Boolean)
            const pick = prompt('候选标题（输入序号或直接改）：\n' + candidates.map((t, i) => `${i + 1}. ${t}`).join('\n'), candidates[0] || '')
            if (pick) titleInput.value = pick
          } else if (action === 'tags') {
            const candidates = result.split('\n').map(s => s.replace(/^[\d.、\-\s]+/, '').trim()).filter(Boolean)
            const pick = prompt('推荐标签：\n' + candidates.join('\n') + '\n\n输入想用的标签：', candidates[0] || tagInput.value)
            if (pick) tagInput.value = pick
          } else if (action === 'excerpt') {
            excerptTa.value = result
            toast('摘要已生成')
          }
        } catch (err) {
          toast(err.message, true)
        }
        btn.textContent = old
        aiBusy = false
      })
    })

    // ===== 图片上传（base64 → /uploads/） =====
    const imgInput = form.querySelector('#imgInput')
    form.querySelector('#imgUploadBtn').addEventListener('click', () => imgInput.click())
    imgInput.addEventListener('change', async () => {
      const file = imgInput.files[0]
      if (!file) return
      if (file.size > 6 * 1024 * 1024) { toast('图片请小于 6MB', true); return }
      const btn = form.querySelector('#imgUploadBtn')
      const old = btn.textContent
      btn.textContent = '上传中…'
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result)
          r.onerror = reject
          r.readAsDataURL(file)
        })
        const { url } = await uploadImage(file.name, dataUrl)
        const tag = `![${file.name.replace(/\.[^.]+$/, '')}](${url})`
        const pos = bodyTa.selectionStart ?? bodyTa.value.length
        bodyTa.value = bodyTa.value.slice(0, pos) + tag + bodyTa.value.slice(pos)
        toast(`已上传并插入：${url}`)
      } catch (err) {
        toast(err.message, true)
      }
      btn.textContent = old
      imgInput.value = ''
    })

    form.addEventListener('submit', async e => {
      e.preventDefault()
      const fd = new FormData(form)
      const data = {
        title: fd.get('title').trim(),
        tag: fd.get('tag').trim(),
        excerpt: fd.get('excerpt')?.trim() || '',
        body: fd.get('body'),
        isFeatured: fd.get('featured') === 'on',
        isDraft: fd.get('draft') === 'on'
      }
      try {
        if (isNew) {
          await createPost(data)
          toast('文章已创建')
        } else {
          await updatePost(post.id, data)
          toast('文章已更新')
        }
        window.location.hash = '/admin/posts'
      } catch (err) {
        toast(err.message, true)
      }
    })
  }
}

// ===== 标签管理 =====
async function renderTags(container, user) {
  container.innerHTML = `
    <div class="admin-layout">
      ${sidebarHTML(user, 'tags')}
      <div class="admin-main">
        <h1>标签管理</h1>
        <div class="form-group" style="max-width:320px;margin-bottom:24px">
          <input type="text" id="newTagInput" placeholder="输入新标签名…" />
        </div>
        <div id="tagList" class="tag-admin-list"></div>
      </div>
    </div>
  `
  document.querySelector('#logoutBtn').addEventListener('click', () => { logout(); window.location.hash = '/' })

  async function loadTags() {
    try {
      const { tags } = await fetchTags()
      container.querySelector('#tagList').innerHTML = tags.map(t => `
        <div class="tag-admin-item">
          ${esc(t.name)}
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${t.count}</span>
          ${t.count === 0 ? `<span class="tag-del" data-id="${t.id}" title="删除">✕</span>` : ''}
        </div>`).join('')

      container.querySelectorAll('.tag-del').forEach(el => {
        el.addEventListener('click', async () => {
          try { await deleteTag(el.dataset.id); toast('已删除'); loadTags() }
          catch (err) { toast(err.message, true) }
        })
      })
    } catch (err) {
      container.querySelector('#tagList').innerHTML = `<p style="color:#e07070">${esc(err.message)}</p>`
    }
  }
  loadTags()

  container.querySelector('#newTagInput').addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return
    const name = e.target.value.trim()
    if (!name) return
    try { await createTag(name); toast('已添加'); e.target.value = ''; loadTags() }
    catch (err) { toast(err.message, true) }
  })
}

// ===== 账户设置 =====
async function renderSettings(container, user) {
  container.innerHTML = `
    <div class="admin-layout">
      ${sidebarHTML(user, 'settings')}
      <div class="admin-main">
        <h1>账户设置</h1>

        <div class="editor-panel" style="max-width:420px">
          <h2 style="font-family:var(--font-serif);font-size:18px;margin-bottom:20px">修改密码</h2>
          <form id="pwdForm">
            <div class="form-group">
              <label>旧密码</label>
              <input type="password" name="old" required />
            </div>
            <div class="form-group">
              <label>新密码</label>
              <input type="password" name="new" required minlength="6" />
            </div>
            <div class="form-group">
              <label>确认新密码</label>
              <input type="password" name="confirm" required minlength="6" />
            </div>
            <button type="submit" class="btn btn-primary">更新密码</button>
          </form>
        </div>

        <div class="editor-panel" style="max-width:420px;margin-top:24px">
          <h2 style="font-family:var(--font-serif);font-size:18px;margin-bottom:16px">账户信息</h2>
          <table class="admin-table">
            <tbody>
              <tr><td>用户名</td><td style="font-family:var(--font-mono)">${esc(user?.username || '')}</td></tr>
              <tr><td>显示名</td><td>${esc(user?.displayName || '')}</td></tr>
              <tr><td>角色</td><td>${esc(user?.role || '')}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
  document.querySelector('#logoutBtn').addEventListener('click', () => { logout(); window.location.hash = '/' })

  container.querySelector('#pwdForm')?.addEventListener('submit', async e => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const oldP = fd.get('old'), newP = fd.get('new'), confirmP = fd.get('confirm')
    if (newP !== confirmP) { toast('两次新密码不一致', true); return }
    try {
      await changePassword(oldP, newP)
      toast('密码已更新')
      e.target.reset()
    } catch (err) {
      toast(err.message, true)
    }
  })
}

// ===== 评论管理 =====
async function renderComments(container, user) {
  container.innerHTML = `
    <div class="admin-layout">
      ${sidebarHTML(user, 'comments')}
      <div class="admin-main">
        <h1>评论管理</h1>
        <div id="contentArea"><p style="color:var(--text-muted)">加载中…</p></div>
      </div>
    </div>
  `
  document.querySelector('#logoutBtn').addEventListener('click', () => { logout(); window.location.hash = '/' })

  const content = container.querySelector('#contentArea')
  try {
    const { comments } = await fetchAdminComments()
    content.innerHTML = comments.length ? `
      <table class="admin-table">
        <thead><tr><th>内容</th><th>昵称</th><th>文章</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>
          ${comments.map(c => `
            <tr>
              <td style="max-width:360px">${esc(c.content)}</td>
              <td>${esc(c.nickname)}</td>
              <td class="post-title-cell"><a href="#/post/${esc(c.post_slug || '')}">${esc(c.post_title || '已删除')}</a></td>
              <td style="font-family:var(--font-mono);font-size:12px">${(c.created_at || '').replace('T', ' ').slice(0, 16)}</td>
              <td><button class="action-btn danger" data-id="${c.id}">删除</button></td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<div class="empty-state"><div class="icon">∅</div><p>还没有评论</p></div>'

    content.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确定删除这条评论？')) return
        try { await deleteComment(btn.dataset.id); toast('已删除'); renderComments(container, user) }
        catch (err) { toast(err.message, true) }
      })
    })
  } catch (err) {
    content.innerHTML = `<p style="color:#e07070">${esc(err.message)}</p>`
  }
}

// ===== 友链管理 =====
async function renderLinksAdmin(container, user) {
  container.innerHTML = `
    <div class="admin-layout">
      ${sidebarHTML(user, 'links')}
      <div class="admin-main">
        <h1>友链管理</h1>
        <div class="editor-panel" style="max-width:480px;margin-bottom:24px">
          <form id="linkForm" style="display:grid;gap:12px">
            <div class="form-group" style="margin:0"><label>名称</label><input name="name" required maxlength="30" /></div>
            <div class="form-group" style="margin:0"><label>链接</label><input name="url" required placeholder="https://…" /></div>
            <div class="form-group" style="margin:0"><label>描述（可选）</label><input name="description" maxlength="60" /></div>
            <button type="submit" class="btn btn-primary">添加友链</button>
          </form>
        </div>
        <div id="linkList"></div>
      </div>
    </div>
  `
  document.querySelector('#logoutBtn').addEventListener('click', () => { logout(); window.location.hash = '/' })

  const list = container.querySelector('#linkList')
  async function load() {
    const { links } = await fetchLinks()
    list.innerHTML = links.length ? `
      <table class="admin-table">
        <thead><tr><th>名称</th><th>链接</th><th>描述</th><th>操作</th></tr></thead>
        <tbody>
          ${links.map(l => `
            <tr>
              <td>${esc(l.name)}</td>
              <td style="font-family:var(--font-mono);font-size:12px"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a></td>
              <td>${esc(l.description || '')}</td>
              <td><button class="action-btn danger" data-id="${l.id}">删除</button></td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<p style="color:var(--text-muted)">还没有友链</p>'

    list.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { await deleteLink(btn.dataset.id); toast('已删除'); load() }
        catch (err) { toast(err.message, true) }
      })
    })
  }
  load()

  container.querySelector('#linkForm').addEventListener('submit', async e => {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      await createLink({ name: fd.get('name').trim(), url: fd.get('url').trim(), description: fd.get('description').trim() })
      toast('已添加'); e.target.reset(); load()
    } catch (err) { toast(err.message, true) }
  })
}

// ===== 路由分发 =====
export default {
  render(container, params) {
    if (!localStorage.getItem('blog-token')) {
      window.location.hash = '/login'
      return
    }

    fetchMe().then(({ user }) => {
      const sub = params.sub || 'dashboard'
      const postId = params.id
      if (sub === 'posts') {
        if (postId) renderPosts(container, user, { editingId: postId })
        else renderPosts(container, user)
      } else if (sub === 'tags') {
        renderTags(container, user)
      } else if (sub === 'comments') {
        renderComments(container, user)
      } else if (sub === 'links') {
        renderLinksAdmin(container, user)
      } else if (sub === 'settings') {
        renderSettings(container, user)
      } else {
        renderDashboard(container, user)
      }
    }).catch(() => {
      window.location.hash = '/login'
    })
  },
  cleanup() {}
}
