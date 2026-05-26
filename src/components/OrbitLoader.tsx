import { View } from 'react-native'
import { Canvas, useFrame } from '@react-three/fiber/native'
import { useRef } from 'react'
import * as THREE from 'three'

const ORBIT_RADIUS = 0.8
const SPHERE_SIZE = 0.16
const TRAIL_COUNT = 6
const COLORS = ['#00A86B', '#FFD700', '#3A75C4']
const SPEEDS = [0.7, 0.85, 1.0]

function OrbitingSphere({ color, offset, speed }: { color: string; offset: number; speed: number }) {
  const sphereRef = useRef<THREE.Mesh>(null)
  const trailRefs = useRef<(THREE.Mesh | null)[]>([])
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta
    const t = timeRef.current * speed + offset
    const x = Math.cos(t) * ORBIT_RADIUS
    const z = Math.sin(t) * ORBIT_RADIUS
    const y = Math.sin(t * 0.7) * 0.25

    if (sphereRef.current) {
      sphereRef.current.position.set(x, y, z)
    }

    trailRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const delay = (i + 1) * 0.12
      const tx = Math.cos(t - delay) * ORBIT_RADIUS
      const tz = Math.sin(t - delay) * ORBIT_RADIUS
      const ty = Math.sin((t - delay) * 0.7) * 0.25
      mesh.position.set(tx, ty, tz)
      const progress = (i + 1) / TRAIL_COUNT
      const mat = mesh.material as THREE.MeshPhysicalMaterial
      mat.opacity = (1 - progress) * 0.25
      const s = 1 - progress * 0.6
      mesh.scale.setScalar(s)
    })
  })

  return (
    <group>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[SPHERE_SIZE, 24, 24]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.1}
          roughness={0.3}
          clearcoat={0.3}
        />
      </mesh>
      {Array.from({ length: TRAIL_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { trailRefs.current[i] = el }}
        >
          <sphereGeometry args={[SPHERE_SIZE, 12, 12]} />
          <meshPhysicalMaterial
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 3, 3]} intensity={1.5} />
      <pointLight position={[-3, -1, -3]} intensity={0.8} />
      <directionalLight position={[0, 2, 0]} intensity={0.4} />
      {COLORS.map((color, i) => (
        <OrbitingSphere
          key={color}
          color={color}
          offset={(i / COLORS.length) * Math.PI * 2}
          speed={SPEEDS[i]}
        />
      ))}
    </>
  )
}

export default function OrbitLoader({ size = 100 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </View>
  )
}