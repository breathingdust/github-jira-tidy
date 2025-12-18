import * as core from '@actions/core';
import { Octokit } from '@octokit/action';
import fetch from 'node-fetch';

const JIRA_HOST = core.getInput('jira_host');
const JIRA_USERNAME = core.getInput('jira_username');
const JIRA_PASSWORD = core.getInput('jira_password');
const JIRA_JQL_FILTER = core.getInput('jira_jql_filter');
const JIRA_GITHUB_URL_FIELD_ID = core.getInput('jira_github_url_field_id');

async function getTransitionForProject(fields) {
  if (fields.project.key === 'FRB') {
    return 51
  }
  return 5
}

async function request(url, body, method = 'GET') {
  const query = `https://${JIRA_HOST}/rest/api/3/${url}`;
  return fetch(query, {
    method: method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${JIRA_USERNAME}:${JIRA_PASSWORD}`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
    .then((response) => {
      if (response.status === 204) {
        return {}
      }
      return response.json()
    })
    .catch((err) => {
      core.info(`Error fetching Jira API: ${err} ${JSON.stringify(err)}`);
    })
}

async function findByIssue(issueUrl) {
  core.info(`Searching for jira issues linked to ${issueUrl}`);
  const query = encodeURIComponent(
    `${JIRA_JQL_FILTER} AND "${JIRA_GITHUB_URL_FIELD_ID}" = "${issueUrl}"`
  );
  const r = await request(`search/jql?jql=${query}&fields=project`);
  return r.issues
}

async function transition(issue, commentBody) {
  const transitionId = await getTransitionForProject(issue.fields);
  core.info(`Transitioning jira task ${issue.key} to status ${transitionId}.`);

  const transitionObject = {
    update: {
      comment: [
        {
          add: {
            body: commentBody
          }
        }
      ]
    },
    transition: {
      id: `${transitionId}`
    },
    fields: {
      resolution: {
        name: 'Done'
      }
    }
  };
  return request(`issue/${issue.id}/transitions`, transitionObject, 'POST')
}

const GITHUB_RELEASE_NAME = core.getInput('github_release_name');

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

async function checkAndCloseLinkedJira(issueUrl) {
  let issue = null;

  try {
    const searchResults = await findByIssue(issueUrl);

    if (searchResults.length > 0) {
      ;[issue] = searchResults;
      core.info(`Jira ${issue.key} found for ${issueUrl}`);
    } else {
      core.info(`No Jira found for ${issueUrl}`);
      return
    }
  } catch (error) {
    core.setFailed(`Error searching jira tasks: ${error}`);
    return
  }

  const commentBody = `(Automated Message) The GitHub issue linked to this Jira has been resolved in [${GITHUB_RELEASE_NAME}|https://github.com/${owner}/${repo}/releases/tag/${GITHUB_RELEASE_NAME}] of ${repo}. 🎉`;

  try {
    await transition(issue, commentBody);
  } catch (error) {
    core.setFailed(`Error transitioning jira task ${issue.id} ${error}`);
  }
}

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    core.info(`Starting job for ${owner} ${repo}.`);

    const octokit = new Octokit();
    let issues = [];

    try {
      issues = await octokit.paginate(
        octokit.rest.search.issuesAndPullRequests,
        {
          q: `org:${owner} repo:${repo} milestone:${GITHUB_RELEASE_NAME}`
        }
      );
      core.info(
        `Found ${issues.length} issue(s) in release ${GITHUB_RELEASE_NAME}`
      );
    } catch (error) {
      core.setFailed(
        `Error retrieving release by tag ${GITHUB_RELEASE_NAME} ${error}`
      );
      return
    }
    for (let index = 0; index < issues.length; index += 1) {
      const issue = issues[index];
      await checkAndCloseLinkedJira(issue.html_url);
      await new Promise((r) => setTimeout(r, 1000)); // sleep to avoid rate limit
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

/**
 * The entrypoint for the action. This file simply imports and runs the action's
 * main logic.
 */

/* istanbul ignore next */
run();
//# sourceMappingURL=index.js.map
