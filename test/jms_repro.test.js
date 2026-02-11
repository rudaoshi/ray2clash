
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';
import fs from 'fs';

// Read the actual fetched content
// Hardcoded content from previous fetch
const jmsContent = Buffer.from(`ss://YWVzLTI1Ni1nY206cFp3RUxwSkF6YkpwYmd5NEAxMDQuMTYwLjQ0LjEzOToxNjYwOQ#JMS-959113@c77s1.portablesubmarines.com:16609
vmess://eyJwcyI6IkpNUy05NTkxMTNAYzc3czMucG9ydGFibGVzdWJtYXJpbmVzLmNvbToxNjYwOSIsInBvcnQiOiIxNjYwOSIsImlkIjoiOGYxYWE2MjctZjVhZS00ZWNiLWE1NmYtYjBlYzhkNzY1OTAxIiwiYWlkIjowLCJuZXQiOiJ0Y3AiLCJ0eXBlIjoibm9uZSIsInRscyI6Im5vbmUiLCJhZGQiOiIxOTguMzUuNDYuMjIwIn0`).toString('base64');

describe('Ray2Clash Worker - JMS Repro', () => {
    it('should parse JMS subscription correctly', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(jmsContent),
            })
        );

        const req = new Request('http://localhost/?url=http://mock-sub.com/jms');
        const res = await worker.fetch(req, {}, {});

        expect(res.status).toBe(200);
        const yamlText = await res.text();

        console.log(yamlText);

        // Check for specific nodes
        expect(yamlText).toContain('name: JMS-959113@c77s1.portablesubmarines.com:16609');
        expect(yamlText).toContain('server: 104.160.44.139');
        expect(yamlText).toContain('cipher: aes-256-gcm');

        expect(yamlText).toContain('name: JMS-959113@c77s3.portablesubmarines.com:16609');
        expect(yamlText).toContain('server: 198.35.46.220');
        expect(yamlText).toContain('uuid: 8f1aa627-f5ae-4ecb-a56f-b0ec8d765901');
    });
});
