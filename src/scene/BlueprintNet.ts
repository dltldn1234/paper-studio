import * as THREE from 'three'

/** Dimension guides and a small drafting light, derived from the model's bounds. */
export function createBlueprintNet(bounds: THREE.Box3) {
  const group = new THREE.Group()
  const points: THREE.Vector3[] = []
  const min = bounds.min.x,
    max = bounds.max.x,
    z = bounds.max.z + 1.3
  const line = (ax: number, az: number, bx: number, bz: number) => {
    points.push(
      new THREE.Vector3(ax, 0.025, az),
      new THREE.Vector3(bx, 0.025, bz),
    )
  }
  line(min, z, max, z)
  for (const x of [min, max]) {
    line(x, z - 0.18, x, z + 0.18)
    line(x, bounds.max.z + 0.3, x, z + 0.4)
  }
  for (let x = min; x < max; x += 0.5) line(x, z - 0.04, x, z + 0.04)
  const material = new THREE.LineBasicMaterial({
    color: '#72abff',
    transparent: true,
    opacity: 0.5,
  })
  const guides = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    material,
  )
  group.add(guides)
  const tracer = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#b7d5ff' }),
  )
  group.add(tracer)
  return {
    group,
    update(progress: number, reveal: number) {
      guides.geometry.setDrawRange(
        0,
        Math.floor((points.length * progress) / 2) * 2,
      )
      material.opacity = 0.5 - reveal * 0.3
      tracer.position.set(THREE.MathUtils.lerp(min, max, progress), 0.03, z)
      tracer.visible = progress < 1
    },
  }
}
