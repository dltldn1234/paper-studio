import * as THREE from 'three'
import { smoothProgress } from './IntroTimeline'

export function roarImpactFrame(seconds: number, reduced = false) {
  const progress = Math.max(0, Math.min(1, (seconds - 5.94) / 1.55))
  const opacity = reduced
    ? 0
    : smoothProgress(seconds, 5.94, 6.04) *
      (1 - smoothProgress(seconds, 6.2, 7.49))
  return {
    progress,
    opacity,
    visible: !reduced && seconds > 5.94 && seconds < 7.49,
  }
}

/** Ground-pressure wake and mouth-directed air rings. No per-frame particle allocation. */
export function createRoarImpact() {
  const group = new THREE.Group()
  group.name = 'roar-pressure-and-dust'
  group.visible = false
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, progress: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform float opacity; uniform float progress;
      void main(){
        vec2 p=(vUv-.5)*2.; float r=length(p); float angle=atan(p.y,p.x);
        float grain=.65+.2*sin(angle*17.+r*29.)+.15*sin(angle*31.-r*43.);
        float band=1.-smoothstep(.055,.28,abs(r-.72));
        gl_FragColor=vec4(.53,.62,.72,band*grain*opacity*.42);
      }`,
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(-0.1, 0.035, 0)
  group.add(ground)
  const air = new THREE.Group()
  const rings = [0, 1].map(() => {
    const material = new THREE.MeshBasicMaterial({
      color: '#c0d2e4',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 64), material)
    ring.rotation.y = Math.PI / 2
    air.add(ring)
    return ring
  })
  group.add(air)
  const count = 64
  const seeds = new Float32Array(count * 3)
  let seed = 3713
  for (let index = 0; index < seeds.length; index++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    seeds[index] = seed / 4294967296
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3))
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, opacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `uniform float progress; varying float strength;
      void main(){
        float angle=position.x*6.283185;
        float radius=.4+position.y*2.+progress*(2.+position.z*3.);
        vec3 p=vec3(cos(angle)*radius-.1,.09+sin(progress*3.14159)*(.2+position.z*.65),sin(angle)*radius);
        strength=.35+position.z*.65;
        vec4 view=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((170.+position.z*220.)/-view.z,8.,42.);
      }`,
    fragmentShader: `uniform float opacity;varying float strength;
      void main(){float r=length(gl_PointCoord-.5);float a=1.-smoothstep(.02,.5,r);gl_FragColor=vec4(.57,.62,.67,a*a*opacity*strength*.16);}`,
  })
  const dust = new THREE.Points(geometry, dustMaterial)
  dust.frustumCulled = false
  group.add(dust)
  let lowQuality = false
  return {
    group,
    setQuality(low: boolean) {
      lowQuality = low
      geometry.setDrawRange(0, low ? 24 : count)
    },
    update(
      seconds: number,
      reduced: boolean,
      mouth: THREE.Vector3,
      orientation: THREE.Quaternion,
    ) {
      const frame = roarImpactFrame(seconds, reduced)
      group.visible = frame.visible
      if (!frame.visible) return
      ground.scale.setScalar(0.7 + frame.progress * 7.5)
      groundMaterial.uniforms.opacity.value = frame.opacity
      groundMaterial.uniforms.progress.value = frame.progress
      dustMaterial.uniforms.opacity.value = frame.opacity
      dustMaterial.uniforms.progress.value = frame.progress
      air.position.copy(mouth)
      air.quaternion.copy(orientation)
      rings.forEach((ring, index) => {
        const wave = Math.max(0, (seconds - 5.94 - index * 0.24) / 0.8)
        ring.visible = wave > 0 && wave < 1 && (!lowQuality || index === 0)
        ring.position.x = 0.15 + wave * 3.8
        ring.scale.setScalar(0.15 + wave * 1.45)
        ring.material.opacity = Math.sin(Math.min(1, wave) * Math.PI) * 0.24
      })
    },
  }
}
