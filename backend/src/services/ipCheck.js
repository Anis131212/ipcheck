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
                ASN: d.ASN
            })
        },
        {
            name: 'ipapi',
            url: `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`,
            enabled: true,
            transform: (d) => ({
                country: d.country,
                city: d.city,
                isp: d.isp,
                isHosting: d.hosting,
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
            transform: (d) => ({ abuseScore: d.data?.abuseConfidenceScore })
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

    return {
        ip,
        ...mergeResults(successful),
        sources: successful.map(r => r.source),
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
    };
}
