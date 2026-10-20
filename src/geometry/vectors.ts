import type { Point2D, Point3D, Vector2D, Vector3D } from './types'

export const add2D = (left: Vector2D, right: Vector2D): Vector2D => ({
  x: left.x + right.x,
  y: left.y + right.y,
})

export const subtract2D = (left: Point2D, right: Point2D): Vector2D => ({
  x: left.x - right.x,
  y: left.y - right.y,
})

export const dot2D = (left: Vector2D, right: Vector2D): number =>
  left.x * right.x + left.y * right.y

export const length2D = (vector: Vector2D): number =>
  Math.hypot(vector.x, vector.y)

export const normalize2D = (vector: Vector2D): Vector2D => {
  const length = length2D(vector)
  if (length === 0)
    throw new RangeError('Cannot normalize a zero-length vector.')
  return { x: vector.x / length, y: vector.y / length }
}

export const add3D = (left: Vector3D, right: Vector3D): Vector3D => ({
  x: left.x + right.x,
  y: left.y + right.y,
  z: left.z + right.z,
})

export const subtract3D = (left: Point3D, right: Point3D): Vector3D => ({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z,
})

export const scale3D = (vector: Vector3D, scalar: number): Vector3D => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
  z: vector.z * scalar,
})

export const dot3D = (left: Vector3D, right: Vector3D): number =>
  left.x * right.x + left.y * right.y + left.z * right.z

export const cross3D = (left: Vector3D, right: Vector3D): Vector3D => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x,
})

export const length3D = (vector: Vector3D): number =>
  Math.hypot(vector.x, vector.y, vector.z)

export const normalize3D = (vector: Vector3D): Vector3D => {
  const length = length3D(vector)
  if (length === 0)
    throw new RangeError('Cannot normalize a zero-length vector.')
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}
