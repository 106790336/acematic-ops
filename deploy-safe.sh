#!/bin/bash
# ==========================================
# ACEMATIC 运营管理系统部署脚本
# 与现有小龙虾应用共存，互不影响
# ==========================================

set -e

echo ""
echo "=========================================="
echo "  ACEMATIC 运营管理系统部署"
echo "  域名: okr.acematic.com.cn"
echo "  API端口: 3000 (独立)"
echo "=========================================="
echo ""

# 配置
DOMAIN="okr.acematic.com.cn"
APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
API_PORT=3000
DB_NAME="acematic_ops"
DB_USER="acematic"
DB_PASS="Acematic@Ops2024"

echo "[1/6] 检查环境..."
echo "系统: $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"

# 安装 Node.js
echo ""
echo "[2/6] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js: $(node -v)"

# 安装工具
echo ""
echo "[3/6] 安装 pnpm 和 pm2..."
npm install -g pnpm pm2
echo "pnpm: $(pnpm -v)"
echo "pm2: $(pm2 -v)"

# 安装 PostgreSQL
echo ""
echo "[4/6] 配置 PostgreSQL..."
if ! systemctl is-active --quiet postgresql; then
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# 配置密码认证
PG_HBA="/etc/postgresql/*/main/pg_hba.conf"
for f in $PG_HBA; do
    if [ -f "$f" ]; then
        sed -i 's/peer/md5/g' "$f"
        sed -i 's/scram-sha-256/md5/g' "$f"
    fi
done
systemctl restart postgresql

# 创建数据库（不覆盖现有）
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# 创建应用目录
echo ""
echo "[5/6] 部署应用..."
mkdir -p $APP_DIR/{backend,frontend/dist,uploads}
mkdir -p /var/log/$APP_NAME

# 检查是否有部署包
if [ -f "/opt/app.tar.gz" ]; then
    echo "解压部署包..."
    cd /opt
    tar -xzf app.tar.gz
    [ -d "backend" ] && cp -r backend/* $APP_DIR/backend/
    [ -d "frontend/dist" ] && cp -r frontend/dist/* $APP_DIR/frontend/dist/
else
    echo ""
    echo "[警告] 未找到部署包 /opt/app.tar.gz"
    echo "请先上传文件，然后继续..."
    echo ""
    read -p "文件已上传? 按回车继续..."
fi

# 安装依赖
cd $APP_DIR/backend
echo "安装依赖..."
pnpm install --prod=false
npx prisma generate

# 环境变量
JWT_SECRET=$(openssl rand -hex 32)
cat > .env << EOF
NODE_ENV=production
PORT=$API_PORT
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
JWT_SECRET="$JWT_SECRET"
CORS_ORIGIN="https://$DOMAIN,http://$DOMAIN"
EOF

# 初始化数据库
echo "初始化数据库..."
npx prisma db push --accept-data-loss 2>/dev/null || true
npx tsx prisma/seed.ts 2>/dev/null || echo "数据已存在"

# 启动服务
echo ""
echo "[6/6] 配置服务..."
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start src/index.ts --name $APP_NAME --interpreter node --interpreter-args "--require tsx/cjs"
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

# 配置 Nginx（不覆盖现有配置）
cat > /etc/nginx/conf.d/$APP_NAME.conf << 'NGINX_CONF'
# ACEMATIC 运营管理系统
# 域名: okr.acematic.com.cn

upstream acematic_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name okr.acematic.com.cn;
    
    client_max_body_size 50M;
    
    # 前端
    location / {
        root /opt/acematic-ops/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API
    location /api {
        proxy_pass http://acematic_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
    
    # 上传文件
    location /uploads {
        alias /opt/acematic-ops/backend/uploads;
        autoindex off;
    }
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    access_log /var/log/nginx/acematic_ops_access.log;
    error_log /var/log/nginx/acematic_ops_error.log;
}
NGINX_CONF

# 测试并重载 Nginx
if nginx -t; then
    systemctl reload nginx
    echo "Nginx 配置成功"
else
    echo "Nginx 配置错误!"
    exit 1
fi

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "访问地址: http://$DOMAIN"
echo ""
echo "默认账号: ceo"
echo "默认密码: 123456"
echo ""
echo "【服务信息】"
echo "应用目录: $APP_DIR"
echo "API端口: $API_PORT"
echo "数据库名: $DB_NAME"
echo ""
echo "【常用命令】"
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs $APP_NAME"
echo "重启服务: pm2 restart $APP_NAME"
echo ""
echo "【注意事项】"
echo "1. 请确保域名 $DOMAIN 已解析到本服务器"
echo "2. 小龙虾应用不受影响，继续正常运行"
echo "=========================================="

pm2 status
