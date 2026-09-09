// 前端 API 客户端 + 认证状态
export const API_BASE = 'http://localhost:3008'

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

export { getToken, setToken, clearToken, getUserKey }
