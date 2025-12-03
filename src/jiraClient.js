const fetch = require('node-fetch').default;

const core = require('@actions/core');

const JIRA_HOST = core.getInput('jira_host');
const JIRA_USERNAME = core.getInput('jira_username');
const JIRA_PASSWORD = core.getInput('jira_password');
const JIRA_JQL_FILTER = core.getInput('jira_jql_filter');
const JIRA_GITHUB_URL_FIELD_ID = core.getInput('jira_github_url_field_id');

async function getTransitionForProject(fields) {
  if (fields.project.key === 'FRB') {
    return 51;
  }
  return 5;
}

async function request(url, body, method = 'GET') {
  const query = `https://${JIRA_HOST}/rest/api/3/${url}`;
  return fetch(query, {
    method: method,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${JIRA_USERNAME}:${JIRA_PASSWORD}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
  })
    .then((response) => {
      if (response.status === 204) {
        return {};
      }
      return response.json();
    })
    .catch((err) => {
      core.info(`Error fetching Jira API: ${err} ${JSON.stringify(err)}`);
    });
}

async function findByIssue(issueUrl) {
  core.info(`Searching for jira issues linked to ${issueUrl}`);
  const query = encodeURIComponent(
    `${JIRA_JQL_FILTER} AND ${JIRA_GITHUB_URL_FIELD_ID} = "${issueUrl}"`,
  );
  const r = await request(`search/jql?jql=${query}&fields=project`);
  return r.issues;
}

async function transition(issue, commentBody) {
  const transitionId = await getTransitionForProject(issue.fields);
  core.info(`Transitioning jira task ${issue.key} to status ${transitionId}.`);

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
  return request(`issue/${issue.id}/transitions`, transitionObject, 'POST');
}

module.exports = {
  findByIssue,
  transition,
};
