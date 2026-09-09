// 轻量 hash router · 无需 vue/react
import { onPageRender } from './effects.js'
const routes = {
  '/': () => import('./pages/home.js'),
  '/post/:id': () => import('./pages/article.js'),
  '/about': () => import('./pages/about.js'),
  '/hot': () => import('./pages/hot.js'),
  '/ainews': () => import('./pages/ainews.js'),
  '/search': () => import('./pages/search.js'),
  '/login': () => import('./pages/auth.js'),
  '/register': () => import('./pages/auth.js'),
  '/admin': () => import('./pages/admin.js'),
  '/admin/posts': () => import('./pages/admin.js'),
  '/admin/posts/new': () => import('./pages/admin.js'),
  '/admin/posts/:id': () => import('./pages/admin.js'),
  '/admin/tags': () => import('./pages/admin.js'),
  '/admin/settings': () => import('./pages/admin.js'),
}

const app = document.getElementById('app')
let currentComponent = null

export function navigate(path) {
  if (window.location.hash.slice(1) === path) return
  window.location.hash = path
}

export function useRoute() {
  const hash = window.location.hash.slice(1) || '/'
  const parts = hash.split('?')[0].split('/')
  for (const [pattern, loader] of Object.entries(routes)) {
    const patternParts = pattern.split('/')
    if (patternParts.length !== parts.length) continue
    let match = true
    const params = {}
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(parts[i])
      } else if (patternParts[i] !== parts[i]) {
        match = false
        break
      }
    }
    if (match) return { pattern, params, loader }
  }
  return null
}

export async function render() {
  const route = useRoute()
  const key = route ? route.pattern : '404'

  // 导航高亮
  updateNav(key)

  if (!route) {
    // 使用专门的 404 页面
    import('./pages/404.js').then(mod => {
      const hash = window.location.hash.slice(1)
      const path = hash.split('?')[0]
      mod.default.render(app, { path })
      requestAnimationFrame(onPageRender)
    })
    return
  }

  const mod = await route.loader()
  const C = mod.default
  if (currentComponent && currentComponent.cleanup) currentComponent.cleanup()
  currentComponent = C

  // 给 admin 路由传 sub 参数
  const params = { ...route.params }
  if (key === '/admin') params.sub = 'dashboard'
  else if (key === '/admin/posts') params.sub = 'posts'
  else if (key === '/admin/posts/:id') { params.sub = 'posts'; params.id = params.id }
  else if (key === '/admin/tags') params.sub = 'tags'
  else if (key === '/admin/settings') params.sub = 'settings'

  const cleanup = C.render(app, params)
  if (typeof cleanup === 'function') currentComponent.cleanup = cleanup

  window.scrollTo(0, 0)

  // 页面渲染后触发动态特效
  requestAnimationFrame(onPageRender)
}

function updateNav(key) {
  document.querySelectorAll('.nav-link[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === key)
  })
  document.querySelectorAll('.mobile-menu .nav-link[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === key)
  })
}

window.addEventListener('hashchange', render)
window.addEventListener('DOMContentLoaded', render)
