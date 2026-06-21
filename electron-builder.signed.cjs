process.env.NATIVELY_PRODUCTION_SIGN = '1';

const pkg = require('./package.json');

const baseBuild = pkg.build || {};
const baseMac = baseBuild.mac || {};

module.exports = {
  ...baseBuild,
  afterSign: './scripts/notarize.js',
  afterAllArtifactBuild: './scripts/afterAllArtifactBuild.cjs',
  extraMetadata: {
    ...(baseBuild.extraMetadata || {}),
    nativelySigned: true,
  },
  mac: {
    ...baseMac,
    target: [
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    identity: process.env.NATIVELY_SIGN_IDENTITY || process.env.CSC_NAME || undefined,
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',
    gatekeeperAssess: false,
    notarize: false,
  },
};
