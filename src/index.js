
import yaml from 'js-yaml';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const subUrl = url.searchParams.get('url');

        if (!subUrl) {
            return new Response('Missing "url" query parameter. Usage: /?url=YOUR_SUB_LINK', { status: 400 });
        }

        try {
            const response = await fetch(subUrl, {
                headers: {
                    'User-Agent': 'v2ray-ng',
                },
            });

            if (!response.ok) {
                return new Response(`Failed to fetch subscription: ${response.statusText}`, { status: 502 });
            }

            const text = await response.text();
            // Handle base64 decoding safely
            const decoded = decodeBase64(text.trim());
            const proxies = parseProxies(decoded);

            const clashConfig = generateClashConfig(proxies);
            const yamlConfig = yaml.dump(clashConfig);

            return new Response(yamlConfig, {
                headers: {
                    'Content-Type': 'text/yaml; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="clash-config.yaml"',
                },
            });
        } catch (err) {
            return new Response(`Error processing subscription: ${err.message}\n${err.stack}`, { status: 500 });
        }
    },
};

function decodeBase64(str) {
    // Fix common base64 url safe replacements
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (base64.length % 4) {
        base64 += '=';
    }
    try {
        const binaryStr = atob(base64);
        // Properly decode UTF-8
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        // Return original if decoding fails
        return str;
    }
}

function parseProxies(content) {
    const lines = content.split(/[\r\n]+/);
    const proxies = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
            let proxy = null;
            if (trimmed.startsWith('vmess://')) {
                proxy = parseVmess(trimmed);
            } else if (trimmed.startsWith('vless://')) {
                proxy = parseVless(trimmed);
            } else if (trimmed.startsWith('trojan://')) {
                proxy = parseTrojan(trimmed);
            } else if (trimmed.startsWith('ss://')) {
                proxy = parseShadowsocks(trimmed);
            }

            if (proxy) {
                proxies.push(proxy);
            }
        } catch (e) {
            console.warn(`Failed to parse line: ${trimmed.substring(0, 50)}...`, e);
        }
    }

    return proxies;
}

function parseVmess(url) {
    const b64 = url.slice(8);
    const jsonStr = decodeBase64(b64);
    let config;
    try {
        config = JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }

    return {
        name: config.ps || 'vmess',
        type: 'vmess',
        server: config.add,
        port: parseInt(config.port) || 443,
        uuid: config.id,
        alterId: parseInt(config.aid || 0),
        cipher: config.scy || 'auto',
        tls: config.tls === 'tls',
        'skip-cert-verify': true, // v2ray_subscribe suggests allowInsecure=True 
        servername: config.sni || config.host || '', // Use host as fallback for sni
        network: config.net || 'tcp',
        'ws-opts': config.net === 'ws' ? {
            path: config.path || '/',
            headers: {
                Host: config.host || ''
            }
        } : undefined,
        udp: true
    };
}

function parseVless(url) {
    // Hack to use URL parser: replace vless:// with http://
    try {
        const safeUrl = url.replace('vless://', 'http://');
        const parsed = new URL(safeUrl);

        const params = parsed.searchParams;
        const name = parsed.hash ? parsed.hash.slice(1) : 'vless'; // remove #

        const proxy = {
            name: decodeURIComponent(name),
            type: 'vless',
            server: parsed.hostname,
            port: parseInt(parsed.port) || 443,
            uuid: parsed.username,
            cipher: 'auto',
            tls: params.get('security') === 'tls',
            'skip-cert-verify': params.get('allowInsecure') === '1',
            servername: params.get('sni') || '',
            network: params.get('type') || 'tcp',
            udp: true
        };

        if (params.get('flow')) {
            proxy.flow = params.get('flow');
        }

        if (proxy.network === 'ws') {
            proxy['ws-opts'] = {
                path: params.get('path') || '/',
                headers: {
                    Host: params.get('host') || ''
                }
            };
        }

        // Grpc, etc support could be added here
        if (proxy.network === 'grpc') {
            proxy['grpc-opts'] = {
                'grpc-service-name': params.get('serviceName') || ''
            }
        }

        return proxy;
    } catch (e) {
        console.error('Vless parse error', e);
        return null;
    }
}

function parseTrojan(url) {
    try {
        const safeUrl = url.replace('trojan://', 'http://');
        const parsed = new URL(safeUrl);

        const params = parsed.searchParams;
        const name = parsed.hash ? parsed.hash.slice(1) : 'trojan';

        return {
            name: decodeURIComponent(name),
            type: 'trojan',
            server: parsed.hostname,
            port: parseInt(parsed.port) || 443,
            password: parsed.username,
            udp: true,
            sni: params.get('sni') || '',
            'skip-cert-verify': params.get('allowInsecure') === '1',
        };
    } catch (e) {
        console.error('Trojan parse error', e);
        return null;
    }
}

function parseShadowsocks(url) {
    // ss://base64(method:password)@server:port
    // ss://base64(method:password)@server:port/?plugin=...#name
    let raw = url.slice(5);
    let name = 'ss';
    const hashIndex = raw.indexOf('#');
    if (hashIndex !== -1) {
        name = decodeURIComponent(raw.slice(hashIndex + 1));
        raw = raw.slice(0, hashIndex);
    }

    // Check for query params (plugins)
    let params = new URLSearchParams();
    const qIndex = raw.indexOf('?');
    if (qIndex !== -1) {
        params = new URLSearchParams(raw.slice(qIndex));
        raw = raw.slice(0, qIndex);
    }

    try {
        let method, password, server, port;
        if (raw.includes('@')) {
            const parts = raw.split('@');
            if (!parts[0].includes(':')) {
                const userInfo = decodeBase64(parts[0]);
                [method, password] = userInfo.split(':');
            } else {
                [method, password] = parts[0].split(':');
            }

            const serverPart = parts[1];
            const lastColon = serverPart.lastIndexOf(':');
            server = serverPart.slice(0, lastColon);
            port = serverPart.slice(lastColon + 1);
        } else {
            const decoded = decodeBase64(raw);
            const atIndex = decoded.lastIndexOf('@');
            const userInfo = decoded.slice(0, atIndex);
            const serverInfo = decoded.slice(atIndex + 1);
            [method, password] = userInfo.split(':');

            const lastColon = serverInfo.lastIndexOf(':');
            server = serverInfo.slice(0, lastColon);
            port = serverInfo.slice(lastColon + 1);
        }

        const proxy = {
            name: name,
            type: 'ss',
            server: server,
            port: parseInt(port),
            cipher: method,
            password: password,
            udp: true
        };

        // Handle plugins
        const pluginStr = params.get('plugin');
        if (pluginStr) {
            // Plugin format: plugin-name;opt1=val1;opt2=val2
            // Sometimes URL encoded
            const decodedPlugin = decodeURIComponent(pluginStr);
            const parts = decodedPlugin.split(';');
            const pluginName = parts[0];
            const pluginOpts = {};

            for (let i = 1; i < parts.length; i++) {
                const [key, val] = parts[i].split('=');
                if (key && val) {
                    pluginOpts[key] = val;
                }
            }

            if (pluginName === 'obfs-local' || pluginName === 'simple-obfs') {
                proxy.plugin = 'obfs';
                proxy['plugin-opts'] = {
                    mode: pluginOpts.obfs || 'http',
                    host: pluginOpts['obfs-host'] || ''
                };
            } else if (pluginName === 'v2ray-plugin') {
                proxy.plugin = 'v2ray-plugin';
                proxy['plugin-opts'] = {
                    mode: pluginOpts.mode || 'websocket',
                    host: pluginOpts.host || '',
                    path: pluginOpts.path || '/',
                    tls: pluginOpts.tls === 'tls' || pluginOpts.tls === 'true'
                };
            }
        }

        return proxy;
    } catch (e) {
        console.error('SS parse error', e);
        return null;
    }
}

function generateClashConfig(proxies) {
    const proxyNames = proxies.map(p => p.name);

    return {
        'port': 7890,
        'socks-port': 7891,
        'allow-lan': true,
        'mode': 'Rule',
        'log-level': 'info',
        'external-controller': '127.0.0.1:9090',
        'proxies': proxies,
        'proxy-groups': [
            {
                'name': 'PROXY',
                'type': 'select',
                'proxies': ['Auto', 'Fallback', ...proxyNames]
            },
            {
                'name': 'Auto',
                'type': 'url-test',
                'url': 'http://www.gstatic.com/generate_204',
                'interval': 300,
                'proxies': proxyNames
            },
            {
                'name': 'Fallback',
                'type': 'fallback',
                'url': 'http://www.gstatic.com/generate_204',
                'interval': 300,
                'proxies': proxyNames
            }
        ],
        'rule-providers': {
            'reject': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
                'path': './ruleset/reject.yaml',
                'interval': 86400
            },
            'icloud': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt',
                'path': './ruleset/icloud.yaml',
                'interval': 86400
            },
            'apple': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt',
                'path': './ruleset/apple.yaml',
                'interval': 86400
            },
            'google': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt',
                'path': './ruleset/google.yaml',
                'interval': 86400
            },
            'proxy': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt',
                'path': './ruleset/proxy.yaml',
                'interval': 86400
            },
            'direct': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt',
                'path': './ruleset/direct.yaml',
                'interval': 86400
            },
            'private': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt',
                'path': './ruleset/private.yaml',
                'interval': 86400
            },
            'gfw': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt',
                'path': './ruleset/gfw.yaml',
                'interval': 86400
            },
            'tld-not-cn': {
                'type': 'http',
                'behavior': 'domain',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt',
                'path': './ruleset/tld-not-cn.yaml',
                'interval': 86400
            },
            'telegramcidr': {
                'type': 'http',
                'behavior': 'ipcidr',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
                'path': './ruleset/telegramcidr.yaml',
                'interval': 86400
            },
            'cncidr': {
                'type': 'http',
                'behavior': 'ipcidr',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt',
                'path': './ruleset/cncidr.yaml',
                'interval': 86400
            },
            'lancidr': {
                'type': 'http',
                'behavior': 'ipcidr',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt',
                'path': './ruleset/lancidr.yaml',
                'interval': 86400
            },
            'applications': {
                'type': 'http',
                'behavior': 'classical',
                'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt',
                'path': './ruleset/applications.yaml',
                'interval': 86400
            }
        },
        'rules': [
            'RULE-SET,applications,DIRECT',
            'RULE-SET,private,DIRECT',
            'RULE-SET,reject,REJECT',
            'RULE-SET,icloud,DIRECT',
            'RULE-SET,apple,DIRECT',
            'RULE-SET,google,PROXY',
            'RULE-SET,proxy,PROXY',
            'RULE-SET,direct,DIRECT',
            'RULE-SET,lancidr,DIRECT',
            'RULE-SET,cncidr,DIRECT',
            'RULE-SET,telegramcidr,PROXY',
            'GEOIP,LAN,DIRECT',
            'GEOIP,CN,DIRECT',
            'MATCH,PROXY'
        ]
    };
}
