export async function detectWebRTCLeak() {
    return new Promise((resolve) => {
        const ips = { local: [], public: [] };

        const RTCPeerConnection = window.RTCPeerConnection ||
            window.webkitRTCPeerConnection;
        if (!RTCPeerConnection) {
            resolve({ supported: false });
            return;
        }

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.services.mozilla.com' }
            ]
        });

        pc.createDataChannel('');

        pc.onicecandidate = (event) => {
            if (!event.candidate) {
                pc.close();
                resolve(ips);
                return;
            }

            const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/g;
            const matches = event.candidate.candidate.match(ipRegex);

            matches?.forEach(ip => {
                if (ip.match(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/)) {
                    if (!ips.local.includes(ip)) ips.local.push(ip);
                } else {
                    if (!ips.public.includes(ip)) ips.public.push(ip);
                }
            });
        };

        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer));

        setTimeout(() => { pc.close(); resolve(ips); }, 3000);
    });
}

export function getCanvasFingerprint() {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);

    ctx.fillStyle = '#069';
    ctx.fillText('BrowserLeaks,com <canvas> 1.0', 2, 15);

    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('BrowserLeaks,com <canvas> 1.0', 4, 17);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2);
    ctx.fill();

    const dataURL = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < dataURL.length; i++) {
        hash = ((hash << 5) - hash) + dataURL.charCodeAt(i);
        hash = hash & hash;
    }
    return hash.toString(16);
}

export function getNavigatorFingerprint() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        screenWidth: screen.width,
        screenHeight: screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}

export async function getPublicIP() {
    // Try multiple IP detection services for redundancy
    const services = [
        'https://api.ipify.org?format=json',
        'https://api64.ipify.org?format=json',
        'https://api.ip.sb/jsonip',
        'https://ipapi.co/json/',
    ];

    for (const service of services) {
        try {
            const response = await fetch(service, { timeout: 3000 });
            const data = await response.json();

            // Different services use different field names
            const ip = data.ip || data.query;

            if (ip && ip !== '127.0.0.1' && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
                return ip;
            }
        } catch (error) {
            console.warn(`Failed to fetch IP from ${service}:`, error);
            continue;
        }
    }

    throw new Error('Unable to detect public IP address');
}
