const pkg = require('./package.json');

const baseBuild = pkg.build || {};
const baseMac = baseBuild.mac || {};

module.exports = {
  ...baseBuild,
  mac: {
    ...baseMac,
    target: [
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    identity: null,
    hardenedRuntime: false,
  },
};
