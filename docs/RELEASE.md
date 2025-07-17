# Release Process

This project uses [changesets](https://github.com/changesets/changesets) for version management and release automation.

## Creating a Changeset

When you make changes that should be included in the release notes:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages have changed (for single package, just select the one)
2. Choose the bump type (major, minor, patch)
3. Write a summary of the changes

The changeset will be saved in `.changeset/` directory.

## Release Process

### Automatic Release (Recommended)

1. Push changes with changesets to `main` branch
2. The GitHub Action will automatically:
   - Create a "Version Packages" PR with updated versions and CHANGELOG
   - When the PR is merged, publish to npm
   - Update Homebrew formula and Scoop manifest

### Manual Release

1. Update versions and CHANGELOG:
   ```bash
   pnpm version
   ```

2. Commit the changes:
   ```bash
   git add .
   git commit -m "chore: release"
   ```

3. Build and publish:
   ```bash
   pnpm release
   ```

4. Update package manager configs:
   ```bash
   pnpm run update-homebrew-formula
   pnpm run update-scoop-manifest
   ```

5. Push changes and tags:
   ```bash
   git push --follow-tags
   ```

## Version Guidelines

- **Patch** (0.0.x): Bug fixes, documentation updates
- **Minor** (0.x.0): New features, non-breaking changes
- **Major** (x.0.0): Breaking changes

## Pre-release Checklist

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Documentation is up to date
- [ ] CHANGELOG entries are clear and user-friendly

## Post-release Tasks

1. Update Homebrew tap repository with new formula
2. Update Scoop bucket repository with new manifest
3. Create GitHub release with changelog
4. Announce release on social media/forums if applicable