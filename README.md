# 指挥官的个人博客

纯前端 + 零依赖后端。Vite 只做开发服务器和构建，生产环境用 Nginx/Caddy 反代。

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
# 终端 1：前端开发服务器
npx vite --port 5173

# 终端 2：后端 API
node server/index.js
# → http://localhost:3001
```

默认管理员：`admin` / `admin123`

## 项目结构

```
├── index.html              # 入口
├── package.json
├── vite.config.js
├── deploy.sh              # 服务器部署脚本
├── public/
│   └── favicon.svg
├── src/
│   ├── main.js            # 入口 JS
│   ├── styles.css         # 全部样式（暗色/浅色双主题）
│   ├── api.js             # 前端 API 客户端
│   ├── data.js            # 静态回退数据（API 不可用时使用）
│   ├── router.js          # 轻量 hash router
│   ├── effects.js         # 动态特效（打字机/星尘/3D tilt/视差等）
│   ├── components/
│   │   ├── nav.js         # 导航栏
│   │   ├── footer.js      # 页脚
│   │   └── postCard.js    # 文章卡片
│   └── pages/
│       ├── home.js        # 首页
│       ├── article.js     # 文章详情
│       ├── about.js       # 关于
│       ├── search.js      # 搜索
│       ├── auth.js        # 登录/注册
│       └── admin.js       # 管理面板（仪表盘/文章管理/标签管理）
└── server/
    ├── index.js           # HTTP 服务器 + 路由分发
    ├── db.js              # SQLite 初始化 + 种子数据
    ├── auth.js            # 注册/登录/me/改密码
    └── api.js             # 文章 CRUD + 标签管理 + 统计
```

## API 端点

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/posts` | 公开 | 获取文章列表 + 标签名 |
| GET | `/api/posts/:slug` | 公开 | 获取单篇文章 + 相关文章 |
| POST | `/api/posts` | JWT | 新建文章 |
| PUT | `/api/posts/:id` | JWT | 更新文章 |
| DELETE | `/api/posts/:id` | JWT | 删除文章 |
| GET | `/api/tags` | 公开 | 获取标签 + 文章计数 |
| POST | `/api/tags` | JWT | 新建标签 |
| DELETE | `/api/tags/:id` | JWT | 删除标签（无文章引用时） |
| GET | `/api/stats` | JWT | 统计数据 |
| POST | `/api/auth/register` | 公开 | 注册 |
| POST | `/api/auth/login` | 公开 | 登录 |
| GET | `/api/auth/me` | JWT | 当前用户信息 |
| PUT | `/api/auth/password` | JWT | 修改密码 |

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
| `PORT` | `3001` | API 端口 |
| `JWT_SECRET` | 内置 | 生产环境务必设置 |

## 前端路由

| 路径 | 页面 |
|---|---|
| `#/` | 首页 |
| `#/post/:slug` | 文章详情 |
| `#/about` | 关于 |
| `#/search?q=...` | 搜索 |
| `#/login` | 登录 |
| `#/register` | 注册 |
| `#/admin` | 管理仪表盘 |
| `#/admin/posts` | 文章管理 |
| `#/admin/posts/new` | 新建文章 |
| `#/admin/posts/:id` | 编辑文章 |
| `#/admin/tags` | 标签管理 |

## 主题

暗色/浅色双主题，CSS 变量控制，localStorage 持久化。导航栏右侧太阳/月亮图标切换。
