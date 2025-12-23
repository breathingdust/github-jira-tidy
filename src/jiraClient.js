import fetch from 'node-fetch'
import * as core from '@actions/core'

const JIRA_HOST = core.getInput('jira_host')
const JIRA_USERNAME = core.getInput('jira_username')
const JIRA_PASSWORD = core.getInput('jira_password')
const JIRA_JQL_FILTER = core.getInput('jira_jql_filter')
const JIRA_GITHUB_URL_FIELD_ID = core.getInput('jira_github_url_field_id')

async function getTransitionForProject(fields) {
  if (fields.project.key === 'FRB') {
    return 51
  }
  return 5
}

async function request(apiVersion, url, body, method = 'GET') {
  const query = `https://${JIRA_HOST}/rest/api/${apiVersion}/${url}`
  return fetch(query, {
    method: method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${JIRA_USERNAME}:${JIRA_PASSWORD}`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(async (response) => {
    if (response.status === 204) {
      return {}
    }
    if (response.ok) {
      return response.json()
    }
    const responseBody = await response.text()
    throw new Error(`${response.status} ${responseBody}`)
  })
}

async function findByIssue(issueUrl) {
  core.info(`Searching for jira issues linked to ${issueUrl}`)
  const query = encodeURIComponent(
    `${JIRA_JQL_FILTER} AND "${JIRA_GITHUB_URL_FIELD_ID}" = "${issueUrl}"`
  )
  const r = await request(3, `search/jql?jql=${query}&fields=project`)
  return r.issues
}

async function transition(issue, commentBody) {
  const transitionId = await getTransitionForProject(issue.fields)
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
  }
  core.info(`${JSON.stringify(transitionObject)}.`)

  return request(2, `issue/${issue.key}/transitions`, transitionObject, 'POST')
}

export { findByIssue, transition }
