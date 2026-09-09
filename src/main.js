import './components/nav.js'
import { render } from './router.js'
import { initEffects } from './effects.js'

// 页面加载后立即初始化全局特效
initEffects()

if (document.readyState === 'loading') {
  window.addEventListener('load', render)
} else {
  render()
}
