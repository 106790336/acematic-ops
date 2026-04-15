# ACEMATIC 运营管理系统部署指南

## 服务器信息
- **服务器IP**: 43.138.204.20
- **域名**: okr.acematic.com.cn
- **系统**: 腾讯云轻量应用服务器

---

## 部署方式

### 方式一：通过腾讯云控制台 Web 终端（推荐）

#### 步骤 1: 上传部署包

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 进入 **轻量应用服务器** → 找到服务器 43.138.204.20
3. 点击 **登录** 按钮，选择 **WebShell登录**
4. 微信扫码完成身份验证

#### 步骤 2: 下载部署包

在服务器终端执行：

```bash
# 创建工作目录
mkdir -p /opt/acematic-ops && cd /opt

# 从本地上传文件（或使用以下命令直接创建）
# 方式A: 如果有公网可访问的文件地址
wget "YOUR_FILE_URL" -O acematic-ops-deploy.tar.gz

# 方式B: 使用 scp 从本地上传
# 在本地执行: scp -i ~/.ssh/deploy_key acematic-ops-deploy.tar.gz root@43.138.204.20:/opt/
```

#### 步骤 3: 执行部署脚本

```bash
cd /opt
tar -xzvf acematic-ops-deploy.tar.gz
chmod +x deploy.sh
./deploy.sh
```

---

### 方式二：本地 SSH 上传部署

#### 步骤 1: SSH 连接（需微信扫码）

```bash
ssh -i ~/.ssh/deploy_key root@43.138.204.20
# 使用微信扫描屏幕上的二维码完成验证
```

#### 步骤 2: 上传并部署

在本地终端执行：
```bash
# 上传部署包
scp -i ~/.ssh/deploy_key acematic-ops-deploy.tar.gz root@43.138.204.20:/opt/

# 上传完成后，在服务器上执行
ssh -i ~/.ssh/deploy_key root@43.138.204.20 "cd /opt && tar -xzvf acematic-ops-deploy.tar.gz && chmod +x deploy.sh && ./deploy.sh"
```

---

## 配置域名解析

部署完成后，需要在域名服务商处添加DNS解析：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| A | okr | 43.138.204.20 |

---

## 配置 HTTPS 证书

### 使用 Let's Encrypt 免费证书

```bash
# 安装 certbot
yum install -y certbot python3-certbot-nginx

# 自动获取并配置证书
certbot --nginx -d okr.acematic.com.cn

# 设置自动续期
echo "0 3 * * * certbot renew --quiet" | crontab -
```

### 使用已有证书

将证书文件放到服务器：
```bash
# 上传证书
scp -i ~/.ssh/deploy_key your-cert.crt root@43.138.204.20:/etc/nginx/ssl/okr.acematic.com.cn.crt
scp -i ~/.ssh/deploy_key your-key.key root@43.138.204.20:/etc/nginx/ssl/okr.acematic.com.cn.key

# 重启 nginx
ssh root@43.138.204.20 "nginx -t && systemctl restart nginx"
```

---

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs acematic-api

# 重启服务
pm2 restart acematic-api

# 查看 nginx 状态
systemctl status nginx

# 查看 nginx 日志
tail -f /var/log/nginx/error.log
```

---

## 访问系统

- **地址**: http://okr.acematic.com.cn (HTTP) 或 https://okr.acematic.com.cn (HTTPS)
- **默认账号**: ceo
- **默认密码**: 123456

---

## 故障排查

### 1. 服务无法启动
```bash
pm2 logs acematic-api --lines 100
```

### 2. 数据库连接失败
```bash
# 检查 PostgreSQL 状态
systemctl status postgresql

# 测试数据库连接
psql -U acematic -d acematic_ops -h localhost
```

### 3. Nginx 配置错误
```bash
nginx -t
cat /var/log/nginx/error.log
```

### 4. 防火墙问题
```bash
# 开放端口
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```
