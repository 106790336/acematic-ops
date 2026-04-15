# 自动升级部署系统

## 概述

本系统提供三种升级方式：
1. **手动升级** - 通过脚本一键升级
2. **定时自动升级** - 定期检查版本自动升级
3. **Webhook 触发升级** - Git 仓库更新时自动触发

---

## 快速升级命令

### 一键升级
```bash
cd /opt/acematic-ops
./upgrade.sh upgrade
```

### 回滚到上一版本
```bash
./upgrade.sh rollback
# 或指定备份文件
./upgrade.sh rollback acematic-ops_20260414_123456.tar.gz
```

---

## 安装自动升级服务

### 1. 部署升级脚本

```bash
# 创建目录
mkdir -p /opt/acematic-ops/scripts
mkdir -p /opt/backups/acematic-ops
mkdir -p /var/log/acematic-ops

# 复制脚本
cp upgrade.sh /opt/acematic-ops/
cp auto-sync.sh /opt/acematic-ops/scripts/

chmod +x /opt/acematic-ops/upgrade.sh
chmod +x /opt/acematic-ops/scripts/auto-sync.sh
```

### 2. 配置 Systemd 服务

```bash
cat > /etc/systemd/system/acematic-sync.service << 'EOF'
[Unit]
Description=ACEMATIC Auto Sync Service
After=network.target

[Service]
Type=simple
ExecStart=/opt/acematic-ops/scripts/auto-sync.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable acematic-sync
systemctl start acematic-sync
```

### 3. 配置 Webhook 接收器

```bash
# 安装 webhook
apt install webhook -y

# 创建 webhook 配置
mkdir -p /etc/webhook
cat > /etc/webhook/hooks.json << 'EOF'
[
  {
    "id": "acematic-upgrade",
    "execute-command": "/opt/acematic-ops/upgrade.sh",
    "command-working-directory": "/opt/acematic-ops",
    "response-message": "Upgrade triggered",
    "trigger-rule": {
      "match": {
        "type": "payload-hmac-sha256",
        "secret": "YOUR_WEBHOOK_SECRET",
        "parameter": {
          "source": "header",
          "name": "X-Hub-Signature-256"
        }
      }
    }
  }
]
EOF

# 启动 webhook 服务
cat > /etc/systemd/system/webhook.service << 'EOF'
[Unit]
Description=Webhook Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/webhook -hooks /etc/webhook/hooks.json -port 9000 -verbose
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable webhook
systemctl start webhook
```

---

## 版本服务器配置

创建一个简单的版本检查服务：

```bash
# 在版本服务器上
echo "1.0.1" > /var/www/version.txt

# 应用服务器检查版本
curl -s https://your-domain.com/version.txt
```

---

## AI 自动同步升级

### 方案 1: 定时检查（推荐）

```bash
# 每5分钟检查一次版本
# 已通过 systemd 服务配置
```

### 方案 2: Git Webhook 触发

1. 在 Git 仓库设置 Webhook URL:
   ```
   http://43.138.204.20:9000/hooks/acematic-upgrade
   ```

2. 设置 Webhook Secret

3. 每次推送代码自动触发升级

### 方案 3: CI/CD 集成

在 GitLab CI / GitHub Actions 中添加：

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger upgrade
        run: |
          curl -X POST http://43.138.204.20:9000/hooks/acematic-upgrade \
            -H "X-Hub-Signature-256: ${{ secrets.WEBHOOK_SECRET }}"
```

---

## 当前配置信息

| 项目 | 值 |
|-----|-----|
| 应用目录 | /opt/acematic-ops |
| 备份目录 | /opt/backups/acematic-ops |
| 日志目录 | /var/log/acematic-ops |
| 检查间隔 | 5 分钟 |
| Webhook 端口 | 9000 |

---

## 常用命令

```bash
# 查看自动同步状态
systemctl status acematic-sync

# 查看同步日志
tail -f /var/log/acematic-ops/sync.log

# 手动触发检查
/opt/acematic-ops/scripts/auto-sync.sh

# 查看可用备份
ls -lt /opt/backups/acematic-ops/

# 停止自动升级
systemctl stop acematic-sync
```
