import { describe, expect, it } from 'vitest'
import { validateMergeGate } from './merge-gate.mjs'

const head = 'abc123'
const pullRequest = {
  state: 'OPEN',
  baseRefName: 'main',
  mergeable: 'MERGEABLE',
  headRefOid: head,
}
const checkRuns = [
  {
    name: 'verify',
    head_sha: head,
    status: 'completed',
    conclusion: 'success',
  },
]

function evaluate(overrides = {}) {
  return validateMergeGate({
    pullRequest,
    refreshedPullRequest: pullRequest,
    checkRuns,
    statusContexts: [],
    ...overrides,
  })
}

describe('latest-HEAD merge gate', () => {
  it('allows only a mergeable main PR whose latest checks all succeeded', () => {
    expect(evaluate()).toMatchObject({
      allowed: true,
      headSha: head,
      checkCount: 1,
    })
  })

  it.each(['queued', 'in_progress', 'waiting'])(
    'blocks a %s check',
    (status) => {
      const result = evaluate({
        checkRuns: [{ ...checkRuns[0], status, conclusion: null }],
      })
      expect(result.allowed).toBe(false)
      expect(result.failures.join(' ')).toContain(status)
    },
  )

  it.each(['failure', 'cancelled', 'timed_out', 'skipped'])(
    'blocks a %s conclusion',
    (conclusion) => {
      const result = evaluate({
        checkRuns: [{ ...checkRuns[0], conclusion }],
      })
      expect(result.allowed).toBe(false)
      expect(result.failures.join(' ')).toContain(conclusion)
    },
  )

  it('blocks an absent check suite or checks attached to another SHA', () => {
    expect(evaluate({ checkRuns: [] }).allowed).toBe(false)
    expect(
      evaluate({ checkRuns: [{ ...checkRuns[0], head_sha: 'old-sha' }] })
        .allowed,
    ).toBe(false)
  })

  it('blocks a PR head that changes before the merge request', () => {
    const result = evaluate({
      refreshedPullRequest: { ...pullRequest, headRefOid: 'new-sha' },
    })
    expect(result.allowed).toBe(false)
    expect(result.failures.join(' ')).toContain('HEAD changed')
  })

  it('blocks failed legacy status contexts and non-mergeable PRs', () => {
    expect(
      evaluate({
        statusContexts: [{ context: 'legacy-ci', sha: head, state: 'pending' }],
      }).allowed,
    ).toBe(false)
    expect(
      evaluate({ pullRequest: { ...pullRequest, mergeable: 'CONFLICTING' } })
        .allowed,
    ).toBe(false)
  })
})
