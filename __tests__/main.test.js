/**
 * Unit tests for the action's main functionality, src/main.js
 */
import { jest } from '@jest/globals'
import * as mockCore from '../__fixtures__/core.js'

// Mock @octokit/action
const mockOctokit = {
  paginate: jest.fn(),
  rest: {
    search: {
      issuesAndPullRequests: jest.fn()
    }
  }
}

// Mock jiraClient
const mockJiraClient = {
  findByIssue: jest.fn(),
  transition: jest.fn()
}

// Setup mocks before importing main.js
mockCore.getInput.mockReturnValue('v1.0.0')

jest.unstable_mockModule('@actions/core', () => mockCore)
jest.unstable_mockModule('../src/jiraClient.js', () => mockJiraClient)
jest.unstable_mockModule('@octokit/action', () => ({
  Octokit: jest.fn(() => mockOctokit)
}))

// Mock environment variable
process.env.GITHUB_REPOSITORY = 'owner/repo'

const { run } = await import('../src/main.js')

describe('main.js', () => {
  beforeEach(() => {
    mockCore.getInput.mockReturnValue('v1.0.0')
    mockCore.info.mockClear()
    mockCore.setFailed.mockClear()
    mockOctokit.paginate.mockClear()
    mockOctokit.rest.search.issuesAndPullRequests.mockClear()
    mockJiraClient.findByIssue.mockClear()
    mockJiraClient.transition.mockClear()
  })

  afterEach(() => {
    // Don't use jest.resetAllMocks() as it destroys the mock structure
  })

  it('processes issues successfully', async () => {
    const mockIssues = [
      { html_url: 'https://github.com/owner/repo/issues/1' },
      { html_url: 'https://github.com/owner/repo/issues/2' }
    ]

    mockOctokit.paginate.mockResolvedValue(mockIssues)
    mockJiraClient.findByIssue.mockResolvedValue([{ key: 'JIRA-1' }])
    mockJiraClient.transition.mockResolvedValue({})

    await run()

    expect(mockCore.info).toHaveBeenCalledWith('Starting job for owner repo.')
    expect(mockCore.info).toHaveBeenCalledWith(
      'Found 2 issue(s) in release v1.0.0'
    )
    expect(mockJiraClient.findByIssue).toHaveBeenCalledTimes(2)
    expect(mockJiraClient.transition).toHaveBeenCalledTimes(2)
  })

  it('handles GitHub API errors', async () => {
    mockOctokit.paginate.mockRejectedValue(new Error('API Error'))

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Error retrieving release by tag v1.0.0 Error: API Error'
    )
  })

  it('handles no Jira issues found', async () => {
    const mockIssues = [{ html_url: 'https://github.com/owner/repo/issues/1' }]

    mockOctokit.paginate.mockResolvedValue(mockIssues)
    mockJiraClient.findByIssue.mockResolvedValue([])

    await run()

    expect(mockCore.info).toHaveBeenCalledWith(
      'No Jira found for https://github.com/owner/repo/issues/1'
    )
    expect(mockJiraClient.transition).not.toHaveBeenCalled()
  })

  it('handles Jira search errors', async () => {
    const mockIssues = [{ html_url: 'https://github.com/owner/repo/issues/1' }]

    mockOctokit.paginate.mockResolvedValue(mockIssues)
    mockJiraClient.findByIssue.mockRejectedValue(new Error('Jira Error'))

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Error searching jira tasks: Error: Jira Error'
    )
  })

  it('handles Jira transition errors', async () => {
    const mockIssues = [{ html_url: 'https://github.com/owner/repo/issues/1' }]
    const mockJiraIssue = { key: 'JIRA-1', id: '12345' }

    mockOctokit.paginate.mockResolvedValue(mockIssues)
    mockJiraClient.findByIssue.mockResolvedValue([mockJiraIssue])
    mockJiraClient.transition.mockRejectedValue(new Error('Transition Error'))

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Error transitioning jira task 12345 Error: Transition Error'
    )
  })
})
