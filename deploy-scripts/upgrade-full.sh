#!/bin/bash
# ==========================================
# ACEMATIC 运营管理系统 - 完整升级脚本
# 支持从远程下载最新版本并自动升级
# ==========================================

set -e

APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups/$APP_NAME"
LOG_FILE="/var/log/$APP_NAME/upgrade.log"
VERSION_FILE="$APP_DIR/.version"

# 远程版本服务器地址（可配置）
VERSION_SERVER="${VERSION_SERVER:-https://version.acematic.com.cn}"
PACKAGE_URL="${PACKAGE_URL:-https://deploy.acematic.com.cn/acematic-ops.tar.gz}"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 获取当前版本
get_current_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat $VERSION_FILE
    else
        echo "1.0.0"
    fi
}

# 获取远程最新版本
get_remote_version() {
    curl -s --connect-timeout 5 "$VERSION_SERVER/version.txt" 2>/dev/null || echo "unknown"
}

# 创建备份
backup() {
    log "创建备份..."
    mkdir -p $BACKUP_DIR
    BACKUP_NAME="${APP_NAME}_$(date '+%Y%m%d_%H%M%S')"
    
    tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" \
        -C /opt $APP_NAME \
        --exclude='node_modules' \
        --exclude='*.log' \
        --exclude='backups' 2>/dev/null || true
    
    log "备份完成: ${BACKUP_NAME}.tar.gz"
    
    # 保留最近10个备份
    ls -t $BACKUP_DIR/*.tar.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
}

# 下载最新版本
download_package() {
    log "下载最新版本..."
    
    local TMP_DIR="/tmp/acematic-upgrade-$$"
    mkdir -p $TMP_DIR
    
    # 下载部署包
    if curl -L --connect-timeout 30 -o "$TMP_DIR/package.tar.gz" "$PACKAGE_URL"; then
        log "下载完成，解压中..."
        tar -xzf "$TMP_DIR/package.tar.gz" -C $TMP_DIR
        echo $TMP_DIR
        return 0
    else
        log "错误: 下载失败"
        rm -rf $TMP_DIR
        return 1
    fi
}

# 执行升级
do_upgrade() {
    log "========== 开始升级 =========="
    
    # 1. 检查服务状态
    if ! pm2 status $APP_NAME | grep -q "online"; then
        log "警告: 服务未运行"
    fi
    
    # 2. 备份
    backup
    
    # 3. 下载新版本
    TMP_DIR=$(download_package)
    if [ $? -ne 0 ]; then
        log "升级失败: 无法下载新版本"
        return 1
    fi
    
    # 4. 停止服务
    log "停止服务..."
    pm2 stop $APP_NAME 2>/dev/null || true
    
    # 5. 更新文件
    log "更新文件..."
    
    # 更新后端
    if [ -d "$TMP_DIR/backend" ]; then
        # 保留配置文件
        cp $APP_DIR/backend/.env $TMP_DIR/backend/.env 2>/dev/null || true
        cp $TMP_DIR/backend/* $APP_DIR/backend/ -r 2>/dev/null || true
    fi
    
    # 更新前端
    if [ -d "$TMP_DIR/frontend/dist" ]; then
        rm -rf $APP_DIR/frontend/dist/*
        cp -r $TMP_DIR/frontend/dist/* $APP_DIR/frontend/dist/
    fi
    
    # 6. 更新依赖
    log "更新依赖..."
    cd $APP_DIR/backend
    pnpm install --prod=false 2>/dev/null || npm install
    
    # 7. 数据库迁移
    log "执行数据库迁移..."
    npx prisma generate 2>/dev/null || true
    npx prisma migrate deploy 2>/dev/null || npx prisma db push 2>/dev/null || true
    
    # 8. 更新版本号
    REMOTE_VERSION=$(get_remote_version)
    echo "$REMOTE_VERSION" > $VERSION_FILE
    
    # 9. 重启服务
    log "重启服务..."
    pm2 restart $APP_NAME 2>/dev/null || pm2 start "npx tsx src/index.ts" --name $APP_NAME
    pm2 save
    
    # 10. 清理临时文件
    rm -rf $TMP_DIR
    
    log "========== 升级完成 =========="
    log "当前版本: $REMOTE_VERSION"
    pm2 status
}

# 回滚
do_rollback() {
    local BACKUP_FILE=$1
    
    if [ -z "$BACKUP_FILE" ]; then
        echo "可用备份列表:"
        echo "=================="
        ls -lt $BACKUP_DIR/*.tar.gz 2>/dev/null | head -10
        echo ""
        echo "用法: $0 rollback <备份文件名>"
        return
    fi
    
    local BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
    if [ ! -f "$BACKUP_PATH" ]; then
        log "错误: 备份文件不存在: $BACKUP_PATH"
        return 1
    fi
    
    log "回滚到: $BACKUP_FILE"
    
    pm2 stop $APP_NAME 2>/dev/null || true
    tar -xzf "$BACKUP_PATH" -C /opt/
    pm2 restart $APP_NAME 2>/dev/null || pm2 start "npx tsx src/index.ts" --name $APP_NAME
    pm2 save
    
    log "回滚完成"
}

# 检查更新
check_update() {
    CURRENT=$(get_current_version)
    REMOTE=$(get_remote_version)
    
    echo "当前版本: $CURRENT"
    echo "远程版本: $REMOTE"
    
    if [ "$CURRENT" != "$REMOTE" ] && [ "$REMOTE" != "unknown" ]; then
        echo "发现新版本!"
        return 0
    else
        echo "已是最新版本"
        return 1
    fi
}

# 自动升级（检查版本后升级）
auto_upgrade() {
    if check_update; then
        log "自动升级模式，开始升级..."
        do_upgrade
    fi
}

# 主入口
case "$1" in
    upgrade)
        do_upgrade
        ;;
    auto)
        auto_upgrade
        ;;
    rollback)
        do_rollback "$2"
        ;;
    backup)
        backup
        ;;
    check)
        check_update
        ;;
    status)
        echo "版本: $(get_current_version)"
        pm2 status $APP_NAME
        ;;
    *)
        echo "ACEMATIC 运营管理系统 - 升级工具"
        echo ""
        echo "用法: $0 <命令> [参数]"
        echo ""
        echo "命令:"
        echo "  upgrade     - 强制升级到最新版本"
        echo "  auto        - 检查版本，如有更新则自动升级"
        echo "  rollback    - 回滚到指定备份版本"
        echo "  backup      - 手动创建备份"
        echo "  check       - 检查是否有新版本"
        echo "  status      - 查看当前状态"
        echo ""
        echo "示例:"
        echo "  $0 upgrade              # 升级到最新版本"
        echo "  $0 auto                 # 自动检查并升级"
        echo "  $0 rollback             # 查看可用备份"
        echo "  $0 rollback backup.tar.gz  # 回滚到指定备份"
        ;;
esac
