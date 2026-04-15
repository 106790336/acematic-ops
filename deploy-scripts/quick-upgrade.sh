#!/bin/bash
# ==========================================
# ACEMATIC 运营管理系统 - 升级部署脚本
# 适用于已部署服务器的增量更新
# ==========================================

set -e

APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups/$APP_NAME"
LOG_FILE="/var/log/$APP_NAME/upgrade.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 创建备份
backup() {
    log "创建备份..."
    BACKUP_NAME="${APP_NAME}_$(date '+%Y%m%d_%H%M%S')"
    mkdir -p $BACKUP_DIR
    tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" \
        -C /opt $APP_NAME \
        --exclude='node_modules' \
        --exclude='*.log' 2>/dev/null || true
    log "备份完成: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
}

# 升级
upgrade() {
    log "========== 开始升级 =========="
    
    # 1. 停止服务
    log "停止服务..."
    pm2 stop $APP_NAME 2>/dev/null || true
    
    # 2. 备份
    backup
    
    # 3. 更新后端代码
    log "更新后端代码..."
    if [ -d "./backend-src" ]; then
        cp -r ./backend-src/* $APP_DIR/backend/src/
    fi
    if [ -d "./backend-prisma" ]; then
        cp -r ./backend-prisma/* $APP_DIR/backend/prisma/
    fi
    
    # 4. 更新前端
    log "更新前端..."
    if [ -d "./frontend-dist" ]; then
        rm -rf $APP_DIR/frontend/dist/*
        cp -r ./frontend-dist/* $APP_DIR/frontend/dist/
    fi
    
    # 5. 更新依赖
    log "更新依赖..."
    cd $APP_DIR/backend
    pnpm install --prod=false 2>/dev/null || npm install --production=false
    
    # 6. 数据库迁移
    log "执行数据库迁移..."
    npx prisma generate
    npx prisma db push --skip-generate 2>/dev/null || true
    
    # 7. 重启服务
    log "重启服务..."
    pm2 restart $APP_NAME
    
    log "========== 升级完成 =========="
    pm2 status
}

# 执行
upgrade
