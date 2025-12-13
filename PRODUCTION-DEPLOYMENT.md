# 生产环境部署指南

## 🚀 快速部署 (使用 .env 文件)

### 1. 准备服务器

```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 2. 上传项目到服务器

**方法 A: Git Clone (推荐)**

```bash
# 在服务器上
git clone https://your-repo.git ipcheck
cd ipcheck
```

**方法 B: 手动上传**

```bash
# 在本地 (排除敏感文件)
rsync -avz --exclude='.env' --exclude='node_modules' \
  ./ user@your-server:/app/ipcheck/
```

### 3. 配置环境变量

**⚠️ 重要: 不要上传本地的 .env 文件到服务器!**

在服务器上创建新的 .env:

```bash
# 在服务器上
cd /app/ipcheck
cp .env.example .env
nano .env  # 或使用 vim

# 填入生产环境的 API 密钥
```

**设置安全权限**:

```bash
chmod 600 .env          # 只有所有者可读写
chown root:root .env    # 所有者为 root (可选)
```

### 4. 部署

```bash
# 使用部署脚本
chmod +x deploy-to-server.sh
./deploy-to-server.sh

# 或手动部署
docker-compose up -d
```

### 5. 验证部署

```bash
# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs -f api

# 测试 API
curl http://localhost:8080/api/debug/config
curl "http://localhost:8080/api/check?ip=8.8.8.8"
```

---

## 🔒 安全最佳实践

### ❌ 不要做的事

1. **不要把 .env 提交到 Git**
   ```bash
   # 确保 .gitignore 包含
   echo ".env" >> .gitignore
   git rm --cached .env  # 如果已经提交了
   ```

2. **不要在日志中打印环境变量**
   ```bash
   # 错误示例
   echo "IPQS_KEY=${IPQS_KEY}"  # ❌ 不要这样做!

   # 正确示例
   echo "IPQS_KEY configured: ${IPQS_KEY:+yes}"  # ✅ 只显示是否配置
   ```

3. **不要使用弱文件权限**
   ```bash
   # 错误
   chmod 644 .env  # ❌ 其他用户可读!

   # 正确
   chmod 600 .env  # ✅ 只有所有者可读写
   ```

### ✅ 推荐做法

#### 1. 使用环境变量代替 .env 文件

在 `/etc/systemd/system/docker-compose-ipcheck.service` 创建服务:

```ini
[Unit]
Description=IP Check Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/app/ipcheck
Environment="IPQS_KEY=your_key_here"
Environment="ABUSEIPDB_KEY=your_key_here"
Environment="CLOUDFLARE_API_TOKEN=your_token_here"
Environment="LLM_API_KEY=your_llm_key"
Environment="IP2LOCATION_KEY=your_key"
Environment="IPDATA_KEY=your_key"
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable docker-compose-ipcheck
sudo systemctl start docker-compose-ipcheck
```

#### 2. 使用密钥管理服务

**HashiCorp Vault**:

```bash
# 从 Vault 读取密钥
export IPQS_KEY=$(vault kv get -field=key secret/ipcheck/ipqs)
docker-compose up -d
```

**AWS Secrets Manager**:

```bash
# 从 AWS 读取密钥
export IPQS_KEY=$(aws secretsmanager get-secret-value \
  --secret-id ipcheck/ipqs --query SecretString --output text)
docker-compose up -d
```

#### 3. 定期轮换密钥

```bash
# 创建密钥轮换脚本
cat > rotate-keys.sh << 'EOF'
#!/bin/bash
# 1. 生成新的 API 密钥 (在各个服务商后台)
# 2. 更新 .env 文件
# 3. 重启服务
docker-compose restart api
# 4. 验证新密钥工作正常
# 5. 撤销旧密钥
EOF
```

---

## 🌐 反向代理配置 (Nginx/Caddy)

### 使用 Nginx

```nginx
# /etc/nginx/sites-available/ipcheck
server {
    listen 80;
    server_name ipcheck.yourdomain.com;

    # 强制 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ipcheck.yourdomain.com;

    # SSL 证书 (使用 Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/ipcheck.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ipcheck.yourdomain.com/privkey.pem;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/ipcheck /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 获取 SSL 证书
sudo certbot --nginx -d ipcheck.yourdomain.com
```

### 使用 Caddy (自动 HTTPS)

```caddyfile
# /etc/caddy/Caddyfile
ipcheck.yourdomain.com {
    reverse_proxy localhost:8080

    # 自动获取和续期 SSL 证书
    tls {
        protocols tls1.2 tls1.3
    }

    # 安全头
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }
}
```

---

## 📊 监控和日志

### 查看日志

```bash
# 实时日志
docker-compose logs -f

# 只看 API 日志
docker-compose logs -f api

# 查看最近 100 行
docker-compose logs --tail=100 api

# 保存日志到文件
docker-compose logs api > api.log
```

### 配置日志轮转

```bash
# /etc/logrotate.d/docker-ipcheck
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=10M
    missingok
    delaycompress
    copytruncate
}
```

### 健康检查脚本

```bash
#!/bin/bash
# /usr/local/bin/ipcheck-health.sh

HEALTH_URL="http://localhost:8080/health"
ALERT_EMAIL="admin@yourdomain.com"

if ! curl -f $HEALTH_URL > /dev/null 2>&1; then
    echo "IP Check service is down!" | \
        mail -s "ALERT: IP Check Down" $ALERT_EMAIL

    # 自动重启
    cd /app/ipcheck
    docker-compose restart
fi
```

```bash
# 添加到 crontab
*/5 * * * * /usr/local/bin/ipcheck-health.sh
```

---

## 🔄 更新和维护

### 更新代码

```bash
cd /app/ipcheck
git pull
docker-compose build --no-cache
docker-compose up -d
```

### 备份

```bash
#!/bin/bash
# 备份脚本

BACKUP_DIR="/backup/ipcheck"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份 .env (加密)
tar czf $BACKUP_DIR/env_${DATE}.tar.gz .env
gpg --encrypt --recipient admin@yourdomain.com \
    $BACKUP_DIR/env_${DATE}.tar.gz

# 备份 Redis 数据
docker-compose exec redis redis-cli SAVE
docker cp ipcheck-redis-1:/data/dump.rdb \
    $BACKUP_DIR/redis_${DATE}.rdb

# 删除明文备份
rm $BACKUP_DIR/env_${DATE}.tar.gz
```

---

## 🐛 故障排查

### 容器启动失败

```bash
# 查看详细日志
docker-compose logs api

# 检查配置
docker-compose config

# 重新构建
docker-compose build --no-cache api
docker-compose up -d
```

### API 密钥未生效

```bash
# 检查环境变量
docker-compose exec api env | grep -E "IPQS|ABUSEIPDB|CLOUDFLARE"

# 重新加载环境变量
docker-compose down
docker-compose up -d
```

### 端口被占用

```bash
# 查看端口占用
sudo lsof -i :8080
sudo netstat -tulpn | grep 8080

# 修改端口 (docker-compose.yml)
ports:
  - "8888:80"  # 改为 8888
```

---

## 📚 相关文档

- [Docker 生产环境最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose 环境变量](https://docs.docker.com/compose/environment-variables/)
- [12-Factor App](https://12factor.net/)
