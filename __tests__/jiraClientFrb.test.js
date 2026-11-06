/**
 * Unit tests for jiraClient.js when a separate FRB GitHub URL field is set
 */
import { jest } from '@jest/globals'
import * as mockCore from '../__fixtures__/core.js'

const mockFetch = jest.fn()

mockCore.getInput.mockImplementation((input) => {
  const inputs = {
    jira_host: 'test.atlassian.net',
    jira_username: 'test@example.com',
    jira_password: 'password123',
    jira_jql_filter:
      'project in ("TFECO","FRB") and "Team (R&D)[Labels]" = "X"',
    jira_github_url_field_id: 'Issue Link[URL Field]',
    jira_frb_github_url_field_id: 'GitHub Issue/PR[URL Field]'
  }
  return inputs[input] || ''
})

jest.unstable_mockModule('node-fetch', () => ({ default: mockFetch }))
jest.unstable_mockModule('@actions/core', () => mockCore)

const { findByIssue } = await import('../src/jiraClient.js')

describe('jiraClient with FRB field override', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ issues: [{ key: 'FRB-1' }] })
    })
  })

  it('searches FRB on its own field and other projects on the default field', async () => {
    const url = 'https://github.com/owner/repo/pull/1'
    const result = await findByIssue(url)

    const calledUrl = new URL(mockFetch.mock.calls[0][0])
    expect(calledUrl.pathname).toBe('/rest/api/3/search/jql')
    expect(calledUrl.searchParams.get('fields')).toBe('project')
    expect(calledUrl.searchParams.get('jql')).toBe(
      '(project in ("TFECO","FRB") and "Team (R&D)[Labels]" = "X") AND (' +
        `(project = FRB AND "GitHub Issue/PR[URL Field]" = "${url}") OR ` +
        `(project != FRB AND "Issue Link[URL Field]" = "${url}"))`
    )
    expect(result).toEqual([{ key: 'FRB-1' }])
  })
})
