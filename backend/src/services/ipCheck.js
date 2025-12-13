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

    // Advanced Classification Logic
    let ipType = 'Unknown';
    let aiReasoning = null;

    // Check if we need LLM analysis (if type is missing or "Premium required")
    const needsLLM = !merged.connection_type || merged.connection_type.includes('Premium');

    if (needsLLM && process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
        try {
            const llmResult = await analyzeWithLLM(merged, ip);
            if (llmResult) {
                ipType = llmResult.type;
                aiReasoning = llmResult.reasoning;
            }
        } catch (error) {
            console.error("LLM Analysis failed:", error.message);
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
    const prompt = `
    Analyze the following IP address information and classify the IP type.
    IP: ${ip}
    ISP: ${data.isp || data.ISP || 'Unknown'}
    Organization: ${data.org || data.organization || 'Unknown'}
    ASN: ${data.asn || data.ASN || 'Unknown'}
    Hosting: ${data.isHosting ? 'Yes' : 'No'}
    Mobile: ${data.isMobile ? 'Yes' : 'No'}
    
    Based on this, determine if the IP is one of the following types:
    - Residential
    - Mobile
    - Data Center
    - Commercial
    - Education
    
    Return a JSON object with two fields:
    "type": The classification name from the list above.
    "reasoning": A brief explanation (max 1 sentence) of why you chose this type.
    `;

    try {
        const response = await axios.post(`${process.env.LLM_BASE_URL}/chat/completions`, {
            model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
            messages: [
                { role: "system", content: "You are a network analysis expert. Return JSON only." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        const content = response.data.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("LLM Request Error:", error.response?.data || error.message);
        return null;
    }
}
