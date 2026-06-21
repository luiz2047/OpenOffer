## Summary

One short paragraph explaining who should upgrade and why.

## Highlights

- Recruiter/job-search workflow:
- Interview or meeting workflow:
- Local/provider/privacy improvement:
- Contributor or documentation improvement:

## Fixes

- TBD

## Verification

- Source checks:
- macOS artifact verification:
- Known gaps:
- Checksums: attached as `SHA256SUMS.txt`

## Installation

### From source

```bash
git clone https://github.com/luiz2047/OpenOffer.git
cd OpenOffer
git checkout vX.Y.Z
npm install
npm run app:dev
```

### macOS preview build

Download the correct `.dmg` or `.zip` for your device:

- Apple Silicon: `arm64`
- Intel: `x64`

Until Apple Developer ID signing is configured, macOS artifacts are unsigned/ad-hoc signed preview builds. Verify checksums before opening the app, then open the DMG and drag **OpenOffer** to **Applications**.

If macOS blocks the preview build:

```bash
xattr -dr com.apple.quarantine /Applications/OpenOffer.app
open /Applications/OpenOffer.app
```

Use this workaround only for artifacts downloaded from this GitHub Release.

## Checksums

The release workflow attaches `SHA256SUMS.txt` alongside the uploaded assets.
Verify a downloaded file with:

```bash
FILE="OpenOffer-X.Y.Z-arm64.dmg" # or the asset you downloaded
grep "  $FILE$" SHA256SUMS.txt | shasum -a 256 -c -
```
