

// I'll create a standalone test file that copies the logic to verify, or uses vitest again with a new test case.
// Better to add a test case to test/worker.test.js that includes plugins.

import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';

// Helper to base64 encode for test strings
const base64 = (str) => Buffer.from(str).toString('base64');

describe('Ray2Clash Worker - SS Plugin Test', () => {
    it('should handle ss links with plugins', async () => {
        // ss://base64(method:password)@server:port/?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dgoogle.com#ss-obfs
        const userInfo = base64('aes-256-gcm:password-ss');
        const ssLink = `ss://${userInfo}@ss.com:8888/?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dgoogle.com#ss-obfs`;
        const subContent = base64(ssLink);

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(subContent),
            })
        );

        const req = new Request('http://localhost/?url=http://mock-sub.com/ss-plugin');
        const res = await worker.fetch(req, {}, {});

        expect(res.status).toBe(200);
        const yamlText = await res.text();

        console.log(yamlText);

        expect(yamlText).toContain('name: ss-obfs');
        expect(yamlText).toContain('type: ss');
        expect(yamlText).toContain('plugin: obfs'); // Clash uses 'obfs' or 'v2ray-plugin'
        expect(yamlText).toContain('plugin-opts:');
        expect(yamlText).toContain('mode: http');
    });
});
