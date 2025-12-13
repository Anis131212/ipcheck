import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import axios from 'axios';
import { detectWebRTCLeak, getCanvasFingerprint, getNavigatorFingerprint, getPublicIP } from '../utils/fingerprint';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

ChartJS.register(ArcElement, Tooltip, Legend);

export function Dashboard() {
    const [ipData, setIpData] = useState(null);
    const [fingerprint, setFingerprint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // First, get the user's real public IP
                let publicIP;
                try {
                    publicIP = await getPublicIP();
                } catch (ipError) {
                    console.error("Failed to get public IP:", ipError);
                    setError("无法检测到您的公网 IP 地址。请检查网络连接。");
                    setLoading(false);
                    return;
                }

                // Then use that IP to check quality
                const res = await axios.get(`/api/check?ip=${publicIP}`);
                setIpData(res.data);

                const fp = {
                    webrtc: await detectWebRTCLeak(),
                    canvas: getCanvasFingerprint(),
                    navigator: getNavigatorFingerprint()
                };
                setFingerprint(fp);
            } catch (error) {
                console.error("Error fetching data:", error);
                setError("获取 IP 质量数据时出错：" + error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green-dark"></div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg">
            <div className="max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
                <h2 className="text-xl font-bold text-red-800 mb-2">错误</h2>
                <p className="text-red-700">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    重试
                </button>
            </div>
        </div>
    );

    const riskScore = ipData?.fraudScore || 0;
    const riskColor = riskScore >= 75 ? '#ef4444' : riskScore >= 50 ? '#f59e0b' : '#10b981';

    const gaugeData = {
        datasets: [{
            data: [riskScore, 100 - riskScore],
            backgroundColor: [riskColor, '#e5e7eb'],
            borderWidth: 0,
            circumference: 180,
            rotation: 270,
        }]
    };

    const checkConsistency = () => {
        const issues = [];
        if (ipData && fingerprint) {
            // WebRTC Check
            if (fingerprint.webrtc.public.length > 0 && ipData.ip) {
                if (!fingerprint.webrtc.public.includes(ipData.ip)) {
                    issues.push('WebRTC 泄露真实 IP (与当前连接 IP 不一致)');
                }
            }
        }
        return issues;
    };

    const consistencyIssues = checkConsistency();

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-brand-green-dark">IP 质量检测系统</h1>
                <p className="text-gray-600 mt-2">实时风险分析与浏览器指纹检测</p>
            </header>

            {consistencyIssues.length > 0 && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">
                                检测到潜在风险: {consistencyIssues.join(', ')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Risk Score Card */}
                <div className="card md:col-span-1 flex flex-col items-center justify-center">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">风险评分</h2>
                    <div className="w-48 h-24 relative mb-4">
                        <Doughnut data={gaugeData} options={{ cutout: '75%', maintainAspectRatio: false }} />
                        <div className="absolute inset-0 flex items-end justify-center pb-2">
                            <span className="text-4xl font-bold" style={{ color: riskColor }}>{riskScore}</span>
                        </div>
                    </div>
                    <div className="text-center mt-2">
                        <p className="text-sm text-gray-500">欺诈分数</p>
                        <div className="mt-4 flex gap-2 justify-center">
                            <span className={`px-2 py-1 rounded text-xs ${ipData?.isVpn ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                VPN: {ipData?.isVpn ? '是' : '否'}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${ipData?.isProxy ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                代理: {ipData?.isProxy ? '是' : '否'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* IP Details Card */}
                <div className="card md:col-span-2">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">网络信息与质量分析</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="IP 地址" value={ipData?.ip} />
                        <InfoItem label="IP 类型" value={
                            <div className="flex flex-col">
                                <span className={`font-bold ${ipData?.ipType?.includes('住宅') ? 'text-green-600' :
                                    ipData?.ipType?.includes('移动') ? 'text-blue-600' :
                                        ipData?.ipType?.includes('教育') ? 'text-purple-600' :
                                            'text-yellow-600'
                                    }`}>
                                    {ipData?.ipType || '未知'}
                                </span>
                            </div>
                        } />
                        <InfoItem label="运营商 (ISP)" value={ipData?.isp || ipData?.ISP} />
                        <InfoItem label="组织 (Org)" value={ipData?.org || ipData?.organization || 'N/A'} />
                        <InfoItem label="地理位置" value={`${ipData?.city || ''}, ${ipData?.country || ''}`} />
                        <InfoItem label="时区 (IP)" value={ipData?.timezone} />
                        <InfoItem label="ASN" value={ipData?.asn || ipData?.ASN} />
                        <InfoItem label="原生/广播" value={ipData?.isNative ? '原生 IP (可能)' : '广播 IP'} />
                        <InfoItem label="双 ISP" value={ipData?.isDualIsp ? '是 (ISP与Org不同)' : '否'} />
                        <InfoItem label="托管服务" value={ipData?.isHosting ? '是' : '否'} />
                    </div>
                </div>

                {/* Fingerprint Card */}
                <div className="card md:col-span-3">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">设备指纹与环境检测</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h3 className="font-medium text-gray-900 mb-2">浏览器环境</h3>
                            <div className="space-y-2 text-sm">
                                <p><span className="text-gray-500">操作系统:</span> {fingerprint?.navigator?.platform}</p>
                                <p><span className="text-gray-500">浏览器:</span> {fingerprint?.navigator?.userAgent.substring(0, 30)}...</p>
                                <p><span className="text-gray-500">系统时区:</span> {fingerprint?.navigator?.timezone}</p>
                                <p><span className="text-gray-500">语言:</span> {fingerprint?.navigator?.language}</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900 mb-2">WebRTC 泄露检测</h3>
                            <div className="space-y-2 text-sm">
                                <p><span className="text-gray-500">局域网 IP:</span> {fingerprint?.webrtc?.local?.join(', ') || '无'}</p>
                                <p><span className="text-gray-500">公网 IP:</span> {fingerprint?.webrtc?.public?.join(', ') || '无'}</p>
                                <p className={`text-xs mt-1 ${fingerprint?.webrtc?.public?.length > 0 && !fingerprint?.webrtc?.public.includes(ipData?.ip) ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                                    {fingerprint?.webrtc?.public?.length > 0 && !fingerprint?.webrtc?.public.includes(ipData?.ip) ? '⚠️ 检测到 IP 不一致' : '✅ IP 一致'}
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900 mb-2">连通性测试 (Beta)</h3>
                            <ConnectivityCheck />
                        </div>
                    </div>
                </div>

                {/* AI Analysis Report Card */}
                {ipData?.aiReasoning && (
                    <div className="card md:col-span-3 bg-gradient-to-br from-white to-emerald-50/30 border border-emerald-100 shadow-lg overflow-hidden">
                        <div className="flex items-center mb-6 border-b border-emerald-100 pb-4">
                            <div className="bg-emerald-100 p-2 rounded-lg mr-3">
                                <span className="text-2xl">🤖</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-emerald-900">AI 智能分析报告</h2>
                                <p className="text-xs text-emerald-600 mt-0.5">基于多源数据的深度综合评估</p>
                            </div>
                        </div>

                        <div className="prose prose-sm max-w-none prose-headings:text-emerald-900 prose-p:text-gray-700 prose-strong:text-emerald-800 prose-ul:marker:text-emerald-500">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-emerald-800 border-l-4 border-emerald-500 pl-3 mt-6 mb-3 bg-emerald-50/50 py-1" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-emerald-700 mt-4 mb-2 flex items-center" {...props} />,
                                    table: ({ node, ...props }) => <div className="overflow-x-auto my-4 rounded-lg border border-emerald-100 shadow-sm"><table className="min-w-full divide-y divide-emerald-100" {...props} /></div>,
                                    thead: ({ node, ...props }) => <thead className="bg-emerald-50" {...props} />,
                                    th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider" {...props} />,
                                    td: ({ node, ...props }) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 border-t border-emerald-50" {...props} />,
                                    li: ({ node, ...props }) => <li className="text-gray-700 my-1" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-semibold text-emerald-900 bg-emerald-50 px-1 rounded" {...props} />,
                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-emerald-300 pl-4 italic text-gray-600 bg-gray-50 py-2 pr-2 rounded-r my-4" {...props} />
                                }}
                            >
                                {ipData.aiReasoning}
                            </ReactMarkdown>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ConnectivityCheck() {
    const [results, setResults] = useState({
        google: 'pending',
        youtube: 'pending',
        github: 'pending'
    });

    useEffect(() => {
        const checkImage = (url, key) => {
            const start = Date.now();
            const img = new Image();
            img.onload = () => setResults(prev => ({ ...prev, [key]: `${Date.now() - start}ms` }));
            img.onerror = () => setResults(prev => ({ ...prev, [key]: '失败' }));
            img.src = url + '?t=' + Date.now();
        };

        checkImage('https://www.google.com/favicon.ico', 'google');
        checkImage('https://www.youtube.com/favicon.ico', 'youtube');
        checkImage('https://github.com/favicon.ico', 'github');
    }, []);

    return (
        <div className="space-y-2 text-sm">
            <div className="flex justify-between">
                <span className="text-gray-500">Google:</span>
                <span className={results.google === '失败' ? 'text-red-500' : 'text-green-600'}>{results.google === 'pending' ? '检测中...' : results.google}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-500">YouTube:</span>
                <span className={results.youtube === '失败' ? 'text-red-500' : 'text-green-600'}>{results.youtube === 'pending' ? '检测中...' : results.youtube}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-500">GitHub:</span>
                <span className={results.github === '失败' ? 'text-red-500' : 'text-green-600'}>{results.github === 'pending' ? '检测中...' : results.github}</span>
            </div>
        </div>
    );
}

function InfoItem({ label, value }) {
    return (
        <div className="border-b border-gray-100 pb-2 last:border-0">
            <span className="text-sm text-gray-500 block">{label}</span>
            <span className="font-medium text-gray-900">{value || 'N/A'}</span>
        </div>
    );
}
