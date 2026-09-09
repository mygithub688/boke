import { login, register } from '../api.js'

function renderAuth(container, mode = 'login') {
  const isLogin = mode === 'login'
  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card anim-up">
        <div class="auth-brand">
          <div class="brand-mark">指</div>
          <h2>${isLogin ? '欢迎回来' : '创建账号'}</h2>
          <p>${isLogin ? '登录后管理你的博客' : '注册一个管理员账号'}</p>
        </div>
        <div class="form-error" id="formError"></div>
        <form id="authForm">
          ${!isLogin ? `
          <div class="form-group">
            <label>显示名称</label>
            <input type="text" name="displayName" placeholder="你的名字" autocomplete="name" />
          </div>` : ''}
          <div class="form-group">
            <label>用户名</label>
            <input type="text" name="username" placeholder="用户名" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" name="password" placeholder="${isLogin ? '密码' : '至少 6 位'}" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
          </div>
          ${!isLogin ? `
          <div class="form-group">
            <label>确认密码</label>
            <input type="password" name="confirmPassword" placeholder="再次输入密码" required minlength="6" autocomplete="new-password" />
          </div>` : ''}
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">
            ${isLogin ? '登 录' : '注 册'}
          </button>
        </form>
        <div class="auth-switch">
          ${isLogin
            ? `没有账号？ <a id="switchToRegister">注册</a>`
            : `已有账号？ <a id="switchToLogin">登录</a>`}
        </div>
      </div>
    </div>
  `

  const form = container.querySelector('#authForm')
  const errEl = container.querySelector('#formError')

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const fd = new FormData(form)
    const username = fd.get('username').trim()
    const password = fd.get('password')

    errEl.classList.remove('show')

    try {
      if (isLogin) {
        await login(username, password)
        window.location.hash = '/admin'
      } else {
        const confirm = fd.get('confirmPassword')
        if (password !== confirm) throw new Error('两次密码不一致')
        const displayName = fd.get('displayName')?.trim() || username
        await register(username, password, displayName)
        window.location.hash = '/admin'
      }
    } catch (err) {
      errEl.textContent = err.message
      errEl.classList.add('show')
    }
  })

  const switchLink = container.querySelector('#switchToRegister, #switchToLogin')
  if (switchLink) {
    switchLink.addEventListener('click', () => {
      renderAuth(container, isLogin ? 'register' : 'login')
    })
  }
}

export default {
  render(container, params) { renderAuth(container, params.mode || 'login') },
  cleanup() {}
}
