import { readAppConfig } from '../../../src/shared/config/appConfig.js';

it('uses local defaults and keeps only public application settings', () => {
  const config = readAppConfig({ VITE_OTHER: 'not application config' });
  expect(config).toEqual({
    apiBaseUrl: 'http://localhost:8080/api/v1',
    apiTimeoutMs: 15000,
  });
  expect(Object.isFrozen(config)).toBe(true);
});

it.each([
  undefined,
  'http://api.example.org/api/v1',
  'https://name:password@api.example.org/api/v1',
  'https://api.example.org/api/v1?key=value',
  'https://api.example.org/api/v1/',
  '//api.example.org/api/v1',
])('rejects invalid production API base %s', (value) => {
  expect(() =>
    readAppConfig({ PROD: true, VITE_BACKEND_BASE_URL: value }),
  ).toThrow('VITE_BACKEND_BASE_URL');
});

it.each([
  '/api/v1',
  'https://api.example.org/api/v1',
  'http://localhost:8080/api/v1',
])(
  'allows valid production API base %s',
  (value) => {
    expect(
      readAppConfig({ PROD: true, VITE_BACKEND_BASE_URL: value }).apiBaseUrl,
    ).toBe(value);
  },
);

it.each(['0', '-1', '1.5', 'Infinity', '2147483648'])(
  'rejects invalid timeout %s',
  (value) => {
    expect(() => readAppConfig({ VITE_API_TIMEOUT_MS: value })).toThrow(
      'VITE_API_TIMEOUT_MS',
    );
  },
);
