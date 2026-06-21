# OpenOffer release process

This guide describes how to publish an OpenOffer release from the public repository.

OpenOffer is currently source-first. Signed macOS binary releases are supported by the workflow, but they require Apple Developer ID credentials and repository secrets before the workflow can produce official artifacts.

## Version Source

The canonical version is `package.json`.

Before a release:

```bash
node -p "require('./package.json').version"
npm run public-docs:check
npm run i18n:check
npm run test:i18n
npm run build
npm run build:electron
```

For code releases, also run the focused test set from `.github/workflows/community-quality.yml`.

## Source Release

A source release is acceptable when signed artifacts are not ready yet.

1. Make sure `README.md` and release notes clearly say source-first.
2. Tag the exact commit:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. Create a GitHub Release using `.github/RELEASE_TEMPLATE.md`.
4. Do not imply signed binaries exist if no assets were uploaded.

## Signed macOS Release

The signed release path uses:

- `.github/workflows/release-macos.yml`
- `electron-builder.signed.cjs`
- `scripts/notarize.js`
- `scripts/afterAllArtifactBuild.cjs`
- `build/entitlements.mac.plist`
- `build/entitlements.mac.inherit.plist`

Required GitHub secrets:

- `MACOS_CERT_P12_BASE64`
- `MACOS_CERT_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_API_KEY_P8_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

The workflow fails fast if these are absent. Do not publish a binary release by bypassing that check.

### Local Signed Build

Use this only on a machine with a valid Developer ID certificate and notarization credentials:

```bash
export CSC_LINK="/absolute/path/DeveloperIDApplication.p12"
export CSC_KEY_PASSWORD="<p12 export password>"
export APPLE_API_KEY="/absolute/path/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
npm run dist:signed
```

### Workflow Release

1. Confirm secrets are configured.
2. Create and push `vX.Y.Z`.
3. The `Release (macOS signed + notarized)` workflow builds both macOS arches.
4. The workflow uploads Actions artifacts and, on tag builds, attaches `.dmg`, `.zip`, and `latest-mac.yml` to the GitHub Release.

## Verification

Run these checks before calling the release official:

```bash
codesign --verify --deep --strict --verbose=4 "release/mac-arm64/OpenOffer.app"
codesign --verify --deep --strict --verbose=4 "release/mac/OpenOffer.app"
spctl -a -vvv -t execute "release/mac-arm64/OpenOffer.app"
spctl -a -vvv -t execute "release/mac/OpenOffer.app"
xcrun stapler validate "release/mac-arm64/OpenOffer.app"
xcrun stapler validate "release/mac/OpenOffer.app"
xcrun stapler validate "release/OpenOffer-X.Y.Z-arm64.dmg"
xcrun stapler validate "release/OpenOffer-X.Y.Z.dmg"
```

Attach checksums to the release notes:

```bash
shasum -a 256 release/*.dmg release/*.zip release/latest-mac.yml
```

## Release Notes Checklist

- State whether the release is source-only or includes signed artifacts.
- List the user-visible workflow changes.
- Mention provider, privacy, and local-data changes.
- Include verification commands or checksums for binaries.
- Link migration notes if settings, storage, providers, or permissions changed.
- Link known issues when something remains incomplete.

## Known Constraints

- Windows packaging exists in Electron Builder configuration, but the current official release workflow is macOS-only.
- Linux packaging exists in configuration, but Linux is not the primary tested path.
- `npm audit` is not currently a clean release gate; dependency/security hardening should be tracked separately instead of hidden.
