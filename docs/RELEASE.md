# OpenOffer release process

This guide describes how to publish an OpenOffer release from the public repository.

OpenOffer currently supports two macOS binary release modes:

- **Unsigned preview**: ad-hoc signed macOS artifacts for early testers. This works without Apple Developer Program membership, but macOS shows Gatekeeper warnings.
- **Signed official**: Developer ID-signed, notarized, and stapled macOS artifacts. This requires Apple Developer ID credentials and repository secrets.

The same GitHub Actions workflow chooses the mode automatically. If all signing secrets are present, it publishes signed artifacts. If they are missing, it publishes unsigned preview artifacts and marks the GitHub Release as a prerelease.

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

## Unsigned macOS Preview Release

Use this mode until Apple Developer ID signing and notarization are configured.

The preview release path uses:

- `.github/workflows/release-macos.yml`
- the default Electron Builder config in `package.json`
- `scripts/ad-hoc-sign.js`

The artifacts are ad-hoc signed with `codesign --sign -`. The workflow verifies the app signatures and DMG integrity, but it does not run `spctl` or `stapler` because these artifacts are not notarized.

### Local Unsigned Build

On macOS:

```bash
npm run app:build:mac
```

Expected outputs in `release/`:

- `OpenOffer-X.Y.Z-arm64.dmg`
- `OpenOffer-X.Y.Z.dmg` or x64 equivalent
- `.zip` updater archives
- `latest-mac.yml`
- optional `*.blockmap`

### Workflow Preview Release

1. Make sure the release notes exist under `.github/release-notes/vX.Y.Z.md`.
2. Create and push the tag:

   ```bash
   git tag -a vX.Y.Z -m "OpenOffer X.Y.Z"
   git push origin vX.Y.Z
   ```

3. The `Release (macOS artifacts)` workflow detects missing Apple secrets and builds unsigned preview artifacts.
4. The workflow attaches `.dmg`, `.zip`, `latest-mac.yml`, optional `*.blockmap`, and `SHA256SUMS.txt`.
5. The GitHub Release is marked as a prerelease and the release body starts with an unsigned-build warning.

### Temporary macOS Installation

Tell users to verify checksums before opening the app:

```bash
FILE="OpenOffer-X.Y.Z-arm64.dmg" # or the asset they downloaded
grep "  $FILE$" SHA256SUMS.txt | shasum -a 256 -c -
```

Then:

1. Open the DMG.
2. Drag **OpenOffer** to **Applications**.
3. If macOS blocks the app, remove the quarantine flag:

   ```bash
   xattr -dr com.apple.quarantine /Applications/OpenOffer.app
   open /Applications/OpenOffer.app
   ```

This workaround is only acceptable for artifacts downloaded from the OpenOffer GitHub Release and verified with `SHA256SUMS.txt`.

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

When all secrets are present, the workflow switches to signed mode automatically.

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

### Workflow Signed Release

1. Confirm secrets are configured.
2. Create and push `vX.Y.Z`, or rerun the workflow against an existing tag.
3. The `Release (macOS artifacts)` workflow builds both macOS arches in signed mode.
4. The workflow prepares a `release-artifacts/` bundle with required `.dmg`, `.zip`, `latest-mac.yml`, `SHA256SUMS.txt`, and optional `*.blockmap` files when Electron Builder produces them.
5. On tag builds, the workflow publishes that bundle to the GitHub Release.
6. If `.github/release-notes/vX.Y.Z.md` exists, the workflow uses it as the GitHub Release body. Otherwise it falls back to a short generated body and `CHANGELOG.md` remains the source of detailed notes.

## Other Desktop Platforms

OpenOffer's Electron Builder config already defines Windows and Linux targets:

- Windows: NSIS installer and portable build for `x64`.
- Linux: AppImage `x64` and Debian package `x64`.

Build these on their native runners. Do not treat macOS cross-builds as release artifacts, because OpenOffer includes platform-specific native `.node` modules.

### Windows

Run on a Windows runner or Windows development machine:

```powershell
npm ci
npm run app:build:win
```

Expected outputs land in `release/`. Windows code signing is not configured yet, so users should expect SmartScreen warnings until an Authenticode signing certificate and Windows release workflow are added.

Do not publish `ia32` Windows artifacts yet. The Electron Builder config still lists the target, but `npm run app:build:win` intentionally forces `--x64` until the native module build produces every Windows arch that the installer packages.

### Linux

Run on an Ubuntu/Linux runner:

```bash
npm ci
npm run app:build:linux
```

Expected outputs land in `release/`. Linux packaging is configured but not part of the current official release gate.

### Future Multi-Platform Release Workflow

The durable shape should be a matrix workflow:

| Runner | Command | Assets |
| :----- | :------ | :----- |
| `macos-14` | `npm run app:build:mac` or signed mode | `.dmg`, `.zip`, `latest-mac.yml` |
| `windows-latest` | `npm run app:build:win` | x64 `.exe`, x64 portable archive |
| `ubuntu-latest` | `npm run app:build:linux` | `.AppImage`, `.deb` |

Each platform should generate checksums from the files it produced. Only promote a platform from "preview" to "official" after that platform has a passing install/run smoke test.

## Verification

For unsigned preview builds, verify integrity and ad-hoc signatures:

```bash
hdiutil verify "release/OpenOffer-X.Y.Z-arm64.dmg"
codesign --verify --deep --strict --verbose=4 "release/mac-arm64/OpenOffer.app"
codesign --verify --deep --strict --verbose=4 "release/mac/OpenOffer.app"
```

Run these extra checks before calling a signed macOS release official:

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
shopt -s nullglob
for asset in release/*.dmg release/*.zip release/latest-mac.yml release/*.blockmap; do
  shasum -a 256 "$asset" | awk -v name="$(basename "$asset")" '{print $1 "  " name}'
done > release/SHA256SUMS.txt
```

## Release Notes Checklist

- State whether the release is source-only, unsigned preview, or signed official.
- List the user-visible workflow changes.
- Mention provider, privacy, and local-data changes.
- Include verification commands or checksums for binaries.
- Commit curated release notes under `.github/release-notes/vX.Y.Z.md` when the release is public-facing.
- Link migration notes if settings, storage, providers, or permissions changed.
- Link known issues when something remains incomplete.

## Known Constraints

- macOS preview artifacts are not notarized until Apple Developer ID secrets are configured.
- Windows packaging exists in Electron Builder configuration, but it is not signed or release-gated yet.
- Linux packaging exists in configuration, but Linux is not the primary tested path.
- `npm audit` is not currently a clean release gate; dependency/security hardening should be tracked separately instead of hidden.
