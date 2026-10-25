import { expect, it } from 'vitest'
import { DeviceQuality } from './DeviceQuality'

it('selects conservative initial quality and downgrades sustained slow rendering', () => {
  expect(new DeviceQuality(2, false).quality).toBe('low')
  expect(new DeviceQuality(12, true).quality).toBe('low')
  expect(new DeviceQuality(12, false, true).quality).toBe('low')
  const quality = new DeviceQuality(12, false)
  for (let i = 0; i < 90; i++) quality.observe(1 / 60)
  expect(quality.quality).toBe('high')
  for (let i = 0; i < 89; i++) expect(quality.observe(1 / 25)).toBe(false)
  expect(quality.observe(1 / 25)).toBe(true)
  for (let i = 0; i < 180; i++) quality.observe(1 / 60)
  expect(quality.quality).toBe('low')
})
