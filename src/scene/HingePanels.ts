import * as THREE from 'three'

interface Panel {
  vertices: THREE.Vector3[]
  normal: THREE.Vector3
  origin: THREE.Vector3
  axis: THREE.Vector3
  angle: number
  depth: number
  parent: number
  matrix: THREE.Matrix4
}

/** A cut spanning tree of adjacent triangles. Every moving face rotates on a real edge. */
export class HingePanels {
  readonly geometry: THREE.BufferGeometry
  readonly panels: Panel[] = []
  private readonly order: number[] = []
  private readonly rootAlignment = new THREE.Quaternion()
  private readonly local = new THREE.Matrix4()
  private readonly rotation = new THREE.Quaternion()
  private readonly point = new THREE.Vector3()
  private readonly scale = new THREE.Vector3(1, 1, 1)

  constructor(source: THREE.BufferGeometry) {
    const positions = source.getAttribute('position')
    const indices = source.getIndex()
    if (!indices || indices.count === 0)
      throw new Error('Hinge panels require indexed triangles')
    const edges = new Map<string, { face: number; a: number; b: number }[]>()
    for (let face = 0; face < indices.count / 3; face++) {
      const ids = [0, 1, 2].map((i) => indices.getX(face * 3 + i))
      const vertices = ids.map((id) =>
        new THREE.Vector3().fromBufferAttribute(positions, id),
      )
      const normal = new THREE.Vector3()
        .subVectors(vertices[1], vertices[0])
        .cross(new THREE.Vector3().subVectors(vertices[2], vertices[0]))
        .normalize()
      this.panels.push({
        vertices,
        normal,
        origin: new THREE.Vector3(),
        axis: new THREE.Vector3(),
        angle: 0,
        depth: 0,
        parent: -1,
        matrix: new THREE.Matrix4(),
      })
      for (let edge = 0; edge < 3; edge++) {
        const a = ids[edge],
          b = ids[(edge + 1) % 3]
        const key = [a, b].sort((x, y) => x - y).join(':')
        const entries = edges.get(key) ?? []
        entries.push({ face, a, b })
        edges.set(key, entries)
      }
    }
    const adjacent = this.panels.map(
      () => [] as { face: number; a: number; b: number }[],
    )
    for (const entries of edges.values()) {
      if (entries.length !== 2) continue
      adjacent[entries[0].face].push(entries[1])
      adjacent[entries[1].face].push(entries[0])
    }
    const root = this.panels[0]
    root.origin
      .copy(root.vertices[0])
      .add(root.vertices[1])
      .add(root.vertices[2])
      .multiplyScalar(1 / 3)
    this.rootAlignment.setFromUnitVectors(
      root.normal,
      new THREE.Vector3(0, 1, 0),
    )
    const visited = new Set([0])
    this.order.push(0)
    for (let cursor = 0; cursor < this.order.length; cursor++) {
      const parentId = this.order[cursor]
      for (const edge of adjacent[parentId]) {
        if (visited.has(edge.face)) continue
        visited.add(edge.face)
        const panel = this.panels[edge.face]
        const parent = this.panels[parentId]
        const a = new THREE.Vector3().fromBufferAttribute(positions, edge.a)
        const b = new THREE.Vector3().fromBufferAttribute(positions, edge.b)
        panel.origin.copy(a).add(b).multiplyScalar(0.5)
        panel.axis.subVectors(b, a).normalize()
        panel.angle = Math.atan2(
          panel.axis.dot(
            new THREE.Vector3().crossVectors(panel.normal, parent.normal),
          ),
          panel.normal.dot(parent.normal),
        )
        panel.parent = parentId
        panel.depth = parent.depth + 1
        this.order.push(edge.face)
      }
    }
    if (visited.size !== this.panels.length)
      throw new Error('Paper panel adjacency must be connected')
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        new Float32Array(indices.count * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    )
    this.update(0)
  }

  update(unfold: number): void {
    const amount = Math.max(0, Math.min(1, unfold))
    const output = this.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute
    for (const id of this.order) {
      const panel = this.panels[id]
      if (panel.parent === -1) {
        this.rotation.identity().slerp(this.rootAlignment, amount)
        panel.matrix.compose(panel.origin, this.rotation, this.scale)
      } else {
        const parent = this.panels[panel.parent]
        this.point.subVectors(panel.origin, parent.origin)
        this.rotation.setFromAxisAngle(panel.axis, panel.angle * amount)
        this.local.compose(this.point, this.rotation, this.scale)
        panel.matrix.multiplyMatrices(parent.matrix, this.local)
      }
      for (let vertex = 0; vertex < 3; vertex++) {
        this.point
          .copy(panel.vertices[vertex])
          .sub(panel.origin)
          .applyMatrix4(panel.matrix)
        output.setXYZ(id * 3 + vertex, this.point.x, this.point.y, this.point.z)
      }
    }
    output.needsUpdate = true
    this.geometry.computeVertexNormals()
    this.geometry.computeBoundingSphere()
  }
}
