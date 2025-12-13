# API 故障排查指南

## 问题: IPQS Fraud Score 和 AbuseIPDB 数据缺失

### 快速诊断

1. **检查 Docker 日志**
   ```bash
   docker-compose logs -f backend | grep -E "\[ipqs\]|\[abuseipdb\]|Fraud Score|Abuse Score"
   ```

2. **检查 API 配置**
   ```bash
   curl http://localhost:8080/api/debug/config
   ```

3. **测试单个 IP**
   访问: `http://localhost:8080/api/check?ip=8.8.8.8`

### 常见问题和解决方案

#### 问题 1: API 密钥无效

**症状**: 日志显示 `401 Unauthorized` 或 `403 Forbidden`

**原因**:
- IPQS Key 无效或过期
- AbuseIPDB Key 无效或过期

**解决方案**:
1. 访问 [IPQualityScore Dashboard](https://www.ipqualityscore.com/user/dashboard) 确认 API Key
2. 访问 [AbuseIPDB Account](https://www.abuseipdb.com/account/api) 确认 API Key
3. 更新 `.env` 文件:
   ```bash
   IPQS_KEY=your_new_key_here
   ABUSEIPDB_KEY=your_new_key_here
   ```
4. 重启容器: `docker-compose restart backend`

#### 问题 2: API 速率限制

**症状**: 日志显示 `429 Too Many Requests`

**原因**:
- 免费版 API 有调用次数限制
- IPQS 免费版: 5000 次/月
- AbuseIPDB 免费版: 1000 次/日

**解决方案**:
1. 等待速率限制重置
2. 升级到付费计划
3. 启用 Redis 缓存减少重复调用

#### 问题 3: 响应结构不匹配

**症状**: 日志显示 `Transform error`

**原因**: API 响应结构与代码预期不符

**解决方案**:
查看日志中的 "Raw response data",对比实际响应与代码中的字段映射。

示例日志:
```
[ipqs] Raw response data: {
  "success": false,
  "message": "Invalid API key"
}
```

#### 问题 4: 网络连接问题

**症状**: 日志显示 `ECONNREFUSED`, `ETIMEDOUT`, 或 `No response received`

**原因**:
- Docker 容器无法访问外网
- 防火墙阻止
- DNS 解析失败

**解决方案**:
1. 检查 Docker 网络配置
2. 测试容器内网络连接:
   ```bash
   docker-compose exec api sh -c "ping -c 3 www.ipqualityscore.com"
   docker-compose exec api sh -c "curl -I https://api.abuseipdb.com"
   ```

#### 问题 5: 环境变量未传递

**症状**: `/api/debug/config` 显示某些 API 为 `false`

**原因**: `.env` 文件未被 Docker 正确读取

**解决方案**:
1. 确认 `.env` 文件在项目根目录
2. 确认 `docker-compose.yml` 中的环境变量映射:
   ```yaml
   environment:
     - IPQS_KEY=${IPQS_KEY}
     - ABUSEIPDB_KEY=${ABUSEIPDB_KEY}
   ```
3. 重新构建: `docker-compose up -d --force-recreate backend`

### 日志解读

#### 正常输出示例

```
[ipqs] API call successful for IP 8.8.8.8
[ipqs] Raw response status: 200
[ipqs] Transformed data: {
  "fraudScore": 0,
  "isVpn": false,
  "isProxy": false,
  ...
}

[abuseipdb] API call successful for IP 8.8.8.8
[abuseipdb] Raw response status: 200
[abuseipdb] Transformed data: {
  "abuseScore": 0,
  "lastReportedAt": null,
  ...
}

=== IP Check Summary for 8.8.8.8 ===
Total APIs called: 5
Successful: 5 (ipqs, ipapi, abuseipdb, ip2location, ipdata)
Failed: 0 ()

Merged data keys: fraudScore, isVpn, isProxy, isTor, country_code, city, ISP, isp, ASN, asn, ...
Fraud Score: 0
Abuse Score: 0
===========================
```

#### 错误输出示例

```
[ipqs] API call failed for IP 8.8.8.8: Request failed with status code 401
[ipqs] Response status: 401
[ipqs] Response data: {
  "success": false,
  "message": "Invalid API key."
}

[abuseipdb] API call failed for IP 8.8.8.8: timeout of 5000ms exceeded
[abuseipdb] No response received

=== IP Check Summary for 8.8.8.8 ===
Total APIs called: 5
Successful: 3 (ipapi, ip2location, ipdata)
Failed: 2 (ipqs, abuseipdb)

API Errors:
  - ipqs: Request failed with status code 401
  - abuseipdb: timeout of 5000ms exceeded

Fraud Score: undefined
Abuse Score: undefined
===========================
```

### 测试 API 密钥有效性

#### 测试 IPQS
```bash
curl "https://www.ipqualityscore.com/api/json/ip/YOUR_IPQS_KEY/8.8.8.8"
```

预期响应:
```json
{
  "success": true,
  "fraud_score": 0,
  "vpn": false,
  ...
}
```

#### 测试 AbuseIPDB
```bash
curl -G https://api.abuseipdb.com/api/v2/check \
  --data-urlencode "ipAddress=8.8.8.8" \
  -d maxAgeInDays=90 \
  -H "Key: YOUR_ABUSEIPDB_KEY" \
  -H "Accept: application/json"
```

预期响应:
```json
{
  "data": {
    "ipAddress": "8.8.8.8",
    "abuseConfidenceScore": 0,
    ...
  }
}
```

### 紧急修复

如果 API 持续失败,可以临时注释掉问题 API:

编辑 `backend/src/services/ipCheck.js`:
```javascript
{
    name: 'ipqs',
    url: `...`,
    enabled: false, // 临时禁用
    ...
}
```

### 获取帮助

如果问题仍未解决,请提供以下信息:

1. 完整的后端日志 (包括 API 调用部分)
2. `/api/debug/config` 的输出
3. 手动测试 API 密钥的结果
4. Docker 版本: `docker --version`
5. Docker Compose 版本: `docker-compose --version`
