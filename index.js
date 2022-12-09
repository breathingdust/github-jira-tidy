const core = require('@actions/core');
const { Octokit } = require('@octokit/action');
const JiraApi = require('jira-client');

const JIRA_HOST = core.getInput('jira_host');
const JIRA_USERNAME = core.getInput('jira_username');
const JIRA_PASSWORD = core.getInput('jira_password');
const JIRA_JQL_FILTER = core.getInput('jira_jql_filter');
const JIRA_CLOSED_ID = core.getInput('jira_closed_id');
const JIRA_GITHUB_URL_FIELD_GID = core.getInput('jira_github_url_field_gid');
const GITHUB_RELEASE_NAME = core.getInput('github_release_name');

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

async function checkAndCloseLinkedJira(jira, issueUrl) {
  const query = `${JIRA_JQL_FILTER} AND ${JIRA_GITHUB_URL_FIELD_GID} = "${issueUrl}"`;

  let tasks = [];

  try {
    const searchResults = await jira.searchJira(query);
    tasks = searchResults.issues;

    if (tasks.length > 0) {
      core.info(`Jira ${tasks[0].key} found for ${issueUrl}`);
    } else {
      core.info(`No Jira found for ${issueUrl}`);
    }
  } catch (error) {
    core.setFailed(`Error searching jira tasks by ${JIRA_JQL_FILTER} and ${issueUrl} ${error}`);
    return false;
  }
  const commentBody = `(Automated Message)The GitHub issue linked to this Jira has been resolved in [${GITHUB_RELEASE_NAME}|https://github.com/${owner}/${repo}/releases/tag/${GITHUB_RELEASE_NAME}]  of the provider. 🎉`;

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
      id: `${JIRA_CLOSED_ID}`,
    },
    fields: {
      resolution: {
        name: 'Done',
      },
    },
  };

  try {
    await jira.transitionIssue(tasks[0].id, transitionObject);
  } catch (error) {
    core.setFailed(`Error searching jira tasks by ${JIRA_JQL_FILTER} and ${issueUrl} ${error}`);
    return false;
  }

  return true;
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
    issues = await octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
      q: `user:${owner} repo:${repo} milestone:${GITHUB_RELEASE_NAME}`,
    });
    core.info(`Found ${issues.length} issue(s) in release ${GITHUB_RELEASE_NAME}`);
  } catch (error) {
    core.setFailed(`Error retrieving release by tag ${GITHUB_RELEASE_NAME}`);
  }
  /* eslint-disable */
  for (let index = 0; index < issues.length; index += 1) {
    const issue = issues[index];
    await checkAndCloseLinkedJira(jira, issue.html_url);
    await new Promise(r => setTimeout(r, 1000)); // sleep to avoid rate limit
  }
  /* eslint-disable */  
}

try {
  main();
} catch (error) {
  core.setFailed(error);
}
