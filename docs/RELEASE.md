# OpenOffer release process

This guide describes how to publish an OpenOffer release from the public repository.

OpenOffer's release workflow publishes desktop artifacts from native GitHub Actions runners:

- **macOS**: DMG and updater ZIP for Apple Silicon and Intel Macs.
- **Windows**: unsigned x64 NSIS setup and portable EXE.

macOS supports two binary release modes:

- **Unsigned preview**: ad-hoc signed macOS artifacts for early testers. This works without Apple Developer Program membership, but macOS shows Gatekeeper warnings.
- **Signed official**: Developer ID-signed, notarized, and stapled macOS artifacts. This requires Apple Developer ID credentials and repository secrets.

The same GitHub Actions workflow chooses the macOS mode automatically. If all Apple signing secrets are present, it publishes signed macOS artifacts. If they are missing, it publishes unsigned preview artifacts and marks the GitHub Release as a prerelease. Windows artifacts are unsigned until Authenticode signing is configured, so SmartScreen warnings are expected.

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

## Desktop Preview Release

Use this mode until Apple Developer ID signing, notarization, and Windows Authenticode signing are configured.

The preview release path uses:

- `.github/workflows/release-desktop.yml`
- `electron-builder.preview.cjs` for ZIP/app packaging
- `scripts/ad-hoc-sign.js`
- `scripts/build-preview-dmgs.cjs` for sequential DMG creation via `create-dmg`

The macOS artifacts are ad-hoc signed with `codesign --sign -`. The workflow verifies the app signatures and DMG integrity, but it does not run `spctl` or `stapler` because these artifacts are not notarized. Preview DMGs are created after Electron Builder finishes ZIP/app packaging so CI does not race two `hdiutil create` jobs.

The Windows artifacts are built on `windows-latest` with `npm run app:build:win`, collected from `release/`, and published only if the macOS job also succeeds.

### Local Unsigned Build

On macOS:

```bash
brew install create-dmg
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

3. The `Release (desktop artifacts)` workflow starts macOS and Windows builds on native runners.
4. The macOS job detects missing Apple secrets and builds unsigned preview artifacts.
5. The Windows job builds x64 setup and portable `.exe` artifacts.
6. The `publish-release` job runs only after both platform jobs pass, generates one combined `SHA256SUMS.txt`, and publishes all assets to the same GitHub Release.
7. The GitHub Release is marked as a prerelease while macOS artifacts are unsigned, and the release body starts with an unsigned-build warning.

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

- `.github/workflows/release-desktop.yml`
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
3. The `Release (desktop artifacts)` workflow builds macOS in signed mode and Windows in unsigned x64 mode.
4. The macOS and Windows jobs upload platform artifacts separately.
5. The `publish-release` job downloads both artifact sets, generates a combined `SHA256SUMS.txt`, and publishes everything to the GitHub Release.
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

Expected outputs land in `release/`. Windows code signing is not configured yet, so users should expect SmartScreen warnings until an Authenticode signing certificate is added.

Do not publish `ia32` Windows artifacts yet. The Electron Builder config still lists the target, but `npm run app:build:win` intentionally forces `--x64` until the native module build produces every Windows arch that the installer packages.

### Linux

Run on an Ubuntu/Linux runner:

```bash
npm ci
npm run app:build:linux
```

Expected outputs land in `release/`. Linux packaging is configured but not part of the current official release gate.

### Current Multi-Platform Release Workflow

The release workflow shape is:

| Runner | Command | Assets |
| :----- | :------ | :----- |
| `macos-14` | `npm run app:build:mac` or signed mode | `.dmg`, `.zip`, `latest-mac.yml` |
| `windows-latest` | `npm run app:build:win` | x64 `.exe`, x64 portable archive |
| `ubuntu-latest` | publish job only | combined `SHA256SUMS.txt` and GitHub Release upload |

The platform build jobs upload artifacts to Actions first. The publish job downloads both sets, generates a single checksum file from the exact files that will be uploaded, and publishes the GitHub Release only when both platform builds passed.

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

Generate local checksums when testing by hand:

```bash
shopt -s nullglob
for asset in release/*.dmg release/*.zip release/*.exe release/latest*.yml release/*.blockmap; do
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
- Windows packaging is release-gated, but it is not signed yet.
- Linux packaging exists in configuration, but Linux is not the primary tested path.
- `npm audit` is not currently a clean release gate; dependency/security hardening should be tracked separately instead of hidden.
