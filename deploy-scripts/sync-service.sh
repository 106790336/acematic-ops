#!/bin/bash
# ==========================================
# 自动同步升级服务 - 定时检查版本自动升级
# ==========================================

APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
UPGRADE_SCRIPT="$APP_DIR/upgrade.sh"
SYNC_LOG="/var/log/$APP_NAME/sync.log"

# 检查间隔（秒）
CHECK_INTERVAL=${CHECK_INTERVAL:-300}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $SYNC_LOG
}

# 主循环
main() {
    log "========== 自动同步服务启动 =========="
    log "检查间隔: ${CHECK_INTERVAL}秒"
    
    while true; do
        # 执行自动检查和升级
        if [ -x "$UPGRADE_SCRIPT" ]; then
            $UPGRADE_SCRIPT auto >> $SYNC_LOG 2>&1
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# 处理信号
trap 'log "收到停止信号"; exit 0' SIGTERM SIGINT

main
