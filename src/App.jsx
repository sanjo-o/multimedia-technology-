import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Phantom‑inspired landing (not a 1:1 copy):
 * - Fullscreen animated shader background (noise-y liquid grid)
 * - Sticky nav + bold type sections
 * - Mouse parallax + time-based deformation
 *
 * Works in CRA + TypeScript. If you paste this into src/App.tsx it will run.
 */

// --- Simple GLSL shaders ---
const vertexShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uMouse; // normalized -1..1

  // 2D noise (cheap-ish)
  float hash(vec2 p){
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(in vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Domain warp using time and mouse
    float t = uTime * 0.3;
    vec2 warp = vec2(
      noise(uv * 3.0 + t) * 0.5,
      noise(uv * 3.0 - t) * 0.5
    );
    // Mouse push/pull
    float m = length(uv - (uMouse*0.5 + 0.5));
    float mouseRipple = smoothstep(0.6, 0.0, m) * 0.4;

    // Height displacement
    float h = noise(uv * 6.0 + warp + t) * 0.4 + mouseRipple;
    pos.z += h;

    // Subtle grid wobble
    pos.x += (noise(uv*4.0 + t) - 0.5) * 0.08;
    pos.y += (noise(uv*4.0 - t) - 0.5) * 0.08;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;

  // Smooth palette between two colors with a pulse
  vec3 palette(float t, vec3 a, vec3 b) {
    return a + b * sin(6.28318 * (t + vUv.yxxy));
  }

  void main() {
    float t = uTime * 0.15;
    float vignette = smoothstep(1.0, 0.2, length(vUv - 0.5));

    vec3 baseA = vec3(0.02, 0.02, 0.03);   // near-black blue
    vec3 baseB = vec3(0.35, 0.35, 0.7);    // electric indigo tint
    vec3 col = mix(baseA, baseB, vUv.y * 0.9);

    // Pulse tint
    col += 0.07 * sin(t + vUv.x * 4.0) * vec3(0.2, 0.3, 0.8);

    // Vignette for depth
    col *= vignette;

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const uniformsRef = useRef<{ uTime: { value: number }, uMouse: { value: THREE.Vector2 } } | null>(null)
  const mouse = useRef(new THREE.Vector2(0, 0))

  useEffect(() => {
   const uniformsRef = useRef(null);
  const mouse = useRef(new THREE.Vector2(0, 0));

    // Scene and Camera
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100)
    camera.position.set(0, 0, 2.2)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)
    renderer.setClearColor('#050505', 1)
    rendererRef.current = renderer

    // Geometry: high-res plane for displacement
    const geo = new THREE.PlaneGeometry(4, 2.4, 240, 160)
    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.0, 0.0) }
    }
    const geometry = new THREE.BoxGeometry()
const material = new THREE.MeshStandardMaterial({ color: 0xff6600 })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

const light = new THREE.DirectionalLight(0xffffff, 1)
light.position.set(5, 5, 5)
scene.add(light)

    uniformsRef.current = uniforms

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      wireframe: false,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -0.1
    scene.add(mesh)

    // Lights (subtle)
    const dir = new THREE.DirectionalLight(0xffffff, 0.35)
    dir.position.set(2, 3, 2)
    scene.add(dir)

    const amb = new THREE.AmbientLight(0xffffff, 0.2)
    scene.add(amb)

    // Handle resize
    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current) return
      const w = container.clientWidth
      const h = container.clientHeight
      rendererRef.current.setSize(w, h)
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    // Mouse move normalized to -1..1 coords relative to canvas
   const onPointerMove = (e) => {
  const rect = e.target.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  mouse.current.set(x * 2 - 1, -(y * 2 - 1))
  uniformsRef.current.uMouse.value.lerp(mouse.current, 0.2)
}

    renderer.domElement.addEventListener('pointermove', onPointerMove)

    let raf = 0
    const clock = new THREE.Clock()
   const animate = () => {
  requestAnimationFrame(animate)
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}
animate() 

    animate()

    // Cleanup
    return () => {
      cancelAnimationFrame(raf)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      ro.disconnect()
      renderer.dispose()
      geo.dispose()
      mat.dispose()
      scene.clear()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div className="min-h-screen w-full text-white relative bg-black overflow-hidden">
      {/* WebGL background */}
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />


      {/* Nav */}
      <header className="sticky top-0 z-20 backdrop-blur-sm/5">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="text-xl tracking-tight font-semibold">
            <span className="opacity-70">phantom</span>
            <span className="opacity-40">‑inspired</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm opacity-80">
            <a href="#work" className="hover:opacity-100 transition">Work</a>
            <a href="#about" className="hover:opacity-100 transition">About</a>
            <a href="#contact" className="hover:opacity-100 transition">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="min-h-[92vh] flex items-end">
        <div className="max-w-7xl mx-auto px-6 pb-24">
          <h1 className="text-5xl md:text-7xl leading-[0.95] font-semibold tracking-tight">
            Shape‑shifting web <span className="opacity-70">experiments</span><br/>
            with <span className="opacity-70">React</span> + <span className="opacity-70">Three.js</span>
          </h1>
          <p className="mt-6 max-w-xl opacity-80">
            A clean starter that mimics the vibe (not the assets) of Phantom.land: liquid grids, bold type,
            and silky scroll—ready for your own content and shaders.
          </p>
          <div className="mt-8 flex gap-4">
            <a href="#work" className="rounded-2xl px-5 py-3 bg-white text-black font-medium">See work</a>
            <a href="#about" className="rounded-2xl px-5 py-3 border border-white/30">Learn more</a>
          </div>
        </div>
      </section>

      {/* Work grid (placeholder) */}
      <section id="work" className="py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <article key={i} className="group relative rounded-3xl border border-white/10 overflow-hidden p-8 backdrop-blur-[1px] bg-white/0 hover:bg-white/5 transition">
                <h3 className="text-2xl font-semibold">Project {i + 1}</h3>
                <p className="opacity-75 mt-2">Short description about your interactive project, tech stack, and impact.</p>
                <div className="mt-6 flex flex-wrap gap-2 text-xs opacity-70">
                  <span className="px-2 py-1 rounded-full border border-white/10">Three.js</span>
                  <span className="px-2 py-1 rounded-full border border-white/10">GLSL</span>
                  <span className="px-2 py-1 rounded-full border border-white/10">TypeScript</span>
                </div>
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition duration-500" style={{background:'radial-gradient(600px circle at var(--x,50%) var(--y,50%), rgba(255,255,255,0.08), transparent 40%)'}}/>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-28 border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-semibold">About this starter</h2>
          <p className="mt-4 opacity-80">
            This is an original implementation meant to capture a similar feel without copying proprietary assets
            or code. Swap in your own shaders, replace the layout, and extend with scroll‑triggered scenes or
            postprocessing.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-28 border-t border-white/10">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-semibold">Get in touch</h2>
          <form className="mt-6 grid sm:grid-cols-2 gap-4">
            <input className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none" placeholder="Name" />
            <input className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none" placeholder="Email" />
            <textarea className="sm:col-span-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none" rows={5} placeholder="Message" />
            <button type="button" className="sm:col-span-2 justify-self-start rounded-2xl px-5 py-3 bg-white text-black font-medium">Send</button>
          </form>
        </div>
      </section>

      <footer className="py-10 border-t border-white/10 text-center opacity-60 text-sm">
        Built with React + Three.js. Phantom‑inspired, not affiliated.
      </footer>
    </div>
  )
}
