import * as core from '@actions/core'
import { Octokit } from '@octokit/action'
import * as jiraClient from './jiraClient.js'

const GITHUB_RELEASE_NAME = core.getInput('github_release_name')

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')

async function checkAndCloseLinkedJira(issueUrl) {
  let issue = null

  try {
    const searchResults = await jiraClient.findByIssue(issueUrl)

    if (searchResults.length > 0) {
      ;[issue] = searchResults
      core.info(`Jira ${issue.key} found for ${issueUrl}`)
    } else {
      core.info(`No Jira found for ${issueUrl}`)
      return
    }
  } catch (error) {
    core.setFailed(`Error searching jira tasks: ${error}`)
    return
  }

  const commentBody = `(Automated Message) The GitHub issue linked to this Jira has been resolved in [${GITHUB_RELEASE_NAME}|https://github.com/${owner}/${repo}/releases/tag/${GITHUB_RELEASE_NAME}] of ${repo}. 🎉`

  try {
    await jiraClient.transition(issue, commentBody)
  } catch (error) {
    core.setFailed(`Error transitioning jira task ${issue.id} ${error}`)
  }
}

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    core.info(`Starting job for ${owner} ${repo}.`)

    jiraClient.transition()

    const octokit = new Octokit()
    let issues = []

    try {
      issues = await octokit.paginate(
        octokit.rest.search.issuesAndPullRequests,
        {
          q: `org:${owner} repo:${repo} milestone:${GITHUB_RELEASE_NAME}`
        }
      )
      core.info(
        `Found ${issues.length} issue(s) in release ${GITHUB_RELEASE_NAME}`
      )
    } catch (error) {
      core.setFailed(
        `Error retrieving release by tag ${GITHUB_RELEASE_NAME} ${error}`
      )
      return
    }
    for (let index = 0; index < issues.length; index += 1) {
      const issue = issues[index]
      await checkAndCloseLinkedJira(issue.html_url)
      await new Promise((r) => setTimeout(r, 1000)) // sleep to avoid rate limit
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
