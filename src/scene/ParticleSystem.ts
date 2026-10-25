import * as THREE from 'three'

/** Sparse drafting dust: one draw call, positions animated entirely on the GPU. */
export function createPaperAtmosphere(count = 48) {
  const positions = new Float32Array(count * 3)
  let seed = 1927
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let index = 0; index < count; index++) {
    positions[index * 3] = (random() - 0.5) * 13
    positions[index * 3 + 1] = random() * 7
    positions[index * 3 + 2] = (random() - 0.5) * 8
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0.15 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `uniform float time;
      void main() {
        vec3 p = position;
        p.x += sin(time * 0.16 + position.y) * 0.09;
        p.y += sin(time * 0.11 + position.x) * 0.12;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(18.0 / -view.z, 1.0, 2.5);
      }`,
    fragmentShader: `uniform float opacity;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        gl_FragColor = vec4(0.45, 0.67, 1.0, (1.0 - smoothstep(0.12, 0.5, radius)) * opacity);
      }`,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return {
    points,
    update(seconds: number, reduced: boolean) {
      material.uniforms.time.value = reduced ? 0 : seconds
      points.visible = !reduced
    },
    setCount(value: number) {
      geometry.setDrawRange(0, Math.min(count, Math.max(0, value)))
    },
  }
}
