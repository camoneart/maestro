# Homebrew Formula for shadow-clone-jutsu

This directory contains the Homebrew formula for installing shadow-clone-jutsu on macOS.

## Installation

```bash
brew tap hashiramaendure/tap
brew install shadow-clone-jutsu
```

## Development

To update the formula after a new release:

```bash
npm run update-homebrew-formula
```

This will:
1. Read the current version from package.json
2. Update the download URL in the formula
3. Calculate the SHA256 checksum of the npm package
4. Update the formula file

## Manual Testing

To test the formula locally:

```bash
brew install --build-from-source ./homebrew/shadow-clone-jutsu.rb
```

## Publishing

After updating the formula, copy it to your Homebrew tap repository:

```bash
cp homebrew/shadow-clone-jutsu.rb /path/to/homebrew-tap/Formula/
```

Then commit and push the changes to your tap repository.