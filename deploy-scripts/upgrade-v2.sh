#!/bin/bash
# ==========================================
# ACEMATIC 运营管理系统 v2.0.0 升级脚本
# 部署到 okr.acematic.com.cn
# ==========================================

set -e

APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups"

echo "========== ACEMATIC v2.0.0 升级开始 =========="

# 1. 创建备份
echo ">>> 步骤1: 创建备份..."
mkdir -p $BACKUP_DIR
BACKUP_NAME="${APP_NAME}_$(date '+%Y%m%d_%H%M%S')"
tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" \
    -C /opt $APP_NAME \
    --exclude='node_modules' \
    --exclude='*.log' 2>/dev/null || true
echo "备份完成: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"

# 2. 停止服务
echo ">>> 步骤2: 停止服务..."
pm2 stop $APP_NAME 2>/dev/null || true

# 3. 下载最新代码
echo ">>> 步骤3: 下载最新代码..."
cd /tmp
rm -rf acematic-ops-upgrade 2>/dev/null || true
mkdir -p acematic-ops-upgrade && cd acematic-ops-upgrade

# 从 GitHub 下载最新版本
curl -sL https://github.com/106790336/acematic-ops/archive/refs/heads/master.tar.gz -o upgrade.tar.gz
tar -xzf upgrade.tar.gz
cd acematic-ops-master

# 4. 更新后端代码
echo ">>> 步骤4: 更新后端代码..."
cp -r backend/src/* $APP_DIR/backend/src/
cp -r backend/prisma/* $APP_DIR/backend/prisma/ 2>/dev/null || true

# 5. 更新前端代码
echo ">>> 步骤5: 更新前端代码..."
if [ -d "frontend/dist" ]; then
    rm -rf $APP_DIR/frontend/dist/*
    cp -r frontend/dist/* $APP_DIR/frontend/dist/
fi

# 6. 更新依赖
echo ">>> 步骤6: 更新依赖..."
cd $APP_DIR/backend
pnpm install --prod=false 2>/dev/null || npm install --production=false

# 7. 数据库迁移
echo ">>> 步骤7: 执行数据库迁移..."
npx prisma generate
npx prisma db push --skip-generate 2>/dev/null || true

# 8. 清理临时文件
echo ">>> 步骤8: 清理临时文件..."
rm -rf /tmp/acematic-ops-upgrade

# 9. 重启服务
echo ">>> 步骤9: 重启服务..."
pm2 restart $APP_NAME

# 10. 验证服务
echo ">>> 步骤10: 验证服务状态..."
sleep 5
pm2 status

echo ""
echo "========== 升级完成 =========="
echo "请访问 http://okr.acematic.com.cn 验证"
echo ""
echo "v2.0.0 更新内容:"
echo "  ✨ 审核工作流（Draft → Pending → Active）"
echo "  ✨ 变更申请机制"
echo "  🔒 员工无法删除任务"
echo "  🔒 只有草稿状态可编辑/删除"
