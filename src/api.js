// 前端 API 客户端 + 认证状态
// 同源请求：单进程模式下页面和 API 同在 3001，Vite 开发模式走 vite.config.js 里的代理
export const API_BASE = ''

let token = localStorage.getItem('blog-token')

function getToken() { return token }
function setToken(t) { token = t; t ? localStorage.setItem('blog-token', t) : localStorage.removeItem('blog-token') }
function clearToken() { setToken(null) }

// 访客唯一标识（不登录时用）
function getUserKey() {
  let key = localStorage.getItem('blog-user-key')
  if (!key) {
    key = 'vk_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    localStorage.setItem('blog-user-key', key)
  }
  return key
}

async function api(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  })

  const data = await res.json()

  if (res.status === 401) {
    clearToken()
    window.dispatchEvent(new CustomEvent('auth:expired'))
    throw new Error(data.error || '未登录')
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ===== 公开 API =====
export function fetchPosts({ tag, page, limit } = {}) {
  const params = new URLSearchParams()
  if (tag) params.set('tag', tag)
  if (page) params.set('page', page)
  if (limit) params.set('limit', limit)
  const qs = params.toString()
  return api(`/api/posts${qs ? '?' + qs : ''}`)
}
export function fetchPost(slug) { return api(`/api/posts/${slug}`) }
export function fetchTags() { return api('/api/tags') }
export function searchPosts(q) { return api(`/api/search?q=${encodeURIComponent(q)}`) }

// 点赞/收藏
export function likePost(id) { return api(`/api/posts/${id}/like`, 'POST', { user_key: getUserKey() }) }
export function unlikePost(id) { return api(`/api/posts/${id}/unlike`, 'POST', { user_key: getUserKey() }) }
export function bookmarkPost(id) { return api(`/api/posts/${id}/bookmark`, 'POST', { user_key: getUserKey() }) }
export function unbookmarkPost(id) { return api(`/api/posts/${id}/unbookmark`, 'POST', { user_key: getUserKey() }) }
export function fetchPostStats(id) { return api(`/api/posts/${id}/likes`) }

// ===== 认证 =====
export function login(username, password) {
  return api('/api/auth/login', 'POST', { username, password }).then(d => { setToken(d.token); return d.user })
}
export function register(username, password, displayName) {
  return api('/api/auth/register', 'POST', { username, password, displayName }).then(d => { setToken(d.token); return d.user })
}
export function fetchMe() { return api('/api/auth/me') }
export function changePassword(oldPwd, newPwd) {
  return api('/api/auth/password', 'PUT', { oldPassword: oldPwd, newPassword: newPwd })
}
export function logout() { clearToken() }

// ===== 管理 =====
export function createPost(data) { return api('/api/posts', 'POST', data) }
export function updatePost(id, data) { return api(`/api/posts/${id}`, 'PUT', data) }
export function deletePost(id) { return api(`/api/posts/${id}`, 'DELETE') }
export function toggleDraft(id) { return api(`/api/posts/${id}/draft`, 'PUT') }
export function createTag(name) { return api('/api/tags', 'POST', { name }) }
export function deleteTag(id) { return api(`/api/tags/${id}`, 'DELETE') }
export function fetchStats() { return api('/api/stats') }
export function fetchAdminPosts() { return api('/api/admin/posts') }

// ===== 评论 =====
export function fetchComments(postId) { return api(`/api/posts/${postId}/comments`) }
export function addComment(postId, { nickname, content }) {
  return api(`/api/posts/${postId}/comments`, 'POST', { nickname, content, user_key: getUserKey() })
}
export function deleteComment(id) { return api(`/api/comments/${id}`, 'DELETE') }
export function fetchAdminComments() { return api('/api/admin/comments') }

// ===== 归档 / 友链 =====
export function fetchArchive() { return api('/api/archive') }
export function fetchLinks() { return api('/api/links') }
export function createLink(data) { return api('/api/links', 'POST', data) }
export function deleteLink(id) { return api(`/api/links/${id}`, 'DELETE') }

// ===== 访问统计 =====
export function trackVisit(path) { return api('/api/track', 'POST', { user_key: getUserKey(), path }) }
export function fetchStatsChart() { return api('/api/stats/chart') }

// ===== 本地 AI =====
export function aiSummary(slug) { return api('/api/ai/summary', 'POST', { slug }) }
export function aiWrite(action, content) { return api('/api/ai/write', 'POST', { action, content }) }
export function aiDigest() { return api('/api/ai/digest', 'POST') }

// ===== 图片上传 =====
export function uploadImage(name, dataUrl) { return api('/api/upload', 'POST', { name, data: dataUrl }) }

// ===== 评论审核 / 定时发布 / 去重浏览 =====
export function approveComment(id) { return api(`/api/comments/${id}/approve`, 'PUT') }
export function incrementView(postId) { return api(`/api/posts/${postId}/view`, 'POST', { user_key: getUserKey() }) }

// ===== 关键词盯梢 =====
export function fetchWatch() { return api('/api/watch') }
export function addWatch(keyword) { return api('/api/watch', 'POST', { keyword }) }
export function deleteWatch(id) { return api(`/api/watch/${id}`, 'DELETE') }
export function fetchWatchMatches() { return api('/api/watch/matches') }

// ===== 热搜历史 =====
export function fetchHotDays() { return api('/api/hot/history/days') }
export function fetchHotHistory(day) { return api(`/api/hot/history?day=${encodeURIComponent(day)}`) }

// ===== 数据导出/导入 =====
export function exportData() { return api('/api/admin/export') }
export function importData(payload, mode = 'merge') { return api('/api/admin/import', 'POST', { ...payload, mode }) }

// ===== 站内 AI 问答 =====
export function askAi(question) { return api('/api/ask', 'POST', { question }) }

export { getToken, setToken, clearToken, getUserKey }
