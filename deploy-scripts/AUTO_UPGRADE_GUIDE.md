# 自动升级部署配置指南

## 整体架构

```
Cloud Studio (开发环境)
       ↓ 代码迭代
       ↓ 打包上传到版本服务器
版本服务器 (存储最新版本)
       ↑ 定时检查/Webhook触发
部署服务器 (生产环境)
       ↓ 自动下载升级
```

---

## 方式一：定时自动检查升级

### 在部署服务器上配置

```bash
# 1. 安装完整升级脚本
cat > /opt/acematic-ops/upgrade.sh << 'SCRIPT'
[将 upgrade-full.sh 内容粘贴到这里]
SCRIPT
chmod +x /opt/acematic-ops/upgrade.sh

# 2. 配置 systemd 服务
cat > /etc/systemd/system/acematic-sync.service << 'EOF'
[Unit]
Description=ACEMATIC Auto Sync Service
After=network.target

[Service]
Type=simple
Environment="VERSION_SERVER=https://version.acematic.com.cn"
Environment="PACKAGE_URL=https://deploy.acematic.com.cn/acematic-ops.tar.gz"
Environment="CHECK_INTERVAL=300"
ExecStart=/opt/acematic-ops/scripts/sync-service.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 3. 启动服务
systemctl daemon-reload
systemctl enable acematic-sync
systemctl start acematic-sync
```

---

## 方式二：Webhook 触发升级

### 在 Cloud Studio 迭代后触发

当您在 Cloud Studio 完成代码迭代后，可以：

```bash
# 在 Cloud Studio 执行，触发部署服务器升级
curl -X POST http://43.138.204.20:9000/hooks/acematic-upgrade
```

### 配置自动触发脚本

在 Cloud Studio 创建触发脚本：

```bash
# /workspace/deploy-trigger.sh
#!/bin/bash
SERVER_URL="http://43.138.204.20:9000/hooks/acematic-upgrade"

echo "触发部署服务器升级..."
curl -X POST "$SERVER_URL"
echo "升级已触发"
```

---

## 方式三：版本服务器自动同步

### 创建版本服务器（可用对象存储替代）

**简单方案：使用腾讯云 COS 或其他对象存储**

1. 创建存储桶：`acematic-deploy`
2. 上传文件：
   - `version.txt` - 版本号（如 `1.0.1`）
   - `acematic-ops.tar.gz` - 部署包

3. 获取访问地址：
   ```
   VERSION_SERVER=https://acematic-deploy.cos.ap-guangzhou.myqcloud.com
   PACKAGE_URL=https://acematic-deploy.cos.ap-guangzhou.myqcloud.com/acematic-ops.tar.gz
   ```

### 在 Cloud Studio 创建发布脚本

```bash
# /workspace/publish.sh
#!/bin/bash
VERSION=$1
COS_BUCKET="acematic-deploy"

if [ -z "$VERSION" ]; then
    VERSION=$(date +%Y%m%d%H%M)
fi

echo "发布版本: $VERSION"

# 1. 构建前端
cd /workspace/frontend && pnpm build

# 2. 打包
cd /workspace
tar --exclude='node_modules' --exclude='.git' -czf acematic-ops.tar.gz backend frontend/dist

# 3. 上传到 COS（需要安装 coscmd）
coscmd upload acematic-ops.tar.gz /acematic-ops.tar.gz
echo "$VERSION" | coscmd upload - /version.txt

# 4. 触发部署服务器升级
curl -X POST http://43.138.204.20:9000/hooks/acematic-upgrade

echo "发布完成！版本: $VERSION"
```

---

## 快速配置（立即可用）

### 步骤 1：在部署服务器上安装升级脚本

```bash
# SSH 到服务器执行
cat > /opt/acematic-ops/upgrade.sh << 'EOF'
#!/bin/bash
set -e
APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups/$APP_NAME"
LOG_FILE="/var/log/$APP_NAME/upgrade.log"
PACKAGE_URL="${PACKAGE_URL:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE; }

upgrade() {
    log "开始升级..."
    mkdir -p $BACKUP_DIR
    
    # 备份
    BACKUP="${APP_NAME}_$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$BACKUP_DIR/$BACKUP" -C /opt $APP_NAME --exclude='node_modules' 2>/dev/null || true
    log "备份: $BACKUP"
    
    # 下载新版本（如果配置了 URL）
    if [ -n "$PACKAGE_URL" ]; then
        log "下载: $PACKAGE_URL"
        curl -L -o /tmp/upgrade.tar.gz "$PACKAGE_URL" || { log "下载失败"; return 1; }
        tar -xzf /tmp/upgrade.tar.gz -C /tmp/
        
        pm2 stop $APP_NAME 2>/dev/null || true
        
        [ -d "/tmp/backend" ] && cp -r /tmp/backend/* $APP_DIR/backend/
        [ -d "/tmp/frontend/dist" ] && cp -r /tmp/frontend/dist/* $APP_DIR/frontend/dist/
        
        cd $APP_DIR/backend && pnpm install --prod=false
        npx prisma generate && npx prisma db push 2>/dev/null || true
        
        pm2 restart $APP_NAME
        pm2 save
        rm -rf /tmp/backend /tmp/frontend /tmp/upgrade.tar.gz
        log "升级完成"
    else
        log "未配置 PACKAGE_URL，跳过下载"
    fi
}

rollback() {
    echo "可用备份:"; ls -lt $BACKUP_DIR/*.tar.gz | head -5
}

case "$1" in
    upgrade) upgrade ;;
    rollback) rollback ;;
    *) echo "用法: $0 {upgrade|rollback}" ;;
esac
EOF
chmod +x /opt/acematic-ops/upgrade.sh
```

### 步骤 2：在 Cloud Studio 创建触发升级脚本

```bash
# 在 Cloud Studio 执行此命令创建脚本
cat > /workspace/trigger-upgrade.sh << 'EOF'
#!/bin/bash
# 触发部署服务器升级
echo "触发远程升级..."
curl -X POST http://43.138.204.20:9000/hooks/acematic-upgrade
EOF
chmod +x /workspace/trigger-upgrade.sh
```

### 步骤 3：每次迭代后升级

在 Cloud Studio 完成代码迭代后：

```bash
# 1. 构建前端
cd /workspace/frontend && pnpm build

# 2. 更新部署包（通过 HTTP 服务让服务器下载）
# 先启动临时文件服务
cd /workspace && python3 -m http.server 8888 &

# 3. 在服务器上执行升级（使用 Cloud Studio 的文件地址）
# PACKAGE_URL="https://8888-xxx.cloudstudio.club/acematic-ops.tar.gz" /opt/acematic-ops/upgrade.sh upgrade

# 或直接通过 webhook 触发
./trigger-upgrade.sh
```

---

## 命令速查

| 操作 | 命令 |
|-----|------|
| 手动升级 | `/opt/acematic-ops/upgrade.sh upgrade` |
| 查看备份 | `/opt/acematic-ops/upgrade.sh rollback` |
| 触发远程升级 | `curl -X POST http://43.138.204.20:9000/hooks/acematic-upgrade` |
| 查看升级日志 | `tail -f /var/log/acematic-ops/upgrade.log` |
| 查看服务状态 | `pm2 status` |
