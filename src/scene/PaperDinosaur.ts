import * as THREE from 'three'
import { paperLoft, type PaperSection } from './dinosaurGeometry'

export interface PaperDinosaur {
  root: THREE.Group
  body: THREE.Group
  neck: THREE.Group
  head: THREE.Group
  jaw: THREE.Group
  mouth: THREE.Group
  tail: THREE.Group
  arms: THREE.Group[]
  legs: THREE.Group[]
  panels: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]
}

/** Original procedural model, authored in project units; no external model assets. */
export function createPaperDinosaur(
  detail: 'low' | 'high' = 'high',
): PaperDinosaur {
  const root = new THREE.Group()
  root.name = 'paper-tyrannosaurus'
  const panels: PaperDinosaur['panels'] = []
  const paper = new THREE.MeshStandardMaterial({
    color: '#e6e1d3',
    roughness: 0.88,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  })
  const crease = new THREE.LineBasicMaterial({
    color: '#645f58',
    transparent: true,
    opacity: 0.2,
  })
  const sides = detail === 'high' ? 10 : 6
  const joint = (
    parent: THREE.Group,
    name: string,
    x: number,
    y: number,
    z = 0,
  ) => {
    const group = new THREE.Group()
    group.name = name
    group.position.set(x, y, z)
    parent.add(group)
    return group
  }
  const shell = (
    parent: THREE.Group,
    name: string,
    sections: PaperSection[],
    count = sides,
  ) => {
    const geometry = paperLoft(sections, count)
    const mesh = new THREE.Mesh(geometry, paper)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 9),
      crease,
    )
    mesh.add(edges)
    parent.add(mesh)
    panels.push(mesh)
    return mesh
  }
  const body = joint(root, 'body-pivot', 0, 2.45)
  shell(body, 'ribcage', [
    { x: -1.45, y: 0.15, height: 0.6, width: 0.5 },
    { x: -0.8, y: 0.1, height: 1.45, width: 1.3 },
    { x: 0, height: 1.8, width: 1.52 },
    { x: 0.8, y: 0.12, height: 1.4, width: 1.05 },
    { x: 1.2, y: 0.33, height: 0.7, width: 0.56 },
  ])
  const tail = joint(body, 'tail-pivot', -1.2, 0.2)
  shell(
    tail,
    'counterbalance-tail',
    [
      { x: -3.65, y: 0.75, height: 0.04, width: 0.035 },
      { x: -2.7, y: 0.58, height: 0.15, width: 0.16 },
      { x: -1.5, y: 0.28, height: 0.34, width: 0.35 },
      { x: -0.5, y: 0.05, height: 0.65, width: 0.68 },
      { x: 0.15, height: 0.74, width: 0.72 },
    ],
    6,
  )
  const neck = joint(body, 'neck-pivot', 0.85, 0.4)
  shell(neck, 'neck', [
    { x: 0, height: 0.96, width: 0.76 },
    { x: 0.4, y: 0.48, height: 0.9, width: 0.76 },
    { x: 0.85, y: 0.8, height: 0.67, width: 0.7 },
  ])
  const head = joint(neck, 'skull-pivot', 0.72, 0.8)
  shell(head, 'skull', [
    { x: -0.2, y: 0.1, height: 0.94, width: 0.92 },
    { x: 0.3, y: 0.14, height: 1.12, width: 1.12 },
    { x: 0.9, y: 0.1, height: 0.76, width: 0.88 },
    { x: 1.53, y: 0.04, height: 0.62, width: 0.76 },
    { x: 1.66, y: -0.03, height: 0.44, width: 0.62 },
  ])
  const jaw = joint(head, 'jaw-hinge', -0.02, -0.32)
  shell(
    jaw,
    'lower-jaw',
    [
      { x: 0, y: -0.03, height: 0.38, width: 0.78 },
      { x: 0.8, y: -0.08, height: 0.3, width: 0.7 },
      { x: 1.51, y: -0.01, height: 0.24, width: 0.58 },
    ],
    6,
  )
  const dark = new THREE.MeshStandardMaterial({
    color: '#151921',
    roughness: 0.6,
    flatShading: true,
  })
  const mouth = joint(head, 'roar-origin', 1.5, -0.3)
  const cavity = new THREE.Mesh(
    paperLoft(
      [
        { x: 0.16, y: 0.04, height: 0.11, width: 0.57 },
        { x: 0.8, y: 0.02, height: 0.1, width: 0.55 },
        { x: 1.48, height: 0.07, width: 0.43 },
      ],
      6,
    ),
    dark,
  )
  jaw.add(cavity)
  const palate = cavity.clone()
  palate.position.y = -0.36
  head.add(palate)
  for (const sign of [-1, 1]) {
    const brow = shell(
      head,
      'orbital-brow',
      [
        { x: 0.05, y: 0.48, z: sign * 0.46, height: 0.18, width: 0.15 },
        { x: 0.48, y: 0.42, z: sign * 0.51, height: 0.15, width: 0.17 },
        { x: 0.66, y: 0.32, z: sign * 0.46, height: 0.08, width: 0.08 },
      ],
      4,
    )
    brow.castShadow = true
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), dark)
    eye.position.set(0.31, 0.32, sign * 0.535)
    eye.scale.set(1.1, 0.6, 0.35)
    head.add(eye)
    const nostril = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), dark)
    nostril.position.set(1.46, 0.09, sign * 0.35)
    head.add(nostril)
    for (let tooth = 0; tooth < 9; tooth++) {
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.038, 0.14 + (tooth % 3) * 0.025, 4),
        paper,
      )
      mesh.position.set(
        0.3 + tooth * 0.145,
        -0.29,
        sign * (0.36 - tooth * 0.012),
      )
      mesh.rotation.z = Math.PI
      head.add(mesh)
      const lowerTooth = mesh.clone()
      lowerTooth.geometry = mesh.geometry
      lowerTooth.position.set(
        0.32 + tooth * 0.139,
        0.08,
        sign * (0.31 - tooth * 0.01),
      )
      lowerTooth.scale.setScalar(0.72)
      lowerTooth.rotation.z = 0
      jaw.add(lowerTooth)
    }
  }
  const legs: THREE.Group[] = []
  const arms: THREE.Group[] = []
  for (const sign of [-1, 1]) {
    const leg = joint(root, `hip-${sign}`, -0.35, 2.35, sign * 0.55)
    const thigh = shell(
      leg,
      'haunch',
      [
        { x: 0, height: 1.02, width: 0.88 },
        { x: 0.65, height: 0.86, width: 0.7 },
        { x: 1.18, height: 0.38, width: 0.34 },
      ],
      6,
    )
    thigh.rotation.z = -1.1
    const shin = joint(leg, 'knee', 0.54, -1.05)
    const lower = shell(
      shin,
      'shin',
      [
        { x: 0, height: 0.35, width: 0.3 },
        { x: 0.7, height: 0.21, width: 0.22 },
        { x: 1.1, height: 0.16, width: 0.2 },
      ],
      6,
    )
    lower.rotation.z = -1.87
    const foot = joint(shin, 'ankle', -0.32, -1.03)
    for (const toe of [-1, 0, 1]) {
      const toeMesh = shell(
        foot,
        'toe',
        [
          { x: -0.16, y: -0.08, height: 0.18, width: 0.13 },
          {
            x: 0.4 + (toe === 0 ? 0.12 : 0),
            y: -0.11,
            height: 0.08,
            width: 0.07,
          },
        ],
        4,
      )
      toeMesh.position.z = toe * 0.16
      toeMesh.rotation.y = toe * -0.15
    }
    legs.push(leg)
    const arm = joint(body, `shoulder-${sign}`, 0.89, -0.1, sign * 0.42)
    const upper = shell(
      arm,
      'upper-arm',
      [
        { x: 0, height: 0.2, width: 0.21 },
        { x: 0.42, height: 0.12, width: 0.12 },
      ],
      5,
    )
    upper.rotation.z = -0.8
    const forearm = shell(
      arm,
      'forearm',
      [
        { x: 0, height: 0.13, width: 0.12 },
        { x: 0.34, height: 0.07, width: 0.08 },
      ],
      5,
    )
    forearm.position.set(0.29, -0.3, 0)
    forearm.rotation.z = 0.32
    arms.push(arm)
  }
  root.updateMatrixWorld(true)
  return { root, body, neck, head, jaw, mouth, tail, legs, arms, panels }
}
