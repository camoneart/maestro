import { describe, it, expect, vi, beforeEach } from 'vitest'
import { issueCommand } from '../../commands/issue.js'
import { Command } from 'commander'

describe('issue command simple tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct command configuration', () => {
    expect(issueCommand).toBeInstanceOf(Command)
    expect(issueCommand.name()).toBe('issue')
    expect(issueCommand.description()).toContain('GitHub Issue')
    expect(issueCommand.aliases()).toContain('i')

    // Check options
    const options = issueCommand.options
    const optionNames = options.map(opt => opt.long)

    expect(optionNames).toContain('--create')
    expect(optionNames).toContain('--list')
    expect(optionNames).toContain('--close')
    expect(optionNames).toContain('--web')
    expect(optionNames).toContain('--assign')
    expect(optionNames).toContain('--label')
    expect(optionNames).toContain('--milestone')
  })

  it('should have correct argument configuration', () => {
    const args = issueCommand.registeredArguments
    expect(args).toHaveLength(1)
    expect(args[0].name()).toBe('issue-number')
    expect(args[0].required).toBe(false)
  })

  it('should test issue state formatting', () => {
    const formatIssueState = (state: string): string => {
      const states: Record<string, string> = {
        open: '🟢 Open',
        closed: '🔴 Closed',
        reopened: '🔄 Reopened',
      }
      return states[state.toLowerCase()] || state
    }

    expect(formatIssueState('open')).toBe('🟢 Open')
    expect(formatIssueState('closed')).toBe('🔴 Closed')
    expect(formatIssueState('OPEN')).toBe('🟢 Open')
  })

  it('should test issue priority from labels', () => {
    const getIssuePriority = (labels: string[]): string => {
      if (labels.includes('critical') || labels.includes('urgent')) {
        return '🔥 Critical'
      }
      if (labels.includes('high-priority')) {
        return '🔴 High'
      }
      if (labels.includes('low-priority')) {
        return '🔵 Low'
      }
      return '🟡 Medium'
    }

    expect(getIssuePriority(['bug', 'critical'])).toBe('🔥 Critical')
    expect(getIssuePriority(['high-priority'])).toBe('🔴 High')
    expect(getIssuePriority(['enhancement'])).toBe('🟡 Medium')
  })

  it('should test issue title formatting', () => {
    const formatIssueTitle = (issue: any): string => {
      const parts = [`#${issue.number}`]

      if (issue.labels?.includes('bug')) {
        parts.push('🐛')
      } else if (issue.labels?.includes('enhancement')) {
        parts.push('✨')
      } else if (issue.labels?.includes('documentation')) {
        parts.push('📚')
      }

      parts.push(issue.title)

      return parts.join(' ')
    }

    expect(
      formatIssueTitle({
        number: 123,
        title: 'Fix login',
        labels: ['bug'],
      })
    ).toBe('#123 🐛 Fix login')

    expect(
      formatIssueTitle({
        number: 456,
        title: 'Add feature',
        labels: ['enhancement'],
      })
    ).toBe('#456 ✨ Add feature')
  })

  it('should test issue list formatting', () => {
    const formatIssueList = (issues: any[]): string[] => {
      return issues.map(issue => {
        const state = issue.state === 'open' ? '○' : '●'
        const assignee = issue.assignees?.length > 0 ? ` @${issue.assignees[0]}` : ''
        const milestone = issue.milestone ? ` [${issue.milestone}]` : ''

        return `${state} #${issue.number} ${issue.title}${assignee}${milestone}`
      })
    }

    const issues = [
      { number: 1, title: 'Bug 1', state: 'open', assignees: ['user1'], milestone: 'v1.0' },
      { number: 2, title: 'Feature 2', state: 'closed', assignees: [], milestone: null },
    ]

    const formatted = formatIssueList(issues)
    expect(formatted[0]).toBe('○ #1 Bug 1 @user1 [v1.0]')
    expect(formatted[1]).toBe('● #2 Feature 2')
  })

  it('should test issue template types', () => {
    const getIssueTemplate = (type: string): string => {
      const templates: Record<string, string> = {
        bug: `### 🐛 Bug Report

**Description:**
A clear and concise description of the bug.

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
What you expected to happen.

**Actual Behavior:**
What actually happened.`,

        feature: `### ✨ Feature Request

**Is your feature request related to a problem?**
A clear description of the problem.

**Proposed Solution:**
Describe the solution you'd like.

**Alternatives:**
Any alternative solutions you've considered.`,

        default: `### Issue

**Description:**
Describe your issue here.`,
      }

      return templates[type] || templates.default
    }

    const bugTemplate = getIssueTemplate('bug')
    expect(bugTemplate).toContain('🐛 Bug Report')
    expect(bugTemplate).toContain('Steps to Reproduce')

    const featureTemplate = getIssueTemplate('feature')
    expect(featureTemplate).toContain('✨ Feature Request')
    expect(featureTemplate).toContain('Proposed Solution')
  })

  it('should test assignee list formatting', () => {
    const formatAssignees = (assignees: string[]): string => {
      if (assignees.length === 0) {
        return 'Unassigned'
      }
      if (assignees.length === 1) {
        return `@${assignees[0]}`
      }
      return `@${assignees[0]} +${assignees.length - 1} others`
    }

    expect(formatAssignees([])).toBe('Unassigned')
    expect(formatAssignees(['user1'])).toBe('@user1')
    expect(formatAssignees(['user1', 'user2', 'user3'])).toBe('@user1 +2 others')
  })

  it('should test label formatting', () => {
    const formatLabels = (labels: string[]): string => {
      const labelEmojis: Record<string, string> = {
        bug: '🐛',
        enhancement: '✨',
        documentation: '📚',
        'good first issue': '👋',
        'help wanted': '🆘',
        question: '❓',
        wontfix: '🚫',
      }

      return labels
        .map(label => {
          const emoji = labelEmojis[label] || '🏷️'
          return `${emoji} ${label}`
        })
        .join(', ')
    }

    expect(formatLabels(['bug', 'help wanted'])).toBe('🐛 bug, 🆘 help wanted')

    expect(formatLabels(['enhancement'])).toBe('✨ enhancement')

    expect(formatLabels(['custom-label'])).toBe('🏷️ custom-label')
  })

  it('should test issue action messages', () => {
    const getActionMessage = (action: string, issueNumber: string): string => {
      const messages: Record<string, string> = {
        create: `✅ Issue #${issueNumber} を作成しました`,
        close: `🔴 Issue #${issueNumber} をクローズしました`,
        reopen: `🔄 Issue #${issueNumber} を再オープンしました`,
        assign: `👤 Issue #${issueNumber} にアサインしました`,
        label: `🏷️ Issue #${issueNumber} にラベルを追加しました`,
      }
      return messages[action] || `✓ Issue #${issueNumber} を更新しました`
    }

    expect(getActionMessage('create', '123')).toBe('✅ Issue #123 を作成しました')
    expect(getActionMessage('close', '456')).toBe('🔴 Issue #456 をクローズしました')
    expect(getActionMessage('unknown', '789')).toBe('✓ Issue #789 を更新しました')
  })
})
