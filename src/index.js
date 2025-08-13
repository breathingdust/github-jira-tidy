const core = require('@actions/core');
const { Octokit } = require('@octokit/action');
const JiraApi = require('jira-client');

const JIRA_HOST = core.getInput('jira_host');
const JIRA_USERNAME = core.getInput('jira_username');
const JIRA_PASSWORD = core.getInput('jira_password');
const JIRA_JQL_FILTER = core.getInput('jira_jql_filter');
const JIRA_GITHUB_URL_FIELD_ID = core.getInput('jira_github_url_field_id');
const GITHUB_RELEASE_NAME = core.getInput('github_release_name');

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

async function getTransitionForProject(fields) {
  if (fields.project.key === "FRB") {
    return 51;
  }
  return 5
}

async function checkAndCloseLinkedJira(jira, issueUrl) {
  const query = `${JIRA_JQL_FILTER} AND ${JIRA_GITHUB_URL_FIELD_ID} = "${issueUrl}"`;

  let issue = null;

  try {
    const searchResults = await jira.searchJira(query);

    if (searchResults.issues.length > 0) {
      [issue] = searchResults.issues;
      core.info(`Jira ${issue.key} found for ${issueUrl}`);
    } else {
      core.info(`No Jira found for ${issueUrl}`);
      return;
    }
  } catch (error) {
    core.setFailed(`Error searching jira tasks by ${query} ${error}`);
    return;
  }

  const transitionId = await getTransitionForProject(issue.fields);

  const commentBody = `(Automated Message) The GitHub issue linked to this Jira has been resolved in [${GITHUB_RELEASE_NAME}|https://github.com/${owner}/${repo}/releases/tag/${GITHUB_RELEASE_NAME}] of ${repo}. 🎉`;

  const transitionObject = {
    update: {
      comment: [
        {
          add: {
            body: commentBody,
          },
        },
      ],
    },
    transition: {
      id: `${transitionId}`,
    },
    fields: {
      resolution: {
        name: 'Done',
      },
    },
  };

  try {
    core.info(`Transitioning jira task ${issue.id} to status ${transitionId}.`);
    await jira.transitionIssue(issue.id, transitionObject);
  } catch (error) {
    core.setFailed(
      `Error transitioning jira task ${issue.id} to status ${transitionId} ${error}`,
    );
  }
}

async function main() {
  core.info(`Starting job for ${owner} ${repo}.`);

  const jira = new JiraApi({
    protocol: 'https',
    host: JIRA_HOST,
    username: JIRA_USERNAME,
    password: JIRA_PASSWORD,
    apiVersion: '2',
    strictSSL: true,
  });

  const octokit = new Octokit();
  let issues = [];

  try {
    issues = await octokit.paginate(octokit.rest.search.issues, {
      q: `org:${owner} repo:${repo} milestone:${GITHUB_RELEASE_NAME}`,
    });
    core.info(
      `Found ${issues.length} issue(s) in release ${GITHUB_RELEASE_NAME}`,
    );
  } catch (error) {
    core.setFailed(
      `Error retrieving release by tag ${GITHUB_RELEASE_NAME} ${error}`,
    );
  }
  for (let index = 0; index < issues.length; index += 1) {
    const issue = issues[index];
    await checkAndCloseLinkedJira(jira, issue.html_url);
    await new Promise((r) => setTimeout(r, 1000)); // sleep to avoid rate limit
  }
}

try {
  main();
} catch (error) {
  core.setFailed(error);
}
