#!/bin/bash
# 服务器端口检测脚本 - 在Web终端执行

echo "=========================================="
echo "  服务器端口检测"
echo "=========================================="
echo ""

echo "【端口占用情况】"
echo "端口 80: $(netstat -tlnp 2>/dev/null | grep ':80 ' || ss -tlnp 2>/dev/null | grep ':80 ' || echo '空闲')"
echo "端口 443: $(netstat -tlnp 2>/dev/null | grep ':443 ' || ss -tlnp 2>/dev/null | grep ':443 ' || echo '空闲')"
echo "端口 3000: $(netstat -tlnp 2>/dev/null | grep ':3000 ' || ss -tlnp 2>/dev/null | grep ':3000 ' || echo '空闲')"
echo "端口 3001: $(netstat -tlnp 2>/dev/null | grep ':3001 ' || ss -tlnp 2>/dev/null | grep ':3001 ' || echo '空闲')"
echo "端口 5000: $(netstat -tlnp 2>/dev/null | grep ':5000 ' || ss -tlnp 2>/dev/null | grep ':5000 ' || echo '空闲')"
echo "端口 5432: $(netstat -tlnp 2>/dev/null | grep ':5432 ' || ss -tlnp 2>/dev/null | grep ':5432 ' || echo '空闲')"
echo "端口 8080: $(netstat -tlnp 2>/dev/null | grep ':8080 ' || ss -tlnp 2>/dev/null | grep ':8080 ' || echo '空闲')"

echo ""
echo "【运行中的服务】"
systemctl list-units --type=service --state=running | grep -E 'nginx|apache|node|pm2|docker|mysql|postgres|redis' || echo "无相关服务"

echo ""
echo "【PM2 进程】"
pm2 list 2>/dev/null || echo "PM2 未运行"

echo ""
echo "【Docker 容器】"
docker ps 2>/dev/null || echo "Docker 未运行或未安装"

echo ""
echo "【Nginx 配置】"
ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "Nginx 未安装"

echo ""
echo "【检测完成】"
