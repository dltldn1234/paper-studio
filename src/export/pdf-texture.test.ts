import { describe, expect, it, vi } from 'vitest'
import { preparePdfTexture } from './pdf-texture'

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
const tinyWebp = 'data:image/webp;base64,AA=='

describe('PDF texture preparation', () => {
  it.each(['png', 'jpeg'] as const)(
    'preserves existing %s bytes without changing the source asset',
    async (format) => {
      const dataUrl =
        format === 'png' ? tinyPng : tinyPng.replace('png', 'jpeg')
      const rasterize = vi.fn()
      const prepared = await preparePdfTexture(dataUrl, rasterize)
      expect(prepared.mime).toBe(format)
      expect(rasterize).not.toHaveBeenCalled()
    },
  )

  it('converts WebP to transparent-capable PNG bytes in memory', async () => {
    const rasterize = vi.fn(async () => ({
      pngDataUrl: tinyPng,
      width: 2,
      height: 3,
    }))
    const prepared = await preparePdfTexture(tinyWebp, rasterize)
    expect(prepared.mime).toBe('png')
    expect(prepared.bytes).toBeInstanceOf(Uint8Array)
    expect(rasterize).toHaveBeenCalledWith(tinyWebp)
  })

  it('rejects decoded images beyond the pixel limit', async () => {
    await expect(
      preparePdfTexture(tinyWebp, async () => ({
        pngDataUrl: tinyPng,
        width: 4096,
        height: 4097,
      })),
    ).rejects.toThrow('dimensions exceed')
  })

  it('surfaces malformed source and failed browser conversion errors', async () => {
    await expect(
      preparePdfTexture('data:image/webp;base64,%%%'),
    ).rejects.toThrow('supported base64 image')
    await expect(
      preparePdfTexture(tinyWebp, async () => {
        throw new Error('decoder failed')
      }),
    ).rejects.toThrow('decoder failed')
  })
})
