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
    // Ask electron-builder to perform an ad-hoc signing pass so the afterSign
    // hook runs after all native unpacked files are final. The hook then
    // applies the preview entitlements and reseals the bundle.
    identity: '-',
    hardenedRuntime: false,
  },
};
