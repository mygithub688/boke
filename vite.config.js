export default {
  base: './',
  server: {
    port: 5173,
    open: true,
    proxy: {
      // 开发模式下 API 转发到后端进程；单进程模式（node server/index.js）无需此配置
      '/api': 'http://localhost:3001'
    }
  }
}
