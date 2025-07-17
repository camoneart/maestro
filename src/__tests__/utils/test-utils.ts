// gh repo viewのモックレスポンス
export const mockGhRepoView = () => {
  return {
    stdout: JSON.stringify({
      name: 'test-repo',
      owner: { login: 'test-owner' },
    }),
    stderr: '',
    exitCode: 0,
  }
}

// gh auth statusのモックレスポンス
export const mockGhAuthStatus = () => {
  return {
    stdout: '✓ Logged in to github.com as test-user',
    stderr: '',
    exitCode: 0,
  }
}

// gh --versionのモックレスポンス
export const mockGhVersion = () => {
  return {
    stdout: 'gh version 2.40.0 (2025-01-01)',
    stderr: '',
    exitCode: 0,
  }
}
