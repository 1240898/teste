const { TextDecoder, TextEncoder } = require('node:util');

// React Router uses these Web APIs. Node provides them, but jsdom does not.
globalThis.TextDecoder ??= TextDecoder;
globalThis.TextEncoder ??= TextEncoder;
