import { solveFoldPoses } from '../folding'
import type { FoldGraph } from '../folding'

export type AssemblyStep = {
  index: number
  edgeId: string
  parentFaceId: string
  faceId: string
  angleDegrees: number
}

export type AssemblyGuide = {
  rootFaceId: string
  steps: AssemblyStep[]
  warnings: string[]
  physicallyValidated: false
}

/** Derives stable instructions from the existing validated fold tree. */
export function createAssemblyGuide(graph: FoldGraph): AssemblyGuide {
  try {
    solveFoldPoses(graph, 0)
  } catch (error) {
    throw new RangeError(
      `Assembly guide requires a valid fold graph: ${error instanceof Error ? error.message : 'invalid graph'}`,
    )
  }
  const children = new Map<string, typeof graph.hinges>()
  for (const hinge of graph.hinges) {
    const edges = children.get(hinge.parentFaceId) ?? []
    edges.push(hinge)
    children.set(hinge.parentFaceId, edges)
  }
  const steps: AssemblyStep[] = []
  const visited = new Set([graph.rootFaceId])
  const queue = [graph.rootFaceId]
  while (queue.length) {
    const parentFaceId = queue.shift()!
    for (const hinge of children.get(parentFaceId) ?? []) {
      if (visited.has(hinge.childFaceId)) continue
      visited.add(hinge.childFaceId)
      queue.push(hinge.childFaceId)
      steps.push({
        index: steps.length,
        edgeId: hinge.id,
        parentFaceId,
        faceId: hinge.childFaceId,
        angleDegrees: (hinge.angleRadians * 180) / Math.PI,
      })
    }
  }
  if (visited.size !== graph.faces.length) {
    throw new RangeError('Assembly guide fold graph is disconnected.')
  }
  return {
    rootFaceId: graph.rootFaceId,
    steps,
    warnings: [
      'This guide follows an idealized zero-thickness fold tree. Physical assembly and paper interference have not been validated.',
    ],
    physicallyValidated: false,
  }
}
