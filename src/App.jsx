import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* Vertex & Fragment shaders for a wavy plane */
const vertexShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAudio;
  uniform vec2 uMouse;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float noise(in vec2 p){
    vec2 i=floor(p); vec2 f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }

  void main(){
    vUv = uv;
    vec3 p = position;
    float t = uTime * 0.8;

    // basic domain warp that reacts to audio:
    vec2 warp = vec2(noise(uv * 3.0 + t), noise(uv * 3.0 - t)) * 0.3;

    float m = length(uv - (uMouse*0.5 + 0.5));
    float mouseRip = smoothstep(0.7, 0.0, m) * 0.5;

    // audio raises the displacement amplitude
    float amp = 0.2 + uAudio * 0.9;

    float h = noise(uv * 6.0 + warp + t) * amp + mouseRip * (0.25 + uAudio * 0.5);
    p.z += h;

    // subtle horizontal wobble
    p.x += (noise(uv * 4.0 + t) - 0.5) * 0.06;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAudio;

  void main(){
    float t = uTime * 0.2;
    float vign = smoothstep(1.0, 0.2, length(vUv - 0.5));

    vec3 deep = vec3(0.02, 0.03, 0.06);
    vec3 mid  = vec3(0.18, 0.15, 0.4);
    vec3 bright = vec3(0.6, 0.4, 1.0);

    // audio-driven pulse
    float pulse = 0.2 + uAudio * 1.2;

    vec3 col = mix(deep, mid, vUv.y) + sin(t + vUv.x * 6.0) * 0.02 * pulse;
    col += bright * pow(uAudio, 1.5) * 0.4; // glow with music

    col *= vign;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function App() {
  const mountRef = useRef(null);
  const uniformsRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioElRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 2.3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    renderer.setClearColor("#050505", 1);

    // plane geometry
    const geo = new THREE.PlaneGeometry(4, 2.4, 200, 140);
    const uniforms = {
      uTime: { value: 0 },
      uAudio: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };
    uniformsRef.current = uniforms;

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -0.12;
    scene.add(plane);

    // small glowing cube to picture interaction (optional)
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xff9900 })
    );
    cube.position.set(-1.1, -0.7, 0.6);
    scene.add(cube);

    // lights
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(4, 5, 3);
    scene.add(dir);
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    // resize handling
    const onResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // mouse pointer normalized
    const onPointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current.set(x * 2 - 1, -(y * 2 - 1));
    };
    renderer.domElement.addEventListener("pointermove", onPointer);

    // audio analysis (create analyser when user hits play)
    const createAnalyser = async () => {
      // audio element from public/music.mp3
      let audio = audioElRef.current;
      if (!audio) {
        audio = new Audio("/music.mp3");
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audio.volume = volume;
        audioElRef.current = audio;
      }

      if (!analyserRef.current) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        analyserRef.current = analyser;
      }
    };

    // animate loop
    const clock = new THREE.Clock();
    let rafId = null;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (uniformsRef.current) {
        uniformsRef.current.uTime.value = t;
        uniformsRef.current.uMouse.value.lerp(mouseRef.current, 0.08);

        // update audio uniform from analyser
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          // compute average volume from lower bins (bass emphasis)
          let sum = 0;
          const len = dataArrayRef.current.length;
          // sum first ~20% of bins (bass)
          const cutoff = Math.max(4, Math.floor(len * 0.2));
          for (let i = 0; i < cutoff; i++) sum += dataArrayRef.current[i];
          const avg = sum / cutoff / 255; // 0..1
          uniformsRef.current.uAudio.value = avg;
          // also drive cube scale with music
          const s = 1 + avg * 1.4;
          cube.scale.set(s, s, s);
        }
      }

      cube.rotation.x += 0.01;
      cube.rotation.y += 0.02;
      renderer.render(scene, camera);
    };
    animate();

    // cleanup
    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(rafId);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      try { container.removeChild(renderer.domElement); } catch (e) {}
    };
  }, [volume]); // re-run if volume changes to re-use audio element

  // Controls: play / pause
  const handlePlay = async () => {
    try {
      // create analyser if not present then play
      if (!analyserRef.current) {
        // resume audio context by promising gesture
        await (new Promise((res) => setTimeout(res, 0)));
      }
      if (!audioElRef.current) audioElRef.current = new Audio("/music.mp3");
      // ensure audio context created inside effect; trigger creation:
      audioElRef.current.volume = volume;
      // Chrome requires a user gesture before AudioContext resume; use play() as user gesture
      await audioElRef.current.play();
      // create analyser in effect (we set analyser when play clicked)
      if (!analyserRef.current) {
        // attempt to create audio analyser via Web Audio API
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaElementSource(audioElRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        analyserRef.current = analyser;
      }
      setIsPlaying(true);
    } catch (err) {
      console.warn("Playback failed:", err);
    }
  };

  const handlePause = () => {
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    setIsPlaying(false);
  };

  const handleVolume = (v) => {
    const vol = Math.max(0, Math.min(1, v));
    setVolume(vol);
    if (audioElRef.current) audioElRef.current.volume = vol;
  };

  return (
    <div className="page-root">
      {/* WebGL mount */}
      <div ref={mountRef} className="canvas-wrap" />

      {/* UI overlays */}
      <header className="topbar">
        <div className="brand">MusicLab</div>
        <nav className="nav">
          <button className="btn" onClick={() => (isPlaying ? handlePause() : handlePlay())}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <label className="vol">
            Vol
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
            />
          </label>
        </nav>
      </header>

      <main className="hero">
        <h1 className="title">Shape-shifting music visuals</h1>
        <p className="subtitle">Move your mouse and play audio to bend the world.</p>
      </main>

      <footer className="foot">
        Built with React + Three.js • Put your file at <code>/public/music.mp3</code>
      </footer>
    </div>
  );
}
