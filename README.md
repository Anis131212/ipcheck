# 🌐 IP 质量检测系统

> 全栈 IP 质量检测与风险分析平台 | 支持多数据源聚合、AI 智能分析、浏览器指纹检测

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18-blue.svg)](https://reactjs.org/)

## ✨ 核心功能

### 🎯 多维度 IP 检测

- **6 大数据源聚合**
  - ✅ **IPQualityScore** - 欺诈评分、VPN/代理检测
  - ✅ **AbuseIPDB** - IP 滥用历史、举报记录
  - ✅ **ip-api.com** - 地理位置、ISP、ASN 信息
  - ✅ **IP2Location** - 代理检测、使用类型
  - ✅ **IPData** - 威胁情报 (Tor/Proxy/Abuse)
  - ✅ **Cloudflare Radar** - ASN 级别 Bot 流量统计 🆕

- **智能 IP 分类**
  - 🏠 住宅 IP (Residential) - 最优质量
  - 📱 移动 IP (Mobile) - 优秀质量
  - 🏢 商业 IP (Commercial) - 良好质量
  - 🖥️ 数据中心 IP (Data Center) - 一般质量
  - 🎓 教育 IP (Education) - 特殊类型

- **高级检测能力**
  - 🌍 **原生/广播 IP 检测** - 对比多源国家码判断 IP 真实性
  - 🔄 **双 ISP 检测** - 分析 ISP 与组织不一致性
  - 🤖 **Bot 流量分析** - 基于 ASN 的 Bot 风险评估
  - 🚨 **威胁情报检测** - Tor/VPN/Proxy/滥用标记

### 🖥️ 浏览器指纹与环境检测

- **WebRTC IP 泄露检测** - 自动检测真实 IP 与连接 IP 不一致
- **Canvas 指纹** - 生成唯一设备指纹
- **环境信息采集** - OS、浏览器、时区、语言、硬件信息
- **连通性测试** - Google、YouTube、GitHub 可达性检测

### 🤖 AI 智能分析 (可选)

- 支持任何兼容 OpenAI API 的大模型
- 综合多源数据生成专业分析报告
- 提供使用场景建议和风险提示
- Markdown 格式化输出,易于阅读

### ⚡ 高性能架构

- **后端**: Fastify (极速 Node.js 框架)
- **前端**: React 18 + Vite + TailwindCSS
- **缓存**: Redis (减少 API 调用,降低成本)
- **反向代理**: Nginx (负载均衡、SSL 终止)
- **容器化**: Docker + Docker Compose (一键部署)

## 📸 系统截图

```
┌─────────────────────────────────────────────────────────┐
│  IP 质量检测系统                                          │
│  实时风险分析与浏览器指纹检测                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────────────────��─────────────┐ │
│  │ 风险评分  │  │ 网络信息与质量分析                   │ │
│  │   75    │  │ IP: 8.8.8.8                        │ │
│  │         │  │ 类型: 数据中心 IP                    │ │
│  │ VPN: 否  │  │ ISP: Google LLC                    │ │
│  │ 代理: 否 │  │ ASN: AS15169                       │ │
│  └──────────┘  │ 位置: 美国, 弗吉尼亚州               │ │
│                │ 原生IP: 是                          │ │
│                └────────────────────────────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🤖 AI 智能分析报告                                │   │
│  │ ─────────────────────────────────────────────── │   │
│  │ ## IP质量分析报告                                 │   │
│  │ ### 基础信息                                      │   │
│  │ - Cloudflare ASN Bot流量: 97.3%                  │   │
│  │ - 滥用评分: 0/100                                │   │
│  │ ### 质量评分: 85/100                             │   │
│  │ ### 适用场景建议                                  │   │
│  │ - ✅ 推荐: 网页浏览、API调用                      │   │
│  │ - ⚠️ 谨慎: 账号注册、支付操作                     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- (可选) 各 API 服务商的密钥

### 1️⃣ 克隆项目

```bash
git clone https://github.com/yourusername/ipcheck.git
cd ipcheck
```

### 2️⃣ 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置文件
nano .env
```

**最小配置** (免费):
```env
# 只需要这一个就能运行基础功能
REDIS_HOST=redis
```

**推荐配置** (获取完整功能):
```env
# IPQualityScore (免费版: 5000次/月)
# 获取: https://www.ipqualityscore.com/create-account
IPQS_KEY=your_ipqs_key_here

# AbuseIPDB (免费版: 1000次/天)
# 获取: https://www.abuseipdb.com/account/api
ABUSEIPDB_KEY=your_abuseipdb_key_here

# IP2Location (免费版: 500次/天)
# 获取: https://www.ip2location.io/
IP2LOCATION_KEY=your_ip2location_key_here

# IPData (免费版: 1500次/天)
# 获取: https://ipdata.co/
IPDATA_KEY=your_ipdata_key_here

# Cloudflare Radar API (免费)
# 获取: https://dash.cloudflare.com/profile/api-tokens
CLOUDFLARE_API_TOKEN=your_cloudflare_token_here

# AI 分析 (可选 - 支持 OpenAI/DeepSeek/SiliconFlow 等)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your_llm_api_key
LLM_MODEL=gpt-3.5-turbo

# Redis
REDIS_HOST=redis
```

### 3️⃣ 启动服务

```bash
# 构建并启动所有容器
docker-compose up -d --build

# 查看日志
docker-compose logs -f api
```

### 4️⃣ 访问应用

打开浏览器访问:
- **主应用**: http://localhost:8080
- **API 文档**: http://localhost:8080/api/debug/config

## 📦 生产环境部署

### 快速部署 (推荐)

使用提供的部署脚本:

```bash
# 在服务器上
chmod +x deploy-to-server.sh
./deploy-to-server.sh
```

### 手动部署

详细的生产环境部署指南请查看 [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md),包括:

- ✅ 安全配置最佳实践
- ✅ Nginx/Caddy 反向代理配置
- ✅ SSL 证书自动获取
- ✅ 监控和日志配置
- ✅ 备份和恢复策略
- ✅ 故障排查指南

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name ipcheck.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ipcheck.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/ipcheck.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ipcheck.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 🏗️ 技术架构

### 系统架构图

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│    Nginx    │ ─── SSL 终止
│  (Reverse   │ ─── 负载均衡
│   Proxy)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌─────────────┐
│   Fastify   │◄────►│    Redis    │
│  (Node.js)  │      │   (Cache)   │
└──────┬──────┘      └─────────────┘
       │
       ├──► IPQualityScore API
       ├──► AbuseIPDB API
       ├──► ip-api.com
       ├──► IP2Location API
       ├──► IPData API
       ├──► Cloudflare Radar API
       └──► LLM API (可选)
```

### 核心技术栈

**前端**:
- React 18.3
- Vite 7.2
- TailwindCSS 3.4
- Chart.js (风险评分可视化)
- Axios (HTTP 客户端)

**后端**:
- Node.js 20 (Alpine)
- Fastify 5.2 (高性能 Web 框架)
- Redis 7 (缓存层)
- Axios (API 聚合)

**基础设施**:
- Docker & Docker Compose
- Nginx (反向代理)
- Let's Encrypt (SSL 证书)

## 🔧 API 端点

### 健康检查

```bash
GET /health
```

### IP 检测

```bash
# 自动检测当前 IP
GET /api/check

# 检测指定 IP
GET /api/check?ip=8.8.8.8
```

**响应示例**:

```json
{
  "ip": "8.8.8.8",
  "ipType": "数据中心 IP (Data Center)",
  "fraudScore": 0,
  "abuseScore": 0,
  "isVpn": false,
  "isProxy": false,
  "isTor": false,
  "country": "United States",
  "countryCode": "US",
  "city": "Ashburn",
  "isp": "Google LLC",
  "ASN": "AS15169",
  "isNative": true,
  "nativeReason": "Country codes match (US)",
  "isDualIsp": false,
  "cf_asn_bot_pct": 97.26,
  "cf_asn_human_pct": 2.74,
  "cf_asn_likely_bot": true,
  "aiReasoning": "## IP质量分析报告\n...",
  "sources": ["ipapi", "abuseipdb", "ip2location", "ipdata", "cloudflare_asn"],
  "timestamp": "2025-12-14T00:00:00.000Z"
}
```

### 调试信息

```bash
GET /api/debug/config
```

## 📊 数据源说明

### 免费配额对比

| 数据源 | 免费额度 | 核心功能 | 获取地址 |
|--------|---------|---------|---------|
| **ip-api.com** | 45次/分钟 | 地理位置、ISP、ASN | 无需注册 |
| **IPQualityScore** | 5000次/月 | 欺诈评分、VPN检测 | [注册](https://www.ipqualityscore.com/create-account) |
| **AbuseIPDB** | 1000次/天 | 滥用历史、举报记录 | [注册](https://www.abuseipdb.com/account/api) |
| **IP2Location** | 500次/天 | 代理检测、使用类型 | [注册](https://www.ip2location.io/) |
| **IPData** | 1500次/天 | 威胁情报检测 | [注册](https://ipdata.co/) |
| **Cloudflare Radar** | 无限制 | ASN Bot流量统计 | [获取Token](https://dash.cloudflare.com/profile/api-tokens) |

### 推荐组合

**基础版** (完全免费):
- ip-api.com (必需)
- Cloudflare Radar (可选,增强Bot检测)

**标准版** (推荐):
- 基础版 +
- AbuseIPDB (滥用检测)
- IP2Location (代理检测)

**专业版** (完整功能):
- 标准版 +
- IPQualityScore (欺诈评分)
- IPData (威胁情报)
- AI 分析 (综合报告)

## 🔍 核心检测逻辑

### 1. 原生/广播 IP 检测

**原理**: 对比多个数据源的国家码,判断 IP 的注册国家与实际使用地是否一致。

```javascript
// backend/src/services/ipCheck.js
const geoCountry = merged.countryCode;        // ip-api 提供
const ip2locCountry = merged.ip2location_country_code;  // IP2Location 提供

if (geoCountry === ip2locCountry) {
    isNative = true;  // 原生 IP
    nativeReason = `Country codes match (${geoCountry})`;
} else {
    isNative = false;  // 广播 IP (可能为代理或VPN)
    nativeReason = `Country mismatch: Geo=${geoCountry}, IP2Loc=${ip2locCountry}`;
}
```

**应用场景**:
- 🟢 原生 IP: 可信度高,适合注册、支付等敏感操作
- 🔴 广播 IP: 可能为代理/VPN,需要额外验证

### 2. Cloudflare ASN Bot 检测

**原理**: 基于 Cloudflare Radar 过去 7 天的 ASN 流量统计,评估该 IP 所属网络的 Bot 流量比例。

```javascript
// 自动提取 ASN 并查询
const asn = extractASN(ipData.as);  // 例如: AS15169
const cfData = await cloudflare.get(`/radar/http/summary/bot_class?asn=${asn}`);

// 返回结果
{
  cf_asn_bot_pct: 97.26,      // Bot 流量占比
  cf_asn_human_pct: 2.74,     // 人类流量占比
  cf_asn_likely_bot: true     // 是否为高风险 ASN (>50%)
}
```

**典型案例**:
- Google (AS15169): 97% Bot 流量 ← 正常 (爬虫、API)
- 住宅宽带 ISP: 5-20% Bot 流量 ← 正常
- 未知 IDC: 80%+ Bot 流量 ← 高风险

### 3. WebRTC IP 泄露检测

**前端实现** (`frontend/src/utils/fingerprint.js`):

```javascript
export async function detectWebRTCLeak() {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.createDataChannel('');

    pc.onicecandidate = (event) => {
        const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/g;
        const matches = event.candidate?.candidate.match(ipRegex);

        matches?.forEach(ip => {
            if (isPrivateIP(ip)) {
                ips.local.push(ip);   // 内网 IP
            } else {
                ips.public.push(ip);  // 公网 IP (可能泄露)
            }
        });
    };

    await pc.createOffer();
    return ips;
}
```

**检测逻辑**:
```javascript
// frontend/src/components/Dashboard.jsx
if (webrtcIP !== httpConnectionIP) {
    // ⚠️ 检测到 IP 不一致 - 可能使用 VPN/代理
    showWarning('WebRTC 泄露真实 IP');
}
```

## 🛠️ 开发指南

### 本地开发

```bash
# 后端开发
cd backend
npm install
npm run dev

# 前端开发
cd frontend
npm install
npm run dev
```

### 目录结构

```
ipcheck/
├── backend/
│   ├── src/
│   │   ├── server.js           # Fastify 服务器
│   │   ├── services/
│   │   │   └── ipCheck.js      # IP 检测核心逻辑
│   │   └── utils/
│   │       └── redis.js        # Redis 缓存工具
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Dashboard.jsx   # 主界面
│   │   └── utils/
│   │       └── fingerprint.js  # 浏览器指纹
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf              # 反向代理配置
├── docker-compose.yml          # 容器编排
├── .env.example                # 环境变量示例
├── deploy-to-server.sh         # 部署脚本
├── PRODUCTION-DEPLOYMENT.md    # 生产部署指南
├── TROUBLESHOOTING.md          # 故障排查指南
└── README.md                   # 本文件
```

### 添加新的数据源

1. 在 `backend/src/services/ipCheck.js` 的 `apis` 数组中添加:

```javascript
{
    name: 'your_api',
    url: 'https://api.example.com/ip/${ip}',
    enabled: !!process.env.YOUR_API_KEY,
    headers: { 'Authorization': `Bearer ${process.env.YOUR_API_KEY}` },
    transform: (data) => ({
        // 转换 API 响应为统一格式
        customField: data.field_name
    })
}
```

2. 在 `.env` 中添加 API 密钥
3. 在 `docker-compose.yml` 中映射环境变量

## 🐛 故障排查

### 常见问题

**Q: IP 显示为 127.0.0.1 或内网 IP?**

A: 系统会自动检测真实公网 IP。如果仍显示内网 IP:
1. 检查 Nginx 配置是否设置了 `X-Forwarded-For` 头
2. 确认后端 `trustProxy: true` 已启用
3. 查看浏览器控制台是否有错误

**Q: IPQS/AbuseIPDB 返回配额错误?**

A:
- IPQS 免费版: 20次/天 → 等待重置或升级
- AbuseIPDB 免费版: 1000次/天 → 检查是否超限
- 启用 Redis 缓存避免重复查询

**Q: Cloudflare Radar API 认证失败?**

A:
1. 确认 Token 有效: `curl "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer YOUR_TOKEN"`
2. 检查 Token 权限是否包含 Radar API
3. 查看详细错误: `docker-compose logs api | grep cloudflare`

**Q: AI 分析报告不显示?**

A: 检查 LLM 配置:
```bash
docker-compose exec api env | grep LLM
```

详细故障排查请查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 📈 性能优化

### Redis 缓存策略

- **默认缓存时间**: 15 分钟
- **缓存键格式**: `ip:check:{ip_address}`
- **缓存清除**: `docker-compose exec redis redis-cli FLUSHALL`

### API 调用优化

1. **并发请求**: 所有 API 并发调用,减少总延迟
2. **超时控制**: 5 秒超时,避免阻塞
3. **错误隔离**: 单个 API 失败不影响其他数据源
4. **两阶段查询**: 先获取基础信息,再调用 ASN 依赖的 API

## 🔐 安全建议

### 生产环境检查清单

- [ ] .env 文件权限设置为 `600`
- [ ] .env 已加入 .gitignore
- [ ] 配置 HTTPS (Let's Encrypt)
- [ ] 设置 API 速率限制
- [ ] 启用 Docker 容器资源限制
- [ ] 配置日志轮转
- [ ] 定期备份 Redis 数据
- [ ] 定期轮换 API 密钥

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📮 联系方式

- 项目地址: https://github.com/yourusername/ipcheck
- 问题反馈: https://github.com/yourusername/ipcheck/issues

## 🙏 致谢

感谢以下开源项目和 API 服务商:

- [Fastify](https://www.fastify.io/) - 高性能 Web 框架
- [React](https://reactjs.org/) - UI 框架
- [ip-api.com](https://ip-api.com/) - 免费 IP 地理位置 API
- [IPQualityScore](https://www.ipqualityscore.com/) - IP 欺诈检测
- [AbuseIPDB](https://www.abuseipdb.com/) - IP 滥用数据库
- [Cloudflare Radar](https://radar.cloudflare.com/) - 网络流量洞察

---

**⭐ 如果这个项目对您有帮助,请给一个 Star!**
