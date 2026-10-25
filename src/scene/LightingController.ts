import * as THREE from 'three'

export function createCinematicLighting(scene: THREE.Scene) {
  const ambient = new THREE.HemisphereLight('#e6efff', '#211c28', 0.95)
  const key = new THREE.DirectionalLight('#fff0d8', 3.6)
  key.position.set(1, 8, 5)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 })
  key.shadow.normalBias = 0.04
  const rim = new THREE.DirectionalLight('#83a6d1', 4)
  rim.position.set(-3, 5, -4)
  scene.add(ambient, key, rim)
  return {
    key,
    update(seconds: number, pulse: number, reduced: boolean) {
      rim.intensity = 4 + pulse * 5
      key.intensity = 3.6 + pulse * 0.7
      ambient.intensity = 0.95 - pulse * 0.2
      rim.position.x = -3 + (reduced ? 0 : Math.sin(seconds * 0.15) * 0.3)
    },
  }
}

/** Tiny deterministic uncompressed texture: 16 KiB, repeated as subtle paper grain. */
export function createPaperGrain(): THREE.DataTexture {
  const data = new Uint8Array(64 * 64 * 4)
  let seed = 1743
  for (let index = 0; index < data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const value = 220 + (seed % 36)
    data[index] = data[index + 1] = data[index + 2] = value
    data[index + 3] = 255
  }
  const texture = new THREE.DataTexture(data, 64, 64)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(12, 12)
  texture.needsUpdate = true
  return texture
}
