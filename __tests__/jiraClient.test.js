/**
 * Unit tests for jiraClient.js
 */
import { jest } from '@jest/globals'
import * as mockCore from '../__fixtures__/core.js'

// Mock node-fetch
const mockFetch = jest.fn()

// Setup mocks before importing jiraClient
mockCore.getInput.mockImplementation((input) => {
  const inputs = {
    jira_host: 'test.atlassian.net',
    jira_username: 'test@example.com',
    jira_password: 'password123',
    jira_jql_filter: 'project = TEST',
    jira_github_url_field_id: 'Issue Link[URL Field]'
  }
  return inputs[input] || ''
})

jest.unstable_mockModule('node-fetch', () => ({ default: mockFetch }))
jest.unstable_mockModule('@actions/core', () => mockCore)

const { findByIssue, transition } = await import('../src/jiraClient.js')

describe('jiraClient', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockCore.info.mockClear()
  })

  describe('findByIssue', () => {
    it('finds Jira issues by GitHub URL', async () => {
      const mockResponse = {
        issues: [
          { key: 'TEST-1', fields: { project: { key: 'TEST' } } },
          { key: 'TEST-2', fields: { project: { key: 'TEST' } } }
        ]
      }

      mockFetch.mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      })

      const result = await findByIssue('https://github.com/owner/repo/issues/1')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/search/jql?jql=project%20%3D%20TEST%20AND%20%22Issue%20Link%5BURL%20Field%5D%22%20%3D%20%22https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fissues%2F1%22&fields=project',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            Accept: 'application/json',
            'Content-Type': 'application/json'
          })
        })
      )

      expect(result).toEqual(mockResponse.issues)
      expect(mockCore.info).toHaveBeenCalledWith(
        'Searching for jira issues linked to https://github.com/owner/repo/issues/1'
      )
    })

    it('handles fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(
        findByIssue('https://github.com/owner/repo/issues/1')
      ).rejects.toThrow('Network error')
    })
  })

  describe('transition', () => {
    it('transitions FRB project issue with transition ID 51', async () => {
      const issue = {
        id: '12345',
        key: 'FRB-1',
        fields: { project: { key: 'FRB' } }
      }

      mockFetch.mockResolvedValue({
        status: 204,
        json: () => Promise.resolve({})
      })

      const result = await transition(issue, 'Test comment')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/2/issue/FRB-1/transitions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            update: {
              comment: [
                {
                  add: {
                    body: 'Test comment'
                  }
                }
              ]
            },
            transition: {
              id: '51'
            },
            fields: {
              resolution: {
                name: 'Done'
              }
            }
          })
        })
      )

      expect(result).toEqual({})
    })

    it('transitions non-FRB project issue with transition ID 5', async () => {
      const issue = {
        id: '12345',
        key: 'TEST-1',
        fields: { project: { key: 'TEST' } }
      }

      mockFetch.mockResolvedValue({
        status: 204,
        json: () => Promise.resolve({})
      })

      await transition(issue, 'Test comment')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"id":"5"')
        })
      )
    })

    it('handles 204 status response', async () => {
      const issue = {
        id: '12345',
        key: 'TEST-1',
        fields: { project: { key: 'TEST' } }
      }

      mockFetch.mockResolvedValue({
        status: 204,
        json: () => Promise.resolve({})
      })

      const result = await transition(issue, 'Test comment')

      expect(result).toEqual({})
    })

    it('handles fetch errors', async () => {
      const issue = {
        id: '12345',
        key: 'TEST-1',
        fields: { project: { key: 'TEST' } }
      }

      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(transition(issue, 'Test comment')).rejects.toThrow(
        'Network error'
      )
    })
  })
})
