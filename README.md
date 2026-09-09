# 指挥官的个人博客

纯前端静态博客，零框架零依赖，Vite 只做开发服务器和构建。

## 启动

```bash
npx vite --port 5173
```

然后打开 `http://localhost:5173`

## 结构

```
index.html          入口
vite.config.js      Vite 配置
public/favicon.svg  图标
src/
  main.js           引导入口
  router.js         轻量 hash 路由
  data.js           文章/标签数据（写死在前端，后续可换 API）
  styles.css        全部样式（CSS 变量 + 暗色主题）
  components/
    nav.js          顶部导航 + 搜索 + 移动端菜单 + 回到顶部
    postCard.js     文章卡片模板
    footer.js       页脚（当前各页面内联，保留备用）
  pages/
    home.js         首页（Hero + 文章列表 + 标签云）
    article.js      文章详情页（阅读进度条 + 相关文章）
    about.js        关于页
    search.js       搜索/标签页
```

## 技术要点

- **路由**：hash 路由，`#/` `#/post/:id` `#/about` `#/search?q=...`
- **主题**：深色暖调，CSS 变量控制，金色强调色
- **排版**：衬线标题（Georgia + Noto Serif SC），等宽日期，大字号文章正文
- **动画**：入场 fadeUp、轨道动画、阅读进度条、悬停微交互
- **响应式**：移动端菜单、单列卡片、隐藏时钟
