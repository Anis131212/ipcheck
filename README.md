# IP 质量检测系统 (IP Quality Detection System)

这是一个基于 Node.js (Fastify) 和 React 的全栈 IP 质量检测系统，支持 Docker 容器化部署。

## 功能特点

- **多源 IP 检测**: 聚合 IPQualityScore, ip-api.com, AbuseIPDB 等多个数据源。
- **风险评分**: 直观的仪表盘展示 IP 欺诈分数和风险等级。
- **环境一致性检测**: 自动对比 WebRTC IP 与连接 IP，检测时区和语言一致性。
- **连通性测试**: 内置 Google, YouTube, GitHub 连通性测试。
- **高性能**: 后端采用 Fastify，支持 Redis 缓存和高并发。
- **现代化 UI**: 清新绿色的 React 前端界面，适配移动端。

## 快速开始 (本地/开发)

确保已安装 Docker 和 Docker Compose。

1. **配置环境变量**
   复制 `.env` 文件并填入 API Key (可选，但推荐用于获取风险评分)。
   ```bash
   # 编辑 .env 文件
   IPQS_KEY=your_key_here
   ```

2. **启动服务**
   ```bash
   docker-compose up --build
   ```

3. **访问应用**
   打开浏览器访问 `http://localhost:8080`。

## 服务器部署指南 (Production)

本系统支持在任何安装了 Docker 的 Linux 服务器上部署 (Ubuntu/CentOS/Debian)。

### 1. 环境准备
确保服务器已安装 Docker 和 Docker Compose。
```bash
# Ubuntu 安装 Docker
curl -fsSL https://get.docker.com | bash
```

### 2. 获取代码
将项目文件上传到服务器，或使用 git clone。
```bash
# 假设上传到了 /opt/ipcheck 目录
cd /opt/ipcheck
```

### 3. 配置
创建并编辑 `.env` 文件：
```bash
nano .env
```
填入以下内容：
```env
IPQS_KEY=你的IPQualityScore密钥
ABUSEIPDB_KEY=你的AbuseIPDB密钥(可选)
REDIS_HOST=redis
```

### 4. 启动服务
使用 Docker Compose 后台启动：
```bash
docker compose up -d --build
```

### 5. 配置域名与 SSL (可选，推荐)
建议使用 Nginx Proxy Manager 或手动配置 Nginx 进行反向代理，将域名指向服务器的 `8080` 端口。

**Nginx 配置示例:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 目录结构

- `backend/`: Node.js 后端服务
- `frontend/`: React 前端应用
- `nginx/`: Nginx 反向代理配置
- `docker-compose.yml`: 容器编排配置

## 常见问题

- **端口冲突**: 默认使用 `8080` 端口。如果被占用，请修改 `docker-compose.yml` 中的 `8080:80` 为其他端口。
- **IP 显示为内网 IP**: 请确保 Nginx 配置了 `proxy_set_header X-Forwarded-For`，后端已开启 `trustProxy` (默认已开启)。
