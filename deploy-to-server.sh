#!/bin/bash
# IP Check 安全部署脚本

set -e

echo "🚀 开始部署 IP Check 系统..."

# 1. 确保 .env 不在 Git 中
if git ls-files --error-unmatch .env > /dev/null 2>&1; then
    echo "❌ 错误: .env 文件在 Git 版本控制中!"
    echo "   请运行: git rm --cached .env"
    exit 1
fi

# 2. 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "   请从 .env.example 创建 .env 并填入真实密钥"
    exit 1
fi

# 3. 设置安全权限
chmod 600 .env
echo "✅ 已设置 .env 安全权限 (600)"

# 4. 验证必要的环境变量
REQUIRED_VARS=(
    "IPQS_KEY"
    "ABUSEIPDB_KEY"
    "IP2LOCATION_KEY"
    "IPDATA_KEY"
    "CLOUDFLARE_API_TOKEN"
    "LLM_API_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env; then
        echo "⚠️  警告: ${var} 未设置或为空"
    fi
done

# 5. 停止旧容器
echo "🛑 停止旧容器..."
docker-compose down

# 6. 拉取最新代码 (如果在 Git 仓库中)
if [ -d .git ]; then
    echo "📥 拉取最新代码..."
    git pull
fi

# 7. 构建并启动
echo "🔨 构建镜像..."
docker-compose build --no-cache

echo "🚀 启动服务..."
docker-compose up -d

# 8. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 9. 健康检查
echo "🏥 检查服务健康状态..."
if curl -f http://localhost:8080/api/debug/config > /dev/null 2>&1; then
    echo "✅ 服务启动成功!"
    echo ""
    echo "📊 API 配置状态:"
    curl -s http://localhost:8080/api/debug/config | python -m json.tool || \
    curl -s http://localhost:8080/api/debug/config
else
    echo "❌ 服务健康检查失败"
    echo "查看日志: docker-compose logs api"
    exit 1
fi

# 10. 显示运行状态
echo ""
echo "📋 容器状态:"
docker-compose ps

echo ""
echo "✅ 部署完成!"
echo "   访问: http://YOUR_SERVER_IP:8080"
echo "   日志: docker-compose logs -f api"
