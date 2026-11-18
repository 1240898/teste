module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js', '**/*.test.jsx'],
  setupFiles: ['<rootDir>/test/setup.cjs'],
  // Three's current CommonJS shim requires ESM. Use the same ESM entry
  // as Vite and transform it together with the GLTF loader for Jest.
  moduleNameMapper: {
    '^three$': '<rootDir>/node_modules/three/build/three.module.js',
  },
  transformIgnorePatterns: ['/node_modules/(?!three/)'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
};
