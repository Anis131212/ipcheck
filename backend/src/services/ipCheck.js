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
            transform: (d) => {
                // Check if IPQS returned an error
                if (d.success === false) {
                    throw new Error(d.message || 'IPQS API returned error');
                }
                return {
                    fraudScore: d.fraud_score !== undefined ? d.fraud_score : null,
                    isVpn: d.vpn,
                    isProxy: d.proxy,
                    isTor: d.tor,
                    country_code: d.country_code,
                    city: d.city,
                    ISP: d.ISP,
                    isp: d.ISP, // Provide lowercase version for consistency
                    ASN: d.ASN,
                    asn: d.ASN, // Provide lowercase version for consistency
                    connection_type: d.connection_type, // Residential, Mobile, Corporate, Data Center
                    organization: d.organization,
                    ipqs_success: d.success
                };
            }
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
                as: d.as, // Keep 'as' field with prefix (e.g., "AS15169")
                asn: d.as, // Also provide as 'asn' for consistency
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
            headers: {
                'Key': process.env.ABUSEIPDB_KEY,
                'Accept': 'application/json'
            },
            params: { ipAddress: ip, maxAgeInDays: 90 },
            transform: (d) => {
                // Check for errors in response
                if (d.errors) {
                    throw new Error(JSON.stringify(d.errors));
                }
                return {
                    abuseScore: d.data?.abuseConfidenceScore !== undefined ? d.data.abuseConfidenceScore : null,
                    lastReportedAt: d.data?.lastReportedAt,
                    usageType: d.data?.usageType, // Data Center/Web Hosting/Transit, Fixed Line ISP, etc.
                    domain: d.data?.domain,
                    totalReports: d.data?.totalReports
                };
            }
        },
        {
            name: 'ip2location',
            url: `https://api.ip2location.io/`,
            enabled: !!process.env.IP2LOCATION_KEY,
            params: { key: process.env.IP2LOCATION_KEY, ip: ip },
            transform: (d) => ({
                ip2location_proxy: d.is_proxy ? 'Yes' : 'No',
                ip2location_usage: d.usage_type,
                ip2location_country: d.country_name,
                ip2location_country_code: d.country_code
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
        },
        {
            name: 'cloudflare_asn',
            // Note: This API returns bot traffic statistics for an entire ASN (not individual IPs)
            // We use this as a heuristic: if an IP's ASN has high bot traffic, the IP may be suspicious
            url: null, // Will be set dynamically after we get the ASN
            enabled: !!process.env.CLOUDFLARE_API_TOKEN,
            requiresASN: true, // Special flag to indicate this API needs ASN first
            headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
            buildUrl: (asn) => {
                // Extract numeric ASN from formats like "AS15169", "AS15169 Google LLC", or "15169"
                const asnString = asn.toString();
                const match = asnString.match(/\d+/); // Extract first sequence of digits
                if (!match) {
                    throw new Error(`Invalid ASN format: ${asnString}`);
                }
                const asnNumber = match[0];
                return `https://api.cloudflare.com/client/v4/radar/http/summary/bot_class?asn=${asnNumber}&dateRange=7d&format=json`;
            },
            transform: (d) => {
                if (!d.success || !d.result?.summary_0) {
                    throw new Error('Invalid Cloudflare API response');
                }
                const summary = d.result.summary_0;
                // API returns lowercase 'bot' and 'human', not 'AUTOMATED' and 'HUMAN'
                const botPct = parseFloat(summary.bot || summary.AUTOMATED || 0);
                const humanPct = parseFloat(summary.human || summary.HUMAN || 0);

                return {
                    cf_asn_human_pct: humanPct,
                    cf_asn_bot_pct: botPct,
                    cf_asn_likely_bot: botPct > 50, // More than 50% bot traffic
                    cf_date_range: d.result.meta?.dateRange,
                    cf_confidence_level: d.result.meta?.confidenceInfo?.level
                };
            }
        }
    ];

    // Filter enabled APIs - separate regular APIs from ASN-dependent APIs
    const regularApis = apis.filter(api => api.enabled && !api.requiresASN);
    const asnDependentApis = apis.filter(api => api.enabled && api.requiresASN);

    // Phase 1: Call regular APIs to get basic info including ASN
    const results = await Promise.allSettled(
        regularApis.map(api =>
            axios.get(api.url, {
                timeout: API_TIMEOUT,
                headers: api.headers,
                params: api.params
            })
                .then(res => {
                    console.log(`[${api.name}] API call successful for IP ${ip}`);
                    console.log(`[${api.name}] Raw response status:`, res.status);

                    try {
                        const transformed = api.transform(res.data);
                        console.log(`[${api.name}] Transformed data:`, JSON.stringify(transformed, null, 2));
                        return { source: api.name, data: transformed };
                    } catch (transformError) {
                        console.error(`[${api.name}] Transform error:`, transformError.message);
                        console.error(`[${api.name}] Raw response data:`, JSON.stringify(res.data, null, 2));
                        return { source: api.name, error: `Transform error: ${transformError.message}` };
                    }
                })
                .catch(err => {
                    console.error(`[${api.name}] API call failed for IP ${ip}:`, err.message);
                    if (err.response) {
                        console.error(`[${api.name}] Response status:`, err.response.status);
                        console.error(`[${api.name}] Response data:`, JSON.stringify(err.response.data, null, 2));
                    } else if (err.request) {
                        console.error(`[${api.name}] No response received`);
                    } else {
                        console.error(`[${api.name}] Request setup error:`, err.message);
                    }
                    return { source: api.name, error: err.message };
                })
        )
    );

    // Aggregate results
    let successful = results
        .filter(r => r.status === 'fulfilled' && !r.value.error)
        .map(r => r.value);

    let errors = results
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
        .map(r => {
            if (r.status === 'rejected') {
                return { source: 'unknown', error: r.reason };
            }
            return { source: r.value.source, error: r.value.error };
        });

    // Phase 2: Call ASN-dependent APIs if we have ASN data
    let asnResults = [];
    const mergedPhase1 = mergeResults(successful);
    const asn = mergedPhase1.asn || mergedPhase1.ASN || mergedPhase1.as;

    if (asn && asnDependentApis.length > 0) {
        console.log(`\n[Phase 2] Calling ASN-dependent APIs with ASN: ${asn}`);

        asnResults = await Promise.allSettled(
            asnDependentApis.map(api => {
                const url = api.buildUrl(asn);
                return axios.get(url, {
                    timeout: API_TIMEOUT,
                    headers: api.headers
                })
                    .then(res => {
                        console.log(`[${api.name}] API call successful for ASN ${asn}`);
                        console.log(`[${api.name}] Raw response status:`, res.status);

                        try {
                            const transformed = api.transform(res.data);
                            console.log(`[${api.name}] Transformed data:`, JSON.stringify(transformed, null, 2));
                            return { source: api.name, data: transformed };
                        } catch (transformError) {
                            console.error(`[${api.name}] Transform error:`, transformError.message);
                            console.error(`[${api.name}] Raw response data:`, JSON.stringify(res.data, null, 2));
                            return { source: api.name, error: `Transform error: ${transformError.message}` };
                        }
                    })
                    .catch(err => {
                        console.error(`[${api.name}] API call failed for ASN ${asn}:`, err.message);
                        if (err.response) {
                            console.error(`[${api.name}] Response status:`, err.response.status);
                            console.error(`[${api.name}] Response data:`, JSON.stringify(err.response.data, null, 2));
                        }
                        return { source: api.name, error: err.message };
                    });
            })
        );

        // Merge ASN-dependent results
        const asnSuccessful = asnResults
            .filter(r => r.status === 'fulfilled' && !r.value.error)
            .map(r => r.value);

        const asnErrors = asnResults
            .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
            .map(r => {
                if (r.status === 'rejected') {
                    return { source: 'unknown', error: r.reason };
                }
                return { source: r.value.source, error: r.value.error };
            });

        // Combine with phase 1 results
        successful = [...successful, ...asnSuccessful];
        errors = [...errors, ...asnErrors];
    }

    // Log summary
    console.log(`\n=== IP Check Summary for ${ip} ===`);
    console.log(`Total APIs called: ${results.length + asnResults.length}`);
    console.log(`Successful: ${successful.length} (${successful.map(s => s.source).join(', ')})`);
    console.log(`Failed: ${errors.length} (${errors.map(e => e.source).join(', ')})`);

    // Log errors for debugging
    if (errors.length > 0) {
        console.warn(`\nAPI Errors:`);
        errors.forEach(e => {
            console.warn(`  - ${e.source}: ${e.error}`);
        });
    }

    let merged = mergeResults(successful);
    console.log(`\nMerged data keys:`, Object.keys(merged).join(', '));
    console.log(`Fraud Score:`, merged.fraudScore);
    console.log(`Abuse Score:`, merged.abuseScore);
    console.log(`Cloudflare ASN Bot %:`, merged.cf_asn_bot_pct);
    console.log(`===========================\n`);

    // Native vs Broadcast Logic
    // Compare country codes from different sources to determine if IP is native or broadcast
    let isNative = true; // Default assumption
    let nativeReason = 'Insufficient data to determine';

    // Get country codes from different sources
    const geoCountry = merged.countryCode || merged.country_code; // From ip-api
    const ip2locCountry = merged.ip2location_country_code; // From ip2location
    const ipqsCountry = merged.country_code; // From IPQS (if available)

    if (geoCountry && ip2locCountry) {
        if (geoCountry === ip2locCountry) {
            isNative = true;
            nativeReason = `Country codes match (${geoCountry})`;
        } else {
            isNative = false;
            nativeReason = `Country mismatch: Geo=${geoCountry}, IP2Loc=${ip2locCountry}`;
        }
    } else if (geoCountry) {
        nativeReason = `Only geo location available (${geoCountry}), assumed native`;
    }

    // Dual ISP Logic
    const isDualIsp = merged.isp && merged.org && merged.isp !== merged.org;

    // Add inferred data to merged object for LLM
    merged.isNative = isNative;
    merged.nativeReason = nativeReason;
    merged.isDualIsp = isDualIsp;
    merged.sources = successful.map(r => r.source);
    merged.apiErrors = errors.length > 0 ? errors : undefined;

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

    return {
        ip,
        ...merged,
        ipType: displayType,
        aiReasoning,
        isNative,
        nativeReason,
        isDualIsp,
        sources: successful.map(r => r.source),
        apiErrors: errors.length > 0 ? errors : undefined,
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
| ipdata | Threats | 为0正常；有abuse/tor/proxy标记则扣分 |
| Cloudflare Radar | Bot Score | 机器人评分(1-100)。>30易跳盾，>50频繁跳盾 (如有数据) |

#### 中权重指标
| 数据源 | 关注项 | 评判标准 |
|--------|--------|----------|
| IPQS | Fraud Score | 75+=可疑，85+=风险，90+=高风险 |
| IPQS | Proxy/VPN/TOR/Recent Abuse/Bot | 任一为true需关注 |
| AbuseIPDB | Abuse Score | >0 即有黑历史，分数越高越危险 |

#### 低权重/参考指标
- **原生/广播检测**：基于注册国家(Reg)与实际地理位置(Geo)的比对。
  - 一致 = 原生 IP (Native)
  - 不一致 = 广播 IP (Broadcast) -> 风险略高，可能影响部分服务定位
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
    ASN: ${data.asn || data.ASN || data.as || 'Unknown'}
    Hosting: ${data.isHosting ? 'Yes' : 'No'}
    Mobile: ${data.isMobile ? 'Yes' : 'No'}
    Country (Geo): ${data.country || 'Unknown'} (${data.countryCode || data.country_code || 'N/A'})
    Country (IP2Location): ${data.ip2location_country || 'N/A'} (${data.ip2location_country_code || 'N/A'})
    City: ${data.city || 'Unknown'}
    Connection Type: ${data.connection_type || 'N/A'}

    Risk Data:
    - Fraud Score (IPQS): ${data.fraudScore !== undefined ? data.fraudScore : 'N/A'}
    - Abuse Score (AbuseIPDB): ${data.abuseScore !== undefined ? data.abuseScore : 'N/A'} (Last Reported: ${data.lastReportedAt || 'None'})
    - IPData Threats: ${data.ipdata_threats ? 'Detected' : 'None'} (Tor: ${data.ipdata_tor || 'N/A'}, Proxy: ${data.ipdata_proxy || 'N/A'}, Abuse: ${data.ipdata_abuse || 'N/A'})
    - IP2Location Proxy: ${data.ip2location_proxy || 'N/A'} (Usage Type: ${data.ip2location_usage || 'N/A'})
    - VPN: ${data.isVpn ? 'Yes' : 'No'}
    - Proxy: ${data.isProxy ? 'Yes' : 'No'}
    - Tor: ${data.isTor ? 'Yes' : 'No'}

    Inferred Data:
    - Native/Broadcast: ${data.isNative ? 'Native IP' : 'Broadcast IP'} (Reason: ${data.nativeReason || 'Not calculated'})
    - Dual ISP: ${data.isDualIsp ? 'Yes - ISP and Org are different' : 'No - ISP and Org are same or unknown'}

    Additional Data:
    - Cloudflare ASN Bot Traffic: ${data.cf_asn_bot_pct !== undefined ? data.cf_asn_bot_pct.toFixed(1) + '% AUTOMATED, ' + data.cf_asn_human_pct.toFixed(1) + '% HUMAN (ASN-level heuristic, past 7 days)' : 'N/A'}
    - ASN Bot Risk: ${data.cf_asn_likely_bot ? 'HIGH (>50% bot traffic in ASN)' : data.cf_asn_bot_pct !== undefined ? 'LOW (<50% bot traffic in ASN)' : 'N/A'}
    - Connectivity Tests (Google/YouTube/etc): See Frontend Results
    - Streaming Unlock: Not Tested
    - Data Sources: ${data.sources ? data.sources.join(', ') : 'Unknown'}
    - API Errors: ${data.apiErrors && data.apiErrors.length > 0 ? data.apiErrors.map(e => e.source + ': ' + e.error).join('; ') : 'None'}

    Note: Cloudflare data is at ASN level (represents the entire network/organization), not individual IP level.
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
