import { expect, it, vi } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { disposeScene } from './disposeScene'

it('releases nested shared geometry, materials and textures exactly once', () => {
  const geometry = new BoxGeometry()
  const texture = new Texture()
  const material = new MeshStandardMaterial({ map: texture })
  const scene = new Group()
  const nested = new Group()
  nested.add(new Mesh(geometry, [material, material]))
  scene.add(new Mesh(geometry, material), nested)
  const disposeGeometry = vi.spyOn(geometry, 'dispose')
  const disposeMaterial = vi.spyOn(material, 'dispose')
  const disposeTexture = vi.spyOn(texture, 'dispose')
  disposeScene(scene)
  disposeScene(scene)
  expect(disposeGeometry).toHaveBeenCalledTimes(1)
  expect(disposeMaterial).toHaveBeenCalledTimes(1)
  expect(disposeTexture).toHaveBeenCalledTimes(1)
  expect(scene.children).toHaveLength(0)
})
