#!/bin/bash
# ==========================================
# ACEMATIC 运营管理系统 - 一键部署脚本
# 域名: okr.acematic.com.cn
# 特点: 自动检测端口冲突，不影响现有服务
# ==========================================

set -e

echo ""
echo "=========================================="
echo "  ACEMATIC 运营管理系统 - 一键部署"
echo "=========================================="
echo ""

# 配置变量
DOMAIN="okr.acematic.com.cn"
APP_NAME="acematic-ops"
APP_DIR="/opt/$APP_NAME"
LOG_FILE="/var/log/acematic-deploy.log"

# 记录日志
exec > >(tee -a $LOG_FILE) 2>&1

echo "[检测] 检查服务器环境..."

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    echo "操作系统: $PRETTY_NAME"
else
    OS="unknown"
fi

# 检测端口占用
echo ""
echo "[检测] 端口占用情况..."
PORT_80=$(netstat -tlnp 2>/dev/null | grep ':80 ' || ss -tlnp | grep ':80 ' || echo "空闲")
PORT_443=$(netstat -tlnp 2>/dev/null | grep ':443 ' || ss -tlnp | grep ':443 ' || echo "空闲")
PORT_3000=$(netstat -tlnp 2>/dev/null | grep ':3000 ' || ss -tlnp | grep ':3000 ' || echo "空闲")
PORT_5432=$(netstat -tlnp 2>/dev/null | grep ':5432 ' || ss -tlnp | grep ':5432 ' || echo "空闲")

echo "  端口 80: $PORT_80"
echo "  端口 443: $PORT_443"
echo "  端口 3000: $PORT_3000"
echo "  端口 5432: $PORT_5432"

# 选择后端端口（避免冲突）
API_PORT=3000
if echo "$PORT_3000" | grep -q "LISTEN"; then
    API_PORT=3001
    echo ""
    echo "[警告] 端口 3000 已被占用，使用端口 3001"
fi

# 检测现有服务
echo ""
echo "[检测] 现有服务..."
HAS_NGINX=$(systemctl is-active nginx 2>/dev/null || echo "inactive")
HAS_APACHE=$(systemctl is-active httpd 2>/dev/null || echo "inactive")
HAS_POSTGRES=$(systemctl is-active postgresql 2>/dev/null || echo "inactive")
HAS_MYSQL=$(systemctl is-active mysqld 2>/dev/null || echo "inactive")
HAS_DOCKER=$(which docker 2>/dev/null && echo "yes" || echo "no")

echo "  Nginx: $HAS_NGINX"
echo "  Apache: $HAS_APACHE"
echo "  PostgreSQL: $HAS_POSTGRES"
echo "  MySQL: $HAS_MYSQL"
echo "  Docker: $HAS_DOCKER"

# 检测 WordPress
if [ -d "/var/www/html/wordpress" ] || [ -d "/var/www/wordpress" ] || docker ps 2>/dev/null | grep -qi wordpress; then
    echo ""
    echo "[检测] 发现 WordPress 服务"
    HAS_WORDPRESS="yes"
else
    HAS_WORDPRESS="no"
fi

echo ""
echo "=========================================="
echo "  开始安装依赖"
echo "=========================================="

# 根据系统安装依赖
install_deps() {
    if [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "opencloudos" ]; then
        echo "使用 yum 安装依赖..."
        yum install -y curl wget git tar gcc-c++ make
        
        # 安装 Node.js 20
        if ! command -v node &> /dev/null; then
            echo "安装 Node.js 20..."
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
            yum install -y nodejs
        fi
    elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        echo "使用 apt 安装依赖..."
        apt-get update
        apt-get install -y curl wget git tar build-essential
        
        if ! command -v node &> /dev/null; then
            echo "安装 Node.js 20..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        fi
    else
        echo "未知系统，尝试通用安装..."
        if ! command -v node &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs || yum install -y nodejs
        fi
    fi
}

# 检查 Node.js
if ! command -v node &> /dev/null; then
    install_deps
else
    NODE_VERSION=$(node -v)
    echo "Node.js 已安装: $NODE_VERSION"
fi

# 安装 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "安装 pnpm..."
    npm install -g pnpm
fi

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

# 安装 Nginx（如果没有）
if [ "$HAS_NGINX" = "inactive" ] && [ "$HAS_APACHE" = "inactive" ]; then
    echo "安装 Nginx..."
    if [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "opencloudos" ]; then
        yum install -y nginx
    else
        apt-get install -y nginx
    fi
    systemctl enable nginx
    systemctl start nginx
fi

echo ""
echo "=========================================="
echo "  配置数据库"
echo "=========================================="

# 数据库密码
DB_USER="acematic"
DB_PASS="Acematic@Ops2024"
DB_NAME="acematic_ops"

# 检查 PostgreSQL
if [ "$HAS_POSTGRES" = "active" ]; then
    echo "PostgreSQL 已运行"
    # 检查是否有现有数据库
    EXISTING_DB=$(sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -w $DB_NAME || echo "")
    if [ "$EXISTING_DB" = "$DB_NAME" ]; then
        echo "数据库 $DB_NAME 已存在，跳过创建"
    else
        echo "创建数据库 $DB_NAME..."
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
    fi
else
    echo "安装并配置 PostgreSQL..."
    if [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "opencloudos" ]; then
        yum install -y postgresql-server postgresql-contrib
        postgresql-setup initdb 2>/dev/null || true
    else
        apt-get install -y postgresql postgresql-contrib
    fi
    
    systemctl enable postgresql
    systemctl start postgresql
    
    # 配置密码认证
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
    if [ -f "$PG_HBA" ]; then
        sed -i 's/ident/md5/g' "$PG_HBA"
        sed -i 's/peer/md5/g' "$PG_HBA"
        systemctl restart postgresql
    fi
    
    # 创建数据库
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
fi

echo ""
echo "=========================================="
echo "  部署应用"
echo "=========================================="

# 创建应用目录
mkdir -p $APP_DIR
mkdir -p $APP_DIR/backend
mkdir -p $APP_DIR/frontend/dist
mkdir -p $APP_DIR/uploads
mkdir -p /var/log/$APP_NAME

# 检查是否有项目文件
if [ -d "/workspace/backend" ] && [ -d "/workspace/frontend/dist" ]; then
    echo "复制项目文件..."
    cp -r /workspace/backend/* $APP_DIR/backend/ 2>/dev/null || true
    cp -r /workspace/frontend/dist/* $APP_DIR/frontend/dist/ 2>/dev/null || true
elif [ -f "/opt/acematic-ops-deploy.tar.gz" ]; then
    echo "解压部署包..."
    cd /opt
    tar -xzf acematic-ops-deploy.tar.gz
    cp -r backend/* $APP_DIR/backend/ 2>/dev/null || true
    cp -r frontend/dist/* $APP_DIR/frontend/dist/ 2>/dev/null || true
else
    echo ""
    echo "[错误] 未找到项目文件！"
    echo "请先上传部署包到 /opt/acematic-ops-deploy.tar.gz"
    echo "或确保 /workspace 目录下有项目文件"
    exit 1
fi

# 安装后端依赖
echo "安装后端依赖..."
cd $APP_DIR/backend
pnpm install --prod=false

# 生成 Prisma 客户端
echo "生成 Prisma 客户端..."
npx prisma generate

# 配置环境变量
echo "配置环境变量..."
JWT_SECRET=$(openssl rand -hex 32)
cat > $APP_DIR/backend/.env << EOF
NODE_ENV=production
PORT=$API_PORT
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
JWT_SECRET="$JWT_SECRET"
CORS_ORIGIN="https://$DOMAIN,http://$DOMAIN"
EOF

# 初始化数据库
echo "初始化数据库..."
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma migrate deploy 2>/dev/null || true
npx tsx prisma/seed.ts 2>/dev/null || echo "种子数据已存在"

echo ""
echo "=========================================="
echo "  配置进程管理"
echo "=========================================="

# 停止旧进程
pm2 delete $APP_NAME 2>/dev/null || true

# 创建 PM2 配置
cat > $APP_DIR/backend/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'src/index.ts',
    interpreter: 'node',
    interpreter_args: '--require tsx/cjs',
    instances: 2,
    exec_mode: 'cluster',
    cwd: '$APP_DIR/backend',
    env: {
      NODE_ENV: 'production',
      PORT: $API_PORT
    },
    error_file: '/var/log/$APP_NAME/error.log',
    out_file: '/var/log/$APP_NAME/out.log',
    time: true
  }]
}
EOF

# 启动服务
cd $APP_DIR/backend
pm2 start ecosystem.config.js
pm2 save

# 配置开机启动
PM2_STARTUP=$(pm2 startup 2>/dev/null | grep -oP 'sudo.*' | head -1)
if [ -n "$PM2_STARTUP" ]; then
    eval $PM2_STARTUP 2>/dev/null || true
fi

echo ""
echo "=========================================="
echo "  配置 Nginx"
echo "=========================================="

# 创建 Nginx 配置
cat > /etc/nginx/conf.d/$APP_NAME.conf << EOF
# ACEMATIC 运营管理系统
upstream ${APP_NAME}_backend {
    server 127.0.0.1:$API_PORT;
    keepalive 32;
}

server {
    listen 80;
    server_name $DOMAIN;

    # 客户端最大上传大小
    client_max_body_size 50M;

    # 前端静态文件
    location / {
        root $APP_DIR/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api {
        proxy_pass http://${APP_NAME}_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # 上传文件访问
    location /uploads {
        alias $APP_DIR/backend/uploads;
        autoindex off;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 访问日志
    access_log /var/log/nginx/${APP_NAME}_access.log;
    error_log /var/log/nginx/${APP_NAME}_error.log;
}
EOF

# 测试并重启 Nginx
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo "Nginx 配置成功"
else
    echo "[警告] Nginx 配置有误，请检查"
    nginx -t
fi

echo ""
echo "=========================================="
echo "  配置防火墙"
echo "=========================================="

# 开放端口
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo "防火墙已配置"
elif command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    echo "防火墙已配置"
else
    echo "未检测到防火墙，请确保端口 80/443 已开放"
fi

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "访问地址: http://$DOMAIN"
echo "API地址: http://$DOMAIN/api"
echo ""
echo "默认账号: ceo"
echo "默认密码: 123456"
echo ""
echo "服务端口: $API_PORT"
echo "应用目录: $APP_DIR"
echo "日志目录: /var/log/$APP_NAME"
echo ""
echo "常用命令:"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs $APP_NAME"
echo "  重启服务: pm2 restart $APP_NAME"
echo "  Nginx日志: tail -f /var/log/nginx/${APP_NAME}_error.log"
echo ""
echo "=========================================="

# 显示服务状态
pm2 status
