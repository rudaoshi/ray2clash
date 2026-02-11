
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/cloudflare/index.js';

const base64 = (str) => Buffer.from(str).toString('base64');

describe('Ray2Clash Rules', () => {
    it('should generate Loyalsoldier rule providers and rules', async () => {
        const subContent = base64('vmess://eyJwcyI6InRlc3QiLCJhZGQiOiIxLjEuMS4xIiwicG9ydCI6IjQ0MyIsImlkIjoiYWFhIiwiYWlkIjoiMCIsIm5ldCI6InRjcCIsInR5cGUiOiJub25lIiwidGxzIjoibm9uZSJ9');

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(subContent),
            })
        );

        const req = new Request('http://localhost/?url=http://mock.com');
        const res = await worker.fetch(req, {}, {});
        const yamlText = await res.text();

        // Verify Rule Providers
        expect(yamlText).toContain('rule-providers:');
        expect(yamlText).toContain('reject:');
        expect(yamlText).toContain('url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt');
        expect(yamlText).toContain('icloud:');
        expect(yamlText).toContain('apple:');
        expect(yamlText).toContain('google:');
        expect(yamlText).toContain('proxy:');
        expect(yamlText).toContain('direct:');
        expect(yamlText).toContain('private:');
        expect(yamlText).toContain('gfw:');
        expect(yamlText).toContain('telegramcidr:');
        expect(yamlText).toContain('cncidr:');
        expect(yamlText).toContain('lancidr:');
        expect(yamlText).toContain('applications:');

        // Verify Rules
        expect(yamlText).toContain('RULE-SET,applications,DIRECT');
        expect(yamlText).toContain('RULE-SET,private,DIRECT');
        expect(yamlText).toContain('RULE-SET,reject,REJECT');
        expect(yamlText).toContain('RULE-SET,icloud,DIRECT');
        expect(yamlText).toContain('RULE-SET,apple,DIRECT');
        expect(yamlText).toContain('RULE-SET,google,PROXY');
        expect(yamlText).toContain('RULE-SET,proxy,PROXY');
        expect(yamlText).toContain('RULE-SET,direct,DIRECT');
        expect(yamlText).toContain('RULE-SET,lancidr,DIRECT');
        expect(yamlText).toContain('RULE-SET,cncidr,DIRECT');
        expect(yamlText).toContain('RULE-SET,telegramcidr,PROXY');
        expect(yamlText).toContain('GEOIP,LAN,DIRECT');
        expect(yamlText).toContain('GEOIP,CN,DIRECT');
        expect(yamlText).toContain('MATCH,PROXY');
    });
});
