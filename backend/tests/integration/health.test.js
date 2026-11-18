import request from 'supertest';
import { createRequire } from 'node:module';
import app from '../../src/app.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

describe('GET /api/v1/health', () => {
  it('returns status ok with version and timestamp', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.version).toBe(version);
    expect(typeof response.body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});
