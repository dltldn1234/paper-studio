import type { FoldPoint, Quaternion, RigidTransform } from './types'

export const FOLD_EPSILON = 1e-9
export const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 }
export const IDENTITY_TRANSFORM: RigidTransform = {
  rotation: IDENTITY_QUATERNION,
  translation: { x: 0, y: 0, z: 0 },
}

export function add(a: FoldPoint, b: FoldPoint): FoldPoint {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function subtract(a: FoldPoint, b: FoldPoint): FoldPoint {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function scale(point: FoldPoint, amount: number): FoldPoint {
  return { x: point.x * amount, y: point.y * amount, z: point.z * amount }
}

export function dot(a: FoldPoint, b: FoldPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function cross(a: FoldPoint, b: FoldPoint): FoldPoint {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

export function length(point: FoldPoint): number {
  return Math.hypot(point.x, point.y, point.z)
}

export function normalize(point: FoldPoint): FoldPoint {
  const magnitude = length(point)
  if (magnitude <= FOLD_EPSILON)
    throw new RangeError('Cannot normalize a zero vector.')
  return scale(point, 1 / magnitude)
}

export function quaternionFromAxisAngle(
  axis: FoldPoint,
  angle: number,
): Quaternion {
  const unitAxis = normalize(axis)
  const halfAngle = angle / 2
  const sine = Math.sin(halfAngle)
  return {
    x: unitAxis.x * sine,
    y: unitAxis.y * sine,
    z: unitAxis.z * sine,
    w: Math.cos(halfAngle),
  }
}

export function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

export function inverseQuaternion(rotation: Quaternion): Quaternion {
  return { x: -rotation.x, y: -rotation.y, z: -rotation.z, w: rotation.w }
}

export function quaternionFromBasis(
  xAxis: FoldPoint,
  yAxis: FoldPoint,
  zAxis: FoldPoint,
): Quaternion {
  // Basis vectors are the columns of the rotation matrix.
  const m00 = xAxis.x,
    m01 = yAxis.x,
    m02 = zAxis.x
  const m10 = xAxis.y,
    m11 = yAxis.y,
    m12 = zAxis.y
  const m20 = xAxis.z,
    m21 = yAxis.z,
    m22 = zAxis.z
  const trace = m00 + m11 + m22
  let q: Quaternion
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2
    q = {
      w: 0.25 * s,
      x: (m21 - m12) / s,
      y: (m02 - m20) / s,
      z: (m10 - m01) / s,
    }
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    q = {
      w: (m21 - m12) / s,
      x: 0.25 * s,
      y: (m01 + m10) / s,
      z: (m02 + m20) / s,
    }
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    q = {
      w: (m02 - m20) / s,
      x: (m01 + m10) / s,
      y: 0.25 * s,
      z: (m12 + m21) / s,
    }
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    q = {
      w: (m10 - m01) / s,
      x: (m02 + m20) / s,
      y: (m12 + m21) / s,
      z: 0.25 * s,
    }
  }
  const magnitude = Math.hypot(q.x, q.y, q.z, q.w)
  return {
    x: q.x / magnitude,
    y: q.y / magnitude,
    z: q.z / magnitude,
    w: q.w / magnitude,
  }
}

export function rotatePoint(rotation: Quaternion, point: FoldPoint): FoldPoint {
  const vector = { x: rotation.x, y: rotation.y, z: rotation.z }
  const twiceCross = scale(cross(vector, point), 2)
  return add(
    point,
    add(scale(twiceCross, rotation.w), cross(vector, twiceCross)),
  )
}

export function transformPoint(
  transform: RigidTransform,
  point: FoldPoint,
): FoldPoint {
  return add(rotatePoint(transform.rotation, point), transform.translation)
}

export function composeTransforms(
  a: RigidTransform,
  b: RigidTransform,
): RigidTransform {
  return {
    rotation: multiplyQuaternions(a.rotation, b.rotation),
    translation: transformPoint(a, b.translation),
  }
}

export function rotationMatrix(rotation: Quaternion): readonly number[] {
  const { x, y, z, w } = rotation
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ]
}
