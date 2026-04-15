#!/bin/bash
# ==========================================
# ACEMATIC 运营管理系统 - 快速升级脚本
# 用法: ./upgrade.sh [版本号]
# ==========================================

set -e

APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups/$APP_NAME"
LOG_FILE="/var/log/$APP_NAME/upgrade.log"

# 记录日志
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
    
    # 保留最近5个备份
    ls -t $BACKUP_DIR/*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
}

# 下载最新版本
download_latest() {
    local VERSION=$1
    log "下载最新版本: $VERSION"
    
    # 方式1: 从 Git 仓库拉取
    # git clone --branch $VERSION https://your-repo.git /tmp/$APP_NAME-$VERSION
    
    # 方式2: 从部署包下载
    local PACKAGE_URL="https://your-cdn.com/$APP_NAME-$VERSION.tar.gz"
    
    # 这里使用 Cloud Studio 的文件服务
    # 实际部署时可替换为您的代码仓库地址
    
    curl -L -o /tmp/$APP_NAME.tar.gz "$PACKAGE_URL" || {
        log "错误: 下载失败"
        return 1
    }
    
    tar -xzf /tmp/$APP_NAME.tar.gz -C /tmp/
}

# 执行升级
upgrade() {
    log "开始升级..."
    
    # 1. 停止服务
    log "停止服务..."
    pm2 stop $APP_NAME 2>/dev/null || true
    
    # 2. 备份当前版本
    backup
    
    # 3. 更新文件
    log "更新文件..."
    
    # 更新后端
    if [ -d "/tmp/backend" ]; then
        cp -r /tmp/backend/* $APP_DIR/backend/
    fi
    
    # 更新前端
    if [ -d "/tmp/frontend/dist" ]; then
        rm -rf $APP_DIR/frontend/dist/*
        cp -r /tmp/frontend/dist/* $APP_DIR/frontend/dist/
    fi
    
    # 4. 更新依赖
    log "更新依赖..."
    cd $APP_DIR/backend
    pnpm install --prod=false
    
    # 5. 数据库迁移
    log "执行数据库迁移..."
    npx prisma generate
    npx prisma migrate deploy 2>/dev/null || npx prisma db push 2>/dev/null || true
    
    # 6. 重启服务
    log "重启服务..."
    pm2 restart $APP_NAME
    
    # 7. 清理临时文件
    rm -rf /tmp/backend /tmp/frontend /tmp/$APP_NAME.tar.gz
    
    log "升级完成!"
    pm2 status
}

# 回滚
rollback() {
    local BACKUP_FILE=$1
    if [ -z "$BACKUP_FILE" ]; then
        echo "可用备份:"
        ls -lt $BACKUP_DIR/*.tar.gz 2>/dev/null | head -5
        return
    fi
    
    log "回滚到: $BACKUP_FILE"
    pm2 stop $APP_NAME
    tar -xzf "$BACKUP_DIR/$BACKUP_FILE" -C /opt/
    pm2 restart $APP_NAME
    log "回滚完成"
}

# 检查更新
check_update() {
    log "检查更新..."
    # 这里可以调用 API 检查是否有新版本
    echo "当前版本检查功能需要配置版本服务器"
}

# 主入口
case "$1" in
    upgrade)
        upgrade
        ;;
    rollback)
        rollback "$2"
        ;;
    backup)
        backup
        ;;
    check)
        check_update
        ;;
    *)
        echo "用法: $0 {upgrade|rollback|backup|check}"
        echo ""
        echo "命令说明:"
        echo "  upgrade   - 升级到最新版本"
        echo "  rollback  - 回滚到指定备份版本"
        echo "  backup    - 手动创建备份"
        echo "  check     - 检查是否有新版本"
        ;;
esac
