#!/bin/bash
# 博客部署脚本 · 在服务器上执行
# 用法: bash deploy.sh

set -e

echo "=== 指挥官博客 · 部署 ==="

# 1. 构建前端
echo "[1/4] 构建前端…"
npm install
npm run build

# 2. 初始化数据库（首次部署自动建表 + 种子数据）
echo "[2/4] 初始化数据库…"
node server/index.js &
SERVER_PID=$!

# 等 2 秒让 DB 初始化完成
sleep 2

# 3. 停止临时服务
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

# 4. 正式启动
echo "[3/4] 启动服务…"
echo "  前端 API:  http://localhost:3001"
echo "  默认管理员: admin / admin123"
echo ""

if command -v pm2 &>/dev/null; then
  echo "[4/4] 使用 pm2 守护进程…"
  pm2 delete blog-server 2>/dev/null || true
  pm2 start server/index.js --name blog-server
  pm2 save
  echo ""
  echo "部署完成！pm2 已启动。"
  echo "查看日志: pm2 logs blog-server"
else
  echo "[4/4] 无 pm2，直接后台运行…"
  nohup node server/index.js > server.log 2>&1 &
  echo "PID: $!"
  echo ""
  echo "部署完成！服务已后台运行。"
  echo "查看日志: tail -f server.log"
fi
