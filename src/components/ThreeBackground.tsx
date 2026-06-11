'use client'
// src/components/ThreeBackground.tsx
//
// What this file does, plain English:
// A subtle, slowly drifting field of points rendered with Three.js, fixed behind
// the whole app as an ambient background. It is deliberately quiet so text stays
// readable. Three.js is loaded INSIDE the effect (dynamic import) so it only ever
// runs in the browser — never during server rendering, where WebGL doesn't exist.

import { useEffect, useRef } from 'react'

export default function ThreeBackground() {
  // The div the WebGL canvas gets attached to.
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Honor users who ask for less motion: we'll render one static frame, no loop.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: import('three').WebGLRenderer | undefined
    let frameId = 0
    let disposed = false
    const cleanups: (() => void)[] = []

    // Load Three.js only in the browser, then build the scene.
    import('three').then((THREE) => {
      if (disposed) return

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      )
      camera.position.z = 6

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(window.innerWidth, window.innerHeight)
      container.appendChild(renderer.domElement)

      // Build a field of soft points scattered in 3D space.
      const COUNT = 800
      const positions = new Float32Array(COUNT * 3)
      for (let i = 0; i < COUNT * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 16
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({
        color: 0x8b5cf6, // violet-500, to match the app accent
        size: 0.035,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      })
      const points = new THREE.Points(geometry, material)
      scene.add(points)

      const renderFrame = () => renderer!.render(scene, camera)

      // The animation loop — a very slow rotation so it feels like a calm drift.
      const animate = () => {
        points.rotation.y += 0.0006
        points.rotation.x += 0.0002
        renderFrame()
        frameId = requestAnimationFrame(animate)
      }

      // Keep the scene matched to the window size.
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer!.setSize(window.innerWidth, window.innerHeight)
        if (reduceMotion) renderFrame()
      }
      window.addEventListener('resize', handleResize)
      cleanups.push(() => window.removeEventListener('resize', handleResize))

      // Pause the loop when the tab is hidden, resume when it's visible again.
      const handleVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(frameId)
          frameId = 0
        } else if (!reduceMotion && frameId === 0) {
          animate()
        }
      }
      document.addEventListener('visibilitychange', handleVisibility)
      cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibility))

      // Free GPU memory on teardown.
      cleanups.push(() => {
        geometry.dispose()
        material.dispose()
      })

      if (reduceMotion) renderFrame()
      else animate()
    })

    // Cleanup when the component unmounts.
    return () => {
      disposed = true
      if (frameId) cancelAnimationFrame(frameId)
      cleanups.forEach(fn => fn())
      if (renderer) {
        const canvas = renderer.domElement
        renderer.dispose()
        if (canvas.parentNode === container) container.removeChild(canvas)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  )
}
