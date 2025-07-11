# Scoop Manifest for shadow-clone-jutsu

This directory contains the Scoop manifest for installing shadow-clone-jutsu on Windows.

## Installation

```powershell
scoop bucket add hashiramaendure https://github.com/hashiramaendure/scoop-bucket
scoop install shadow-clone-jutsu
```

## Development

To update the manifest after a new release:

```bash
npm run update-scoop-manifest
```

This will:
1. Read the current version from package.json
2. Update the download URL in the manifest
3. Calculate the SHA256 checksum of the npm package
4. Update the manifest file

## Manual Testing

To test the manifest locally:

```powershell
scoop install ./scoop/shadow-clone-jutsu.json
```

## Publishing

After updating the manifest, copy it to your Scoop bucket repository:

```bash
cp scoop/shadow-clone-jutsu.json /path/to/scoop-bucket/bucket/
```

Then commit and push the changes to your bucket repository.

## Windows-specific Considerations

- Ensure Node.js is installed via Scoop first: `scoop install nodejs`
- The tool uses npm to install dependencies during pre_install
- Binary paths are configured for Windows command prompt and PowerShell