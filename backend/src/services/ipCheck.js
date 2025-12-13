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

    const merged = mergeResults(successful);

    // Advanced Classification Logic
    let ipType = 'Unknown';
    if (merged.connection_type) {
        ipType = merged.connection_type; // IPQS is usually accurate
    } else if (merged.usageType) {
        ipType = merged.usageType; // AbuseIPDB fallback
    } else if (merged.isHosting) {
        ipType = 'Data Center';
    } else if (merged.isMobile) {
        ipType = 'Mobile';
    } else {
        ipType = 'Residential'; // Default assumption if not hosting/mobile
    }

    // Normalize IP Type to user requested categories
    let displayType = ipType;
    if (ipType.includes('Residential') || ipType.includes('Fixed Line ISP')) displayType = '住宅 IP (Residential)';
    else if (ipType.includes('Mobile')) displayType = '移动 IP (Mobile)';
    else if (ipType.includes('Data Center') || ipType.includes('Hosting')) displayType = '数据中心 IP (Data Center)';
    else if (ipType.includes('Corporate') || ipType.includes('Commercial')) displayType = '商业 IP (Commercial)';
    else if (ipType.includes('Education') || ipType.includes('University')) displayType = '教育 IP (Education)';

    // Native vs Broadcast Logic (Heuristic)
    // If IPQS country matches ip-api country, likely Native. 
    // True detection requires WHOIS registration country vs Geo location.
    // We will assume Native if consistent, Broadcast if conflicting or if specifically flagged.
    const isNative = true; // Placeholder for now as we lack WHOIS DB

    // Dual ISP Logic
    // If ISP name differs significantly from ASN Org, might be dual? 
    const isDualIsp = merged.isp && merged.org && merged.isp !== merged.org;

    return {
        ip,
        ...merged,
        ipType: displayType,
        isNative,
        isDualIsp,
        sources: successful.map(r => r.source),
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
    };
}
