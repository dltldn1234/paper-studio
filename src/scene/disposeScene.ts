import { BufferGeometry, Light, Material, Object3D, Texture } from 'three'

/** Release resources owned exclusively by this scene, including shared edges/maps. */
export function disposeScene(root: Object3D): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (object instanceof Light) {
      const shadow = (object as Light & { shadow?: { dispose(): void } }).shadow
      shadow?.dispose()
    }
    const drawable = object as Object3D & {
      geometry?: BufferGeometry
      material?: Material | Material[]
    }
    if (drawable.geometry) geometries.add(drawable.geometry)
    const owned = drawable.material
    for (const material of owned
      ? Array.isArray(owned)
        ? owned
        : [owned]
      : []) {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value)
      }
    }
  })
  textures.forEach((texture) => texture.dispose())
  materials.forEach((material) => material.dispose())
  geometries.forEach((geometry) => geometry.dispose())
  root.clear()
}
