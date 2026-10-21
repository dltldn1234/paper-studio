export function validateMergeGate({
  pullRequest,
  refreshedPullRequest,
  checkRuns,
  statusContexts,
}) {
  const failures = []
  if (pullRequest.state !== 'OPEN') failures.push('Pull request is not open.')
  if (pullRequest.baseRefName !== 'main') {
    failures.push('Pull request base is not main.')
  }
  if (pullRequest.mergeable !== 'MERGEABLE') {
    failures.push(`Pull request is not mergeable (${pullRequest.mergeable}).`)
  }
  if (
    !pullRequest.headRefOid ||
    refreshedPullRequest.headRefOid !== pullRequest.headRefOid
  ) {
    failures.push(
      'Pull request HEAD changed while its checks were being verified.',
    )
  }
  if (refreshedPullRequest.state !== 'OPEN') {
    failures.push('Pull request stopped being open during verification.')
  }
  if (checkRuns.length === 0)
    failures.push('No check runs exist for the latest HEAD.')

  for (const check of checkRuns) {
    if (check.head_sha !== pullRequest.headRefOid) {
      failures.push(`${check.name} belongs to a different HEAD SHA.`)
      continue
    }
    if (check.status !== 'completed') {
      failures.push(`${check.name} is ${check.status}, not completed.`)
      continue
    }
    if (check.conclusion !== 'success') {
      failures.push(
        `${check.name} concluded ${check.conclusion ?? 'without success'}.`,
      )
    }
  }

  for (const status of statusContexts) {
    if (status.sha && status.sha !== pullRequest.headRefOid) {
      failures.push(`${status.context} belongs to a different HEAD SHA.`)
    } else if (status.state !== 'success') {
      failures.push(`${status.context} status is ${status.state}, not success.`)
    }
  }

  if (failures.length > 0) {
    return { allowed: false, headSha: pullRequest.headRefOid, failures }
  }
  return {
    allowed: true,
    headSha: pullRequest.headRefOid,
    checkCount: checkRuns.length,
    statusCount: statusContexts.length,
    failures: [],
  }
}
