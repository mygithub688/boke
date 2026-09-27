# 指挥官的个人博客

纯前端 + 零依赖后端。Vite 只做开发服务器和构建，生产环境用 Nginx/Caddy 反代。

**单进程运行**：`npm start` 即可——Node 服务同时伺服前端页面、静态资源和 API，全站一个端口。

部署到自己的服务器见 [DEPLOY.md](DEPLOY.md)。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vanilla JS (ES Modules) + CSS，零框架 |
| 构建 | Vite 8 |
| 后端 | Node.js 内置模块（`node:http` + `node:sqlite` + `node:crypto`） |
| 数据库 | SQLite（Node 24 内置 `node:sqlite`） |
| 认证 | scrypt 密码哈希 + 手写 HMAC-SHA256 JWT（7 天） |
| 外部依赖 | **无**（npm install 仅 Vite dev） |

## 快速启动

```bash
# 单进程模式（推荐）：前端 + API 同端口
npm start
# → http://localhost:3001

# 开发模式（可选）：前后端分开，支持热更新
npx vite --port 5173   # 终端 1：前端（/api 自动代理到 3001）
node server/index.js   # 终端 2：后端 API
```

默认管理员：`admin` / `admin123`

## 功能一览

- 文章：发布 / 编辑 / 草稿 / 精选 / 标签 / 搜索 / 归档 / 浏览量 / 点赞收藏
- 评论区：访客免注册评论（昵称 + 内容），管理面板删除
- 本地 AI（需启动 LocalAI Studio，默认 `127.0.0.1:8787`，环境变量 `AI_BASE` / `AI_MODEL` 可改）：
  - 文章页 AI 摘要（懒生成，结果缓存在文章表）
  - 编辑器 AI 助手：润色 / 续写 / 起标题 / 推荐标签 / 写摘要
  - AI 日报：每天 9 点后自动把聚合的 AI 资讯写成文章发布，也可在仪表盘手动生成
- 聚合页：热搜（百度/头条/知乎/微博/抖音）+ AI 前沿（量子位/爱范儿/新智元/HN/TechCrunch/GitHub）
- RSS 订阅：`/feed.xml`
- 访问统计：PV/UV 按天记录，管理仪表盘 30 天趋势图（纯 canvas）
- 友链：前台展示页 + 管理面板增删
- 图片上传：编辑器插图按钮，base64 上传到 `uploads/`，单张限 8MB
- 安全：scrypt 密码哈希、手写 JWT、登录限流（每 IP 15 分钟 10 次）、评论限流、静态文件白名单、上传格式白名单

## 项目结构

```
├── index.html              # 入口
├── package.json
├── vite.config.js
├── deploy.sh              # 服务器部署脚本
├── DEPLOY.md              # 部署指南
├── public/
│   └── favicon.svg
├── src/
│   ├── main.js            # 入口 JS
│   ├── styles.css         # 全部样式（暗色/浅色双主题）
│   ├── api.js             # 前端 API 客户端
│   ├── data.js            # 静态回退数据（API 不可用时使用）
│   ├── router.js          # 轻量 hash router
│   ├── effects.js         # 动态特效（打字机/星尘/3D tilt/视差等）
│   ├── utils/
│   │   └── highlight.js   # 零依赖代码高亮（js/py/rust/bash/css + 嗅探）
│   ├── components/
│   │   ├── nav.js         # 导航栏
│   │   ├── footer.js      # 页脚
│   │   └── postCard.js    # 文章卡片
│   └── pages/
│       ├── home.js        # 首页
│       ├── article.js     # 文章详情（AI 摘要/TOC/代码高亮/评论区）
│       ├── about.js       # 关于
│       ├── search.js      # 搜索
│       ├── auth.js        # 登录/注册
│       ├── hot.js         # 热搜聚合页
│       ├── ainews.js      # AI 前沿页
│       ├── archive.js     # 归档页（按年分组时间线）
│       ├── links.js       # 友链页
│       ├── 404.js         # 404 页
│       └── admin.js       # 管理面板（仪表盘/文章/标签/评论/友链/设置）
└── server/
    ├── index.js           # HTTP 服务器 + 路由分发 + 静态伺服 + RSS
    ├── db.js              # SQLite 初始化 + 种子数据
    ├── auth.js            # 注册/登录/me/改密码（登录限流）
    ├── api.js             # 文章/标签/评论/归档/友链/统计/上传/AI 接口
    ├── ai.js              # 本地大模型客户端（摘要/写作助手）
    ├── aidigest.js        # AI 日报生成 + 定时调度
    ├── ratelimit.js       # 内存限流器
    ├── hot.js             # 热搜聚合（多源抓取 + 内存缓存）
    └── ainews.js          # AI 新闻聚合
```

## API 端点

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/posts` | 公开 | 获取文章列表 + 标签名 |
| GET | `/api/posts/:slug` | 公开 | 获取单篇文章 + 相关文章（含 ai_summary） |
| POST | `/api/posts` | JWT | 新建文章 |
| PUT | `/api/posts/:id` | JWT | 更新文章 |
| DELETE | `/api/posts/:id` | JWT | 删除文章 |
| GET | `/api/archive` | 公开 | 归档（全部已发布文章，按时间倒序） |
| GET | `/api/tags` | 公开 | 获取标签 + 文章计数 |
| POST | `/api/tags` | JWT | 新建标签 |
| DELETE | `/api/tags/:id` | JWT | 删除标签（无文章引用时） |
| GET/POST | `/api/posts/:id/comments` | 公开 | 评论列表 / 发表评论（限流） |
| GET | `/api/admin/comments` | JWT | 全部评论（含文章标题） |
| DELETE | `/api/comments/:id` | JWT | 删除评论 |
| GET | `/api/links` | 公开 | 友链列表 |
| POST | `/api/links` | JWT | 新增友链 |
| DELETE | `/api/links/:id` | JWT | 删除友链 |
| POST | `/api/track` | 公开 | PV/UV 埋点（user_key） |
| GET | `/api/stats` | JWT | 统计数据 |
| GET | `/api/stats/chart` | JWT | 近 30 天 PV/UV 图表数据 |
| POST | `/api/upload` | JWT | 图片上传（base64，≤8MB） |
| GET | `/api/hot` | 公开 | 热搜聚合（百度/头条/知乎/微博/抖音，5 分钟缓存） |
| GET | `/api/ainews` | 公开 | AI 前沿聚合（10 分钟缓存） |
| POST | `/api/ai/summary` | 公开 | 文章 AI 摘要（限流 + 缓存进库） |
| POST | `/api/ai/write` | JWT | 编辑器 AI 助手（润色/续写/标题/标签/摘要） |
| POST | `/api/ai/digest` | JWT | 手动生成今日 AI 日报 |
| POST | `/api/auth/register` | 公开 | 注册 |
| POST | `/api/auth/login` | 公开 | 登录（限流：每 IP 15 分钟 10 次） |
| GET | `/api/auth/me` | JWT | 当前用户信息 |
| PUT | `/api/auth/password` | JWT | 修改密码 |
| GET | `/feed.xml` | 公开 | RSS 2.0 订阅 |

## 部署到服务器

### 方案 A：pm2 + Nginx

```bash
# 1. 克隆到服务器
git clone https://github.com/mygithub688/boke.git
cd boke

# 2. 安装依赖 + 构建前端
npm install
npm run build
# → 生成 dist/ 目录

# 3. 初始化数据库（首次启动自动建表）
node server/index.js &
sleep 3 && kill %1

# 4. pm2 守护
npm i -g pm2
pm2 start server/index.js --name blog-server
pm2 save
pm2 startup

# 5. Nginx 配置
```

Nginx 示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /var/www/boke/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 方案 B：一键脚本

```bash
bash deploy.sh
```

脚本会自动 npm install → build → 启动 Node → 用 pm2 或 nohup 守护。

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | 服务端口 |
| `JWT_SECRET` | 内置 | 生产环境务必设置 |
| `SITE_URL` | `http://localhost:PORT` | RSS 里的站点链接 |
| `AI_BASE` | `http://127.0.0.1:8787/v1` | 本地 AI 的 OpenAI 兼容接口 |
| `AI_MODEL` | `qwen3.8-27b` | AI 功能使用的模型 ID |

## 前端路由

| 路径 | 页面 |
|---|---|
| `#/` | 首页 |
| `#/post/:slug` | 文章详情（AI 摘要 / TOC / 代码高亮 / 评论） |
| `#/about` | 关于 |
| `#/archive` | 归档（按年分组） |
| `#/links` | 友链 |
| `#/search?q=...` | 搜索 |
| `#/login` | 登录 |
| `#/register` | 注册 |
| `#/admin` | 管理仪表盘（30 天 PV/UV 图表 + AI 日报按钮） |
| `#/admin/posts` | 文章管理 |
| `#/admin/posts/new` | 新建文章（AI 助手 + 插图上传） |
| `#/admin/posts/:id` | 编辑文章 |
| `#/hot` | 热搜聚合（百度/头条/知乎/微博/抖音） |
| `#/ainews` | AI 前沿（量子位/爱范儿/新智元/HN/TechCrunch/GitHub） |
| `#/admin/tags` | 标签管理 |
| `#/admin/comments` | 评论管理 |
| `#/admin/links` | 友链管理 |
| `#/admin/settings` | 账户设置（修改密码/账户信息） |

## 主题

暗色/浅色双主题，CSS 变量控制，localStorage 持久化。导航栏右侧太阳/月亮图标切换。
