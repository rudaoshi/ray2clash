
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/cloudflare/index.js';

// Helper to base64 encode for test strings
const base64 = (str) => Buffer.from(str).toString('base64');

describe('Ray2Clash Worker', () => {
    it('should generate valid Clash config for vmess link', async () => {
        const vmessConfig = {
            v: "2",
            ps: "test-vmess",
            add: "example.com",
            port: "443",
            id: "uuid-123",
            aid: "0",
            scy: "auto",
            net: "ws",
            type: "none",
            host: "host.com",
            path: "/path",
            tls: "tls",
            sni: "sni.com",
            alpn: ""
        };
        const vmessLink = `vmess://${base64(JSON.stringify(vmessConfig))}`;
        const subContent = base64(vmessLink);

        // Mock fetch
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(subContent),
            })
        );

        const req = new Request('http://localhost/?url=http://mock-sub.com');
        const res = await worker.fetch(req, {}, {});

        expect(res.status).toBe(200);
        const yamlText = await res.text();

        // Basic assertions on output YAML structure
        expect(yamlText).toContain('name: test-vmess');
        expect(yamlText).toContain('type: vmess');
        expect(yamlText).toContain('server: example.com');
        expect(yamlText).toContain('uuid: uuid-123');
        expect(yamlText).toContain('tls: true');
        expect(yamlText).toContain('network: ws');
        expect(yamlText).toContain('path: /path');
    });

    it('should handle vless links', async () => {
        const vlessLink = 'vless://uuid-456@vless.com:8443?security=tls&encryption=none&headerType=none&type=tcp&sni=vless.sni#vless-node';
        const subContent = base64(vlessLink);

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(subContent),
            })
        );

        const req = new Request('http://localhost/?url=http://mock-sub.com/vless');
        const res = await worker.fetch(req, {}, {});

        expect(res.status).toBe(200);
        const yamlText = await res.text();

        expect(yamlText).toContain('name: vless-node');
        expect(yamlText).toContain('type: vless');
        expect(yamlText).toContain('server: vless.com');
        expect(yamlText).toContain('port: 8443');
        expect(yamlText).toContain('uuid: uuid-456');
    });

    it('should handle trojan links', async () => {
        const trojanLink = 'trojan://password-789@trojan.com:443?sni=trojan.sni#trojan-node';
        const subContent = base64(trojanLink);

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(subContent),
            })
        );

        const req = new Request('http://localhost/?url=http://mock-sub.com/trojan');
        const res = await worker.fetch(req, {}, {});

        expect(res.status).toBe(200);
        const yamlText = await res.text();

        expect(yamlText).toContain('name: trojan-node');
        expect(yamlText).toContain('type: trojan');
        expect(yamlText).toContain('password: password-789');
        expect(yamlText).toContain('sni: trojan.sni');
    });

    it('should handle shadowsocks links (new format)', async () => {
        // ss://base64(method:password)@server:port#name
        const userInfo = base64('aes-256-gcm:password-ss');
        const ssLink = `ss://${userInfo}@ss.com:8888#ss-node`;
        const subContent = base64(ssLink);

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(subContent),
            })
        );

        const req = new Request('http://localhost/?url=http://mock-sub.com/ss');
        const res = await worker.fetch(req, {}, {});

        expect(res.status).toBe(200);
        const yamlText = await res.text();

        expect(yamlText).toContain('name: ss-node');
        expect(yamlText).toContain('type: ss');
        expect(yamlText).toContain('cipher: aes-256-gcm');
        expect(yamlText).toContain('password: password-ss');
    });

    it('should return error for missing url param', async () => {
        const req = new Request('http://localhost/');
        const res = await worker.fetch(req, {}, {});
        expect(res.status).toBe(400);
    });
});
