#!/bin/bash
# ACEMATIC运营管理系统部署脚本
# 域名: okr.acematic.com.cn
# 端口: 前端80/443, 后端API 3000

set -e

echo "=========================================="
echo "  ACEMATIC 运营管理系统部署脚本"
echo "=========================================="

# 检查是否为root
if [ "$EUID" -ne 0 ]; then
  echo "请使用root用户执行此脚本"
  exit 1
fi

# 配置变量
DOMAIN="okr.acematic.com.cn"
APP_DIR="/opt/acematic-ops"
DB_PASSWORD="Acematic@2024"

# 1. 安装依赖
echo "[1/8] 安装系统依赖..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  yum install -y nodejs
fi

if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi

if ! command -v nginx &> /dev/null; then
  yum install -y nginx
fi

# 安装 PostgreSQL (如果没有)
if ! command -v psql &> /dev/null; then
  yum install -y postgresql-server postgresql-contrib
  postgresql-setup initdb
  systemctl enable postgresql
  systemctl start postgresql
  sudo -u postgres psql -c "CREATE DATABASE acematic_ops;"
  sudo -u postgres psql -c "CREATE USER acematic WITH PASSWORD '$DB_PASSWORD';"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE acematic_ops TO acematic;"
  # 修改pg_hba.conf允许密码认证
  sed -i 's/ident/md5/g' /var/lib/pgsql/data/pg_hba.conf
  systemctl restart postgresql
fi

# 2. 创建应用目录
echo "[2/8] 创建应用目录..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/backend
mkdir -p $APP_DIR/frontend/dist

# 3. 检查是否已有项目文件
if [ -d "/workspace" ] && [ -d "/workspace/backend" ]; then
  echo "[3/8] 复制项目文件..."
  cp -r /workspace/backend/* $APP_DIR/backend/
  cp -r /workspace/frontend/dist $APP_DIR/frontend/
elif [ -f "./package.json" ]; then
  echo "[3/8] 当前目录已是项目目录..."
else
  echo "[3/8] 请将项目文件上传到服务器后再执行..."
  echo "需要以下文件:"
  echo "  - backend/ 目录"
  echo "  - frontend/dist/ 目录"
  exit 1
fi

# 4. 安装依赖并构建
echo "[4/8] 安装后端依赖..."
cd $APP_DIR/backend
pnpm install

# 5. 配置环境变量
echo "[5/8] 配置环境变量..."
cat > $APP_DIR/backend/.env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://acematic:$DB_PASSWORD@localhost:5432/acematic_ops?schema=public"
JWT_SECRET="$(openssl rand -hex 32)"
CORS_ORIGIN="https://$DOMAIN"
EOF

# 6. 初始化数据库
echo "[6/8] 初始化数据库..."
cd $APP_DIR/backend
npx prisma generate
npx prisma migrate deploy || npx prisma db push
npx tsx prisma/seed.ts

# 7. 配置PM2
echo "[7/8] 配置进程管理..."
npm install -g pm2
cd $APP_DIR/backend
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'acematic-api',
    script: 'src/index.ts',
    interpreter: 'node',
    interpreter_args: '--require tsx/cjs',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 8. 配置Nginx
echo "[8/8] 配置Nginx..."
cat > /etc/nginx/conf.d/acematic-ops.conf << EOF
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL证书 (需要配置)
    ssl_certificate /etc/nginx/ssl/$DOMAIN.crt;
    ssl_certificate_key /etc/nginx/ssl/$DOMAIN.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 前端静态文件
    location / {
        root $APP_DIR/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# 创建SSL目录
mkdir -p /etc/nginx/ssl

# 检查是否有SSL证书
if [ ! -f "/etc/nginx/ssl/$DOMAIN.crt" ]; then
  echo ""
  echo "=========================================="
  echo "  SSL证书配置"
  echo "=========================================="
  echo "请将SSL证书文件放置到:"
  echo "  /etc/nginx/ssl/$DOMAIN.crt (证书)"
  echo "  /etc/nginx/ssl/$DOMAIN.key (私钥)"
  echo ""
  echo "或使用Let's Encrypt免费证书:"
  echo "  yum install -y certbot python3-certbot-nginx"
  echo "  certbot --nginx -d $DOMAIN"
  echo "=========================================="
  
  # 临时使用HTTP配置
  cat > /etc/nginx/conf.d/acematic-ops.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        root $APP_DIR/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
fi

# 重启Nginx
nginx -t && systemctl restart nginx

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo "访问地址: http://$DOMAIN"
echo "API地址: http://$DOMAIN/api"
echo ""
echo "默认账号: ceo"
echo "默认密码: 123456"
echo ""
echo "日志查看: pm2 logs acematic-api"
echo "重启服务: pm2 restart acematic-api"
echo "=========================================="
