import { expect, it } from 'vitest'
import { cinematicCamera } from './CameraDirector'

it('frames the drafting plane, approaches the roar and settles into the hero', () => {
  expect(cinematicCamera(0, 1.4).targetY).toBe(0.8)
  expect(cinematicCamera(6, 1.4).z).toBeLessThan(cinematicCamera(9, 1.4).z)
  expect(cinematicCamera(9, 1.4).targetY).toBe(2.1)
  expect(cinematicCamera(9, 0.6).z).toBeGreaterThan(cinematicCamera(9, 1.4).z)
  expect(cinematicCamera(0, 1.4, 0, true)).toEqual(
    cinematicCamera(9, 1.4, 90, true),
  )
  for (const boundary of [1.4, 4.4, 5, 5.6, 6.8, 9]) {
    expect(
      Math.abs(
        cinematicCamera(boundary - 0.0001, 1.4).z -
          cinematicCamera(boundary + 0.0001, 1.4).z,
      ),
    ).toBeLessThan(0.001)
  }
})
