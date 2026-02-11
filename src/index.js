
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
        return atob(base64);
    } catch (e) {
        // Return original if decoding fails, it might be plain text or different format
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
        skipdatasafe: false,
        servername: config.sni || '',
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
    // ss://base64(method:password@server:port)#name
    // ss://base64(method:password)@server:port#name
    let raw = url.slice(5);
    let name = 'ss';
    const hashIndex = raw.indexOf('#');
    if (hashIndex !== -1) {
        name = decodeURIComponent(raw.slice(hashIndex + 1));
        raw = raw.slice(0, hashIndex);
    }

    try {
        let method, password, server, port;
        if (raw.includes('@')) {
            const parts = raw.split('@');
            // If the first part is base64 encoded user info
            if (!parts[0].includes(':')) {
                const userInfo = decodeBase64(parts[0]);
                [method, password] = userInfo.split(':');
            } else {
                // raw format method:password
                [method, password] = parts[0].split(':');
            }

            const serverPart = parts[1];
            const lastColon = serverPart.lastIndexOf(':');
            server = serverPart.slice(0, lastColon);
            port = serverPart.slice(lastColon + 1);
        } else {
            // Old legacy format: everything base64 encoded
            const decoded = decodeBase64(raw); // method:password@server:port
            const atIndex = decoded.lastIndexOf('@');
            const userInfo = decoded.slice(0, atIndex);
            const serverInfo = decoded.slice(atIndex + 1);
            [method, password] = userInfo.split(':');

            const lastColon = serverInfo.lastIndexOf(':');
            server = serverInfo.slice(0, lastColon);
            port = serverInfo.slice(lastColon + 1);
        }

        return {
            name: name,
            type: 'ss',
            server: server,
            port: parseInt(port),
            cipher: method,
            password: password,
            udp: true
        };
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
        'rules': [
            'DOMAIN-SUFFIX,google.com,PROXY',
            'DOMAIN-KEYWORD,google,PROXY',
            'DOMAIN,google.com,PROXY',
            'DOMAIN-SUFFIX,github.com,PROXY',
            'GEOIP,CN,DIRECT',
            'MATCH,PROXY'
        ]
    };
}
