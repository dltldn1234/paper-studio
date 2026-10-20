import { render } from '@testing-library/react'
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCuboid } from '../geometry'
import { ThreeCuboidPreview } from './ThreeCuboidPreview'
import { faceIdForMaterialIndex, materialIndexForFaceId } from './face-mapping'

const { rendererDispose, controlsDispose } = vi.hoisted(() => ({
  rendererDispose: vi.fn(),
  controlsDispose: vi.fn(),
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      outputColorSpace = actual.SRGBColorSpace
      setPixelRatio = vi.fn()
      setSize = vi.fn()
      render = vi.fn()
      dispose = rendererDispose
    },
  }
})

vi.mock('three/addons/controls/OrbitControls.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('three/addons/controls/OrbitControls.js')
    >()
  return {
    ...actual,
    OrbitControls: class {
      target = new THREE.Vector3()
      enableDamping = false
      dampingFactor = 0
      enablePan = false
      minDistance = 0
      maxDistance = 0
      update = vi.fn()
      dispose = controlsDispose
    },
  }
})

describe('Three.js face material mapping', () => {
  it.each([
    [0, 'right'],
    [1, 'left'],
    [2, 'top'],
    [3, 'bottom'],
    [4, 'back'],
    [5, 'front'],
  ] as const)('maps material index %i to face %s', (index, faceId) => {
    expect(faceIdForMaterialIndex(index)).toBe(faceId)
  })

  it('returns null for an out-of-range material index', () => {
    expect(faceIdForMaterialIndex(6)).toBeNull()
    expect(faceIdForMaterialIndex(undefined)).toBeNull()
  })

  it('maps face ids to the Three.js box geometry material groups', () => {
    expect(materialIndexForFaceId('front')).toBe(5)
    expect(materialIndexForFaceId('top')).toBe(2)
    expect(materialIndexForFaceId('right')).toBe(0)
  })
})

describe('ThreeCuboidPreview lifecycle', () => {
  beforeEach(() => {
    rendererDispose.mockClear()
    controlsDispose.mockClear()
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn(() => 1),
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('creates a preview canvas and releases renderer and controls on unmount', () => {
    const cuboid = createCuboid({ widthMm: 100, depthMm: 80, heightMm: 60 })
    const { container, unmount } = render(
      <ThreeCuboidPreview
        cuboid={cuboid}
        selectedFaceId={null}
        onFaceSelect={vi.fn()}
      />,
    )

    expect(container.querySelector('canvas')).toHaveAttribute(
      'aria-label',
      'Three.js 직육면체 3D 미리보기',
    )
    unmount()
    expect(rendererDispose).toHaveBeenCalledOnce()
    expect(controlsDispose).toHaveBeenCalledOnce()
    expect(container.querySelector('canvas')).toBeNull()
  })
})
