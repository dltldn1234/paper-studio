import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { validateMergeGate } from './merge-gate.mjs'

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim()
}

function jsonGh(args) {
  return JSON.parse(gh(args))
}

function pagedJson(endpoint) {
  return jsonGh(['api', '--paginate', '--slurp', endpoint])
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const pullRequestNumber = process.argv[2]
if (!/^\d+$/.test(pullRequestNumber ?? '')) {
  fail('Usage: pnpm merge:checked <pull-request-number>')
}

try {
  const repository = gh([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ])
  const pullRequest = jsonGh([
    'pr',
    'view',
    pullRequestNumber,
    '--json',
    'state,baseRefName,headRefOid,headRefName,mergeable',
  ])
  const runPages = pagedJson(
    `repos/${repository}/commits/${pullRequest.headRefOid}/check-runs?per_page=100`,
  )
  const statusPages = pagedJson(
    `repos/${repository}/commits/${pullRequest.headRefOid}/status?per_page=100`,
  )
  const checkRuns = runPages.flatMap((page) => page.check_runs ?? [])
  const statusContexts = statusPages.flatMap((page) => page.statuses ?? [])
  if (
    runPages.some((page) => page.total_count !== checkRuns.length) ||
    statusPages.some((page) => page.total_count !== statusContexts.length)
  ) {
    fail(
      'GitHub returned an incomplete paginated status response; refusing to merge.',
    )
  }
  const refreshedPullRequest = jsonGh([
    'pr',
    'view',
    pullRequestNumber,
    '--json',
    'state,headRefOid',
  ])
  const decision = validateMergeGate({
    pullRequest,
    refreshedPullRequest,
    checkRuns,
    statusContexts,
  })
  if (!decision.allowed) {
    fail(
      `Merge blocked for PR #${pullRequestNumber}:\n- ${decision.failures.join('\n- ')}`,
    )
  }

  process.stdout.write(
    `Verified ${decision.checkCount} check run(s) and ${decision.statusCount} status context(s) on ${decision.headSha}. Creating a normal merge commit.\n`,
  )
  const mergeResult = jsonGh([
    'api',
    '--method',
    'PUT',
    `repos/${repository}/pulls/${pullRequestNumber}/merge`,
    '-f',
    `sha=${decision.headSha}`,
    '-f',
    'merge_method=merge',
  ])
  if (!mergeResult.merged)
    fail(`GitHub did not merge the pull request: ${mergeResult.message}`)
  process.stdout.write(
    `Merged PR #${pullRequestNumber} at ${mergeResult.sha}.\n`,
  )

  try {
    gh([
      'api',
      '--method',
      'DELETE',
      `repos/${repository}/git/refs/heads/${encodeURIComponent(pullRequest.headRefName)}`,
    ])
    process.stdout.write(`Deleted head branch ${pullRequest.headRefName}.\n`)
  } catch {
    process.stdout.write(
      `Head branch ${pullRequest.headRefName} was already deleted or could not be deleted.\n`,
    )
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  fail(`Checked merge failed closed: ${message}`)
}
