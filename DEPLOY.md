# 部署指南 · 把博客放到你自己的服务器上

单进程版博客：**一个 Node 进程同时伺服前端页面和 API**，部署非常简单。
生产环境推荐先构建一次前端（`dist/`），服务会自动优先使用。

## 前置要求

| 项 | 要求 |
|---|---|
| Node.js | **≥ 22.5**（推荐 24 LTS，用了内置 `node:sqlite`） |
| 操作系统 | Linux / Windows 均可 |
| 数据库 | 无需安装，SQLite 单文件（`server/blog.db`），首次启动自动建表 |
| 外部依赖 | 无。前端零依赖，后端纯 Node 内置模块 |

查看 Node 版本：`node -v`

---

## 方式 A：极简部署（5 分钟跑起来）

适合先跑通看看效果。**连 npm install 都不用**（依赖仅开发期的 Vite）。

```bash
# 1. 拉代码（本地已推送到 GitHub）
git clone https://github.com/mygithub688/boke.git blog
cd blog

# 2. 启动（前台运行，Ctrl+C 停止）
node server/index.js
# → http://服务器IP:3001
```

打开 `http://服务器IP:3001` 就是完整博客，管理后台在 `#/admin`。
**登录后第一时间改掉默认密码（admin / admin123）。**

云服务器记得放行端口（以阿里云/腾讯云为例：安全组规则放行 TCP 3001；
系统内防火墙 `sudo ufw allow 3001` 或 `firewall-cmd --add-port=3001/tcp --permanent`）。

---

## 方式 B：标准部署（构建 + 守护进程 + 域名 HTTPS）

### 1. 构建前端

```bash
git clone https://github.com/mygithub688/boke.git blog && cd blog
npm install        # 只装 Vite
npm run build      # 生成 dist/，服务启动时会自动优先使用
```

### 2. 设置环境变量（生产必做）

```bash
export PORT=3001                          # API/整站端口，默认 3001
export JWT_SECRET='换成一串随机长字符串'    # 登录令牌签名密钥，务必修改！
# 生成随机密钥：openssl rand -base64 32
```

### 3. 一键脚本（pm2 守护）

```bash
bash deploy.sh
```

脚本会自动：npm install → 构建 → 初始化数据库 → 用 pm2（无则 nohup）守护启动。
常用命令：

```bash
pm2 logs blog-server     # 看日志
pm2 restart blog-server  # 重启
pm2 status               # 状态
```

### 4. Nginx 反代 + 域名（可选，推荐）

单进程模式下最简单：整个站点反代到一个端口。

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

性能更好的写法：静态文件走 Nginx，只把 API 转给 Node：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/blog/dist;            # npm run build 的产物
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

HTTPS 一条命令（Let's Encrypt）：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5. Caddy 替代方案（自动 HTTPS，配置最少）

```caddyfile
your-domain.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        root * /var/www/blog/dist
        file_server
    }
}
```

### systemd 守护（不用 pm2 的话）

```ini
# /etc/systemd/system/blog.service
[Unit]
Description=Commander Blog
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/blog
ExecStart=/usr/bin/node server/index.js
Environment=PORT=3001
Environment=JWT_SECRET=换成随机长字符串
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blog
sudo systemctl status blog
```

---

## 方式 C：Windows 服务器

1. 安装 Node.js ≥ 22.5
2. `git clone https://github.com/mygithub688/boke.git && cd boke`
3. `npm install && npm run build`（可选构建）
4. 启动：`npm start`，或注册成 Windows 服务：
   - 最简单：`nssm install Blog "C:\Program Files\nodejs\node.exe" "server\index.js"`（工作目录设为项目根）
   - 或 pm2：`npm i -g pm2 && pm2 start server/index.js --name blog-server`
5. Windows 防火墙放行 3001 端口

---

## 数据与备份

| 文件 | 说明 |
|---|---|
| `server/blog.db` | 全部数据（文章/标签/用户/评论/友链/统计），SQLite 单文件 |
| `uploads/` | 上传的图片，随库一起备份 |
| `server/blog.db-wal` / `-shm` | SQLite 预写日志，备份前建议先停服务或 `pm2 stop` |

备份 = 停服务后把 `server/blog.db` 拷走；恢复 = 放回原位置再启动。
也可以加个 crontab 定时备份：

```bash
0 3 * * * pm2 stop blog-server && cp /var/www/blog/server/blog.db /backup/blog-$(date +\%F).db && pm2 start blog-server
```

## 环境变量一览

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3001` | 整站端口 |
| `JWT_SECRET` | 内置默认 | 登录令牌密钥，**生产务必设置** |

## 常见问题

- **端口被占用**：`lsof -i:3001`（或 Windows `netstat -ano | findstr :3001`）找到进程换端口，或 `PORT=8080 node server/index.js` 换端口启动
- **页面打开了但文章/热搜是空的**：确认访问的就是 3001（或 Nginx 的 `/api/` 反代生效）；热搜数据来自公网接口，服务器需能出外网
- **忘记管理员密码**：删掉 `server/blog.db` 里的 users 表记录重启会重建默认账号（或直接删库重启，文章会回到种子数据，慎用）
- **升级代码**：`git pull` → 如果构建过则 `npm run build` → `pm2 restart blog-server`
