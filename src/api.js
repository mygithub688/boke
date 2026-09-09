// 前端 API 客户端 + 认证状态
const API_BASE = 'http://localhost:3001'

let token = localStorage.getItem('blog-token')

function getToken() { return token }
function setToken(t) { token = t; t ? localStorage.setItem('blog-token', t) : localStorage.removeItem('blog-token') }
function clearToken() { setToken(null) }

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

// 公开 API
export function fetchPosts() { return api('/api/posts') }
export function fetchPost(slug) { return api(`/api/posts/${slug}`) }
export function fetchTags() { return api('/api/tags') }

// 认证
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

// 管理
export function createPost(data) { return api('/api/posts', 'POST', data) }
export function updatePost(id, data) { return api(`/api/posts/${id}`, 'PUT', data) }
export function deletePost(id) { return api(`/api/posts/${id}`, 'DELETE') }
export function createTag(name) { return api('/api/tags', 'POST', { name }) }
export function deleteTag(id) { return api(`/api/tags/${id}`, 'DELETE') }
export function fetchStats() { return api('/api/stats') }

export { getToken, setToken, clearToken }
