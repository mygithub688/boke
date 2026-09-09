import {
  fetchPosts, fetchTags, fetchStats, fetchAdminPosts,
  createPost, updatePost, deletePost, toggleDraft,
  createTag, deleteTag, logout, fetchMe, changePassword
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
        <div id="dashContent"></div>
      </div>
    </div>
  `

  document.querySelector('#logoutBtn').addEventListener('click', () => { logout(); window.location.hash = '/' })

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

    // 修改密码
    html += `
      <h2 style="font-family:var(--font-serif);font-size:18px;margin:28px 0 16px">修改密码</h2>
      <div class="editor-panel" style="max-width:400px">
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
      </div>`

    container.querySelector('#dashContent').innerHTML = html

    // 修改密码
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
      } else {
        renderDashboard(container, user)
      }
    }).catch(() => {
      window.location.hash = '/login'
    })
  },
  cleanup() {}
}
