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

### Desktop preview build

Download the correct asset for your device:

- macOS Apple Silicon: `arm64.dmg`
- macOS Intel: `x64` / non-`arm64` `.dmg`
- Windows: x64 setup `.exe` or portable `.exe`

Until Apple Developer ID signing and Windows Authenticode signing are configured, desktop artifacts are preview builds. Verify checksums before opening the app. On macOS, open the DMG and drag **OpenOffer** to **Applications**. On Windows, run the x64 setup or portable `.exe`; SmartScreen warnings are expected until code signing is configured.

If macOS blocks the preview build:

```bash
xattr -dr com.apple.quarantine /Applications/OpenOffer.app
open /Applications/OpenOffer.app
```

Use this workaround only for macOS artifacts downloaded from this GitHub Release.

## Checksums

The release workflow attaches `SHA256SUMS.txt` alongside the uploaded assets.
Verify a downloaded file with:

```bash
FILE="OpenOffer-X.Y.Z-arm64.dmg" # or the asset you downloaded
grep "  $FILE$" SHA256SUMS.txt | shasum -a 256 -c -
```
