# GitHub Jira Tidy

This is a simple GitHub action to help close Jira issues associated to a GitHub issue based on a custom field. This is based on the contents of a release with an equivalently named milestone. When matched, the action will transition the issue to a specified status with a resolution of 'Done' and comment as to which release the issue was closed in.

## General Usage

See [action.yml](action.yml)

```yaml
on:
  workflow_dispatch:
    inputs:
      release-tag:
        type: string
        description: 'Semver release tag e.g. v1.1.0'
        required: true

  tidy-jira:
    needs: [on-success-or-workflow-dispatch]
    runs-on: ubuntu-latest
    steps:
      - name: Tidy Jira
        uses: breathingdust/github-jira-tidy@cfe2e142858405dad815f5d1e015e625a17ea057 # v0.9.2
        with:
          jira_host: 'foocorp.atlassian.net'
          jira_username: 'dave@foocorp.com'
          jira_password: ${{ secrets.jira_password }}
          jira_jql_filter: 'project in ("FOO","BAR") and "Team" = "beans"'
          jira_closed_id: '371'
          jira_github_url_field_id: 'cf[10101]'
          github_release_name: ${{ needs.on-success-or-workflow-dispatch.outputs.release-tag }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
