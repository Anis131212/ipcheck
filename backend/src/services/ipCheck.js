import axios from 'axios';

const API_TIMEOUT = 5000;

function mergeResults(results) {
    let merged = {};
    results.forEach(result => {
        if (result.data) {
            merged = { ...merged, ...result.data };
        }
    });
    return merged;
}

export async function checkIPQuality(ip) {
    const apis = [
        {
            name: 'ipqs',
            url: `https://www.ipqualityscore.com/api/json/ip/${process.env.IPQS_KEY}/${ip}`,
            enabled: !!process.env.IPQS_KEY,
            transform: (d) => ({
                fraudScore: d.fraud_score,
                isVpn: d.vpn,
                isProxy: d.proxy,
                isTor: d.tor,
                country_code: d.country_code,
                city: d.city,
                ISP: d.ISP,
                ASN: d.ASN,
                connection_type: d.connection_type, // Residential, Mobile, Corporate, Data Center
                organization: d.organization
            })
        },
        {
            name: 'ipapi',
            url: `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`,
            enabled: true,
            transform: (d) => ({
                country: d.country,
                countryCode: d.countryCode,
                city: d.city,
                isp: d.isp,
                org: d.org,
                as: d.as,
                isHosting: d.hosting,
                isMobile: d.mobile,
                lat: d.lat,
                lon: d.lon,
                timezone: d.timezone
            })
        },
        {
            name: 'abuseipdb',
            url: 'https://api.abuseipdb.com/api/v2/check',
            enabled: !!process.env.ABUSEIPDB_KEY,
            headers: { Key: process.env.ABUSEIPDB_KEY },
            params: { ipAddress: ip, maxAgeInDays: 90 },
            transform: (d) => ({
                abuseScore: d.data?.abuseConfidenceScore,
                usageType: d.data?.usageType, // Data Center/Web Hosting/Transit, Fixed Line ISP, etc.
                domain: d.data?.domain
            })
        },
        {
            name: 'ip2location',
            url: `https://api.ip2location.io/`,
            enabled: !!process.env.IP2LOCATION_KEY,
            params: { key: process.env.IP2LOCATION_KEY, ip: ip },
            transform: (d) => ({
                ip2location_proxy: d.is_proxy ? 'Yes' : 'No',
                ip2location_usage: d.usage_type,
                ip2location_country: d.country_name
            })
        },
        {
            name: 'scamalytics',
            url: `https://api11.scamalytics.com/${process.env.SCAMALYTICS_USERNAME}/`,
            enabled: !!process.env.SCAMALYTICS_USERNAME && !!process.env.SCAMALYTICS_KEY,
            params: { key: process.env.SCAMALYTICS_KEY, ip: ip },
            transform: (d) => ({
                scamalytics_score: d.score, // 0-100
                scamalytics_risk: d.risk // low, medium, high, very high
            })
        },
        {
            name: 'ipdata',
            url: `https://api.ipdata.co/${ip}`,
            enabled: !!process.env.IPDATA_KEY,
            params: { 'api-key': process.env.IPDATA_KEY },
            transform: (d) => ({
                ipdata_threats: d.threat?.is_threat,
                ipdata_tor: d.threat?.is_tor,
                ipdata_proxy: d.threat?.is_proxy,
                ipdata_abuse: d.threat?.is_known_attacker
            })
        }
    ];

    // Filter enabled APIs
    const activeApis = apis.filter(api => api.enabled);

    // Concurrent requests
    const results = await Promise.allSettled(
        activeApis.map(api =>
            axios.get(api.url, {
                timeout: API_TIMEOUT,
                headers: api.headers,
                params: api.params
            })
                .then(res => ({ source: api.name, data: api.transform(res.data) }))
                .catch(err => ({ source: api.name, error: err.message }))
        )
    );

    // Aggregate results
    const successful = results
        .filter(r => r.status === 'fulfilled' && !r.value.error)
        .map(r => r.value);

    const errors = results
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
        .map(r => r.status === 'rejected' ? r.reason : r.value.error);

    let merged = mergeResults(successful);

    // Native vs Broadcast Logic (Heuristic)
    const isNative = true; // Placeholder

    // Dual ISP Logic
    const isDualIsp = merged.isp && merged.org && merged.isp !== merged.org;

    // Add inferred data to merged object for LLM
    merged.isNative = isNative;
    merged.isDualIsp = isDualIsp;

    // Advanced Classification Logic
    let ipType = 'Unknown';
    let aiReasoning = null;

    // Check if LLM is configured
    const llmConfigured = process.env.LLM_API_KEY && process.env.LLM_BASE_URL;

    if (llmConfigured) {
        try {
            // Run LLM analysis concurrently or after main checks
            // Here we await it to ensure it's in the response
            const llmResult = await analyzeWithLLM(merged, ip);
            if (llmResult) {
                // If LLM returns a valid type, we can use it or just store the reasoning
                // Let's prioritize LLM type if it's specific, or just use it to enhance
                if (llmResult.type && llmResult.type !== 'Unknown') {
                    ipType = llmResult.type;
                }
                aiReasoning = llmResult.reasoning;
            }
        } catch (error) {
            console.error("LLM Analysis failed:", error.message);
            aiReasoning = `Analysis failed: ${error.message}`;
        }
    }

    // Fallback logic if LLM failed or not configured
    if (ipType === 'Unknown') {
        if (merged.connection_type && !merged.connection_type.includes('Premium')) {
            ipType = merged.connection_type;
        } else if (merged.usageType) {
            ipType = merged.usageType;
        } else if (merged.isHosting) {
            ipType = 'Data Center';
        } else if (merged.isMobile) {
            ipType = 'Mobile';
        } else {
            ipType = 'Residential'; // Default assumption
        }
    }

    // Normalize IP Type to user requested categories
    let displayType = ipType;
    if (ipType.includes('Residential') || ipType.includes('Fixed Line ISP')) displayType = '住宅 IP (Residential)';
    else if (ipType.includes('Mobile') || ipType.includes('Cellular')) displayType = '移动 IP (Mobile)';
    else if (ipType.includes('Data Center') || ipType.includes('Hosting') || ipType.includes('Transit')) displayType = '数据中心 IP (Data Center)';
    else if (ipType.includes('Corporate') || ipType.includes('Commercial') || ipType.includes('Business')) displayType = '商业 IP (Commercial)';
    else if (ipType.includes('Education') || ipType.includes('University') || ipType.includes('School')) displayType = '教育 IP (Education)';

    // Native vs Broadcast Logic (Heuristic)
    const isNative = true; // Placeholder

    // Dual ISP Logic
    const isDualIsp = merged.isp && merged.org && merged.isp !== merged.org;

    return {
        ip,
        ...merged,
        ipType: displayType,
        aiReasoning,
        isNative,
        isDualIsp,
        sources: successful.map(r => r.source),
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
    };
}

async function analyzeWithLLM(data, ip) {
    const systemPrompt = `
# IP Quality Analysis Expert

你是一个专业的IP质量分析专家，负责根据用户提供的IP检测数据，综合分析IP的质量情况并给出使用建议。

## 分析维度

### 1. 基础信息判定
- **地理位置**：以ip2location为准，确认IP所属国家/地区
- **IP类型**：
  - ISP/Fixed Line ISP = 住宅IP（最优）
  - MOB/Mobile ISP = 移动IP（优秀）
  - COM/Commercial = 商业IP（良好）
  - DCH/Data Center/Web Hosting/Transit = 数据中心IP（一般）
- **原生/广播**：注册国家与实际位置是否一致（以ping0的ASN判断为准）
- **双ISP状态**：AS Usage Type与Usage Type是否均为ISP且一致

### 2. 风控评估（按权重排序）

#### 高权重指标
| 数据源 | 关注项 | 评判标准 |
|--------|--------|----------|
| ip2location | Proxy Data | 若显示VPN/abuse则严重扣分（此库对滥用不敏感，一旦标记问题很大）|
| scamalytics | Fraud Score | 家宽正常5-25分；高分基本烂完，易被CF骑脸 |
| ipdata | Threats | 为0正常；有abuse/tor/proxy标记则扣分 |
| Cloudflare Radar | Bot vs Human | 机器人占比>30%易跳盾，>50%频繁跳盾 |

#### 中权重指标
| 数据源 | 关注项 | 评判标准 |
|--------|--------|----------|
| IPQS | Fraud Score | 75+=可疑，85+=风险，90+=高风险 |
| IPQS | Proxy/VPN/TOR/Recent Abuse/Bot | 任一为true需关注 |

#### 低权重/参考指标
- ping0的风控值/共享人数/大模型检测（不准确，仅看ASN和原生/广播）
- iplark（娱乐库，仅参考地理位置聚合）

### 3. 实测验证（如有）
| 测试项 | 正常表现 | 异常表现（扣分程度）|
|--------|----------|---------------------|
| Google搜索 | 直接返回结果 | 跳人机验证（致命，可判死刑）|
| YouTube | 直接播放 | 需验证码（中等严重）|
| Reddit | 直接访问 | 跳验证（中等严重）|
| ChatGPT | 无人机验证+免登录可对话 | 需验证（扣分）|
| Claude | 不跳验证码 | 跳验证码（扣分）|
| Gemini/Meta | 可访问 | 不可访问（可能是送中，非IP质量问题）|

### 4. 流媒体解锁
- 流媒体解锁与IP质量仅有轻微关联，主要与地区强相关
- US地区解锁率高，HK大概率不解锁（尤其AI和TikTok）
- 解锁差≠IP质量差，需分开评估

## 输出格式
请返回一个 JSON 对象，包含以下字段：
1. "type": IP类型简写 (如 Residential, Mobile, Data Center)
2. "report": 按照以下 Markdown 格式生成的完整分析报告：

\`\`\`markdown
## IP质量分析报告

### 基础信息
- IP地址：{ip}
- 地理位置：{country}
- IP类型：{type}
- 原生/广播：{native_status}
- 双ISP状态：{dual_isp_status}
- ASN/运营商：{isp}

### 质量评分：X/100

### 各维度评估
| 维度 | 状态 | 说明 |
|------|------|------|
| 地理定位准确性 | ✅/⚠️/❌ | ... |
| IP类型评级 | ✅/⚠️/❌ | ... |
| 滥用/威胁标记 | ✅/⚠️/❌ | ... |
| 机器人流量占比 | ✅/⚠️/❌ | ... |
| 欺诈风险评分 | ✅/⚠️/❌ | ... |

### 适用场景建议
- ✅ 推荐：...
- ⚠️ 谨慎：...
- ❌ 不推荐：...

### 风险提示
...

### 详细分析
...
\`\`\`
`;

    const userPrompt = `
    Analyze the following IP data:
    IP: ${ip}
    ISP: ${data.isp || data.ISP || 'Unknown'}
    Organization: ${data.org || data.organization || 'Unknown'}
    ASN: ${data.asn || data.ASN || 'Unknown'}
    Hosting: ${data.isHosting ? 'Yes' : 'No'}
    Mobile: ${data.isMobile ? 'Yes' : 'No'}
    Country: ${data.country || data.country_code || 'Unknown'}
    
    Risk Data:
    - Fraud Score (IPQS): ${data.fraudScore || 'N/A'}
    - Abuse Score (AbuseIPDB): ${data.abuseScore || 'N/A'}
    - Scamalytics Score: ${data.scamalytics_score || 'N/A'} (${data.scamalytics_risk || 'Unknown'})
    - IPData Threats: ${data.ipdata_threats ? 'Detected' : 'None'} (Tor: ${data.ipdata_tor}, Proxy: ${data.ipdata_proxy}, Abuse: ${data.ipdata_abuse})
    - IP2Location Proxy: ${data.ip2location_proxy || 'N/A'} (Usage: ${data.ip2location_usage || 'N/A'})
    - VPN: ${data.isVpn ? 'Yes' : 'No'}
    - Proxy: ${data.isProxy ? 'Yes' : 'No'}
    - Tor: ${data.isTor ? 'Yes' : 'No'}
    
    Inferred Data (Heuristic):
    - Native/Broadcast: ${data.isNative ? 'Likely Native' : 'Likely Broadcast'} (Note: Heuristic only, no Ping0 data)
    - Dual ISP: ${data.isDualIsp ? 'Yes' : 'No'} (ISP != Org)
    
    Missing Data (Not Tested/Available):
    - Cloudflare Radar: N/A
    - Connectivity Tests (Google/YouTube/etc): Not Tested (Server-side analysis only)
    - Streaming Unlock: Not Tested
    `;

    try {
        const response = await axios.post(`${process.env.LLM_BASE_URL}/chat/completions`, {
            model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000 // Increased timeout for longer generation
        });

        let content = response.data.choices[0].message.content.trim();

        // Try to parse JSON
        let result = null;
        try {
            // Find JSON object in content
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                result = JSON.parse(content);
            }
        } catch (e) {
            // If JSON parsing fails, assume the whole content is the report if it looks like markdown
            // or return a fallback
            console.warn("LLM response not valid JSON, using raw content as report");
            result = {
                type: "Unknown",
                report: content
            };
        }

        return {
            type: result.type || "Unknown",
            reasoning: result.report || content // Use 'report' as the reasoning field
        };
    } catch (error) {
        console.error("LLM Request Error:", error.response?.data || error.message);
        return {
            type: "Unknown",
            reasoning: `AI Analysis Failed: ${error.message}`
        };
    }
}
