import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import source from '../../model-source/einstein/base.obj?raw';

function Viewer() {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef({ angle: 0, portrait: false });
  const [angle, setAngle] = useState(0), [portrait, setPortrait] = useState(false);
  view.current = { angle, portrait };
  useEffect(() => {
    const host = container.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(1.5); renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor('#222a37'); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const obj = new OBJLoader().parse(source);
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(3.95 / size.y); obj.position.set(-(box.min.x + box.max.x) / 2 * obj.scale.x, -box.min.y * obj.scale.x, -(box.min.z + box.max.z) / 2 * obj.scale.x);
    obj.traverse(o => { if (o instanceof THREE.Mesh) o.material = new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: .72 }); }); scene.add(obj);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(room, .035);
    scene.environment = env.texture; scene.environmentIntensity = .5; room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#fff5eb', '#8190a7', 1));
    const key = new THREE.DirectionalLight('#fff5ed', 2.3); key.position.set(-3, 6, 5); scene.add(key);
    const fill = new THREE.DirectionalLight('#e5edff', .85); fill.position.set(4, 3, 5); scene.add(fill);
    const camera = new THREE.OrthographicCamera(-2.1, 2.1, 2.15, -2.15, .1, 30);
    renderer.setAnimationLoop(() => {
      obj.rotation.y = view.current.angle; const center = view.current.portrait ? 3.0 : 1.96;
      const height = view.current.portrait ? 1.1 : 2.15;
      camera.left = -height * host.clientWidth / host.clientHeight; camera.right = -camera.left; camera.top = height; camera.bottom = -height;
      camera.position.set(0, center + .18, 8); camera.lookAt(0, center, 0); camera.updateProjectionMatrix(); renderer.render(scene, camera);
    });
    return () => { renderer.setAnimationLoop(null); obj.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }); env.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <main><div ref={container} style={{width: 650, height: 650, maxWidth:'100vw'}}/>
    <nav>{[['Перед +Z',0],['Перед −Z',Math.PI],['Три четверти',-.65],['Профиль',-1.57]].map(([name,value]) => <button key={name} onClick={() => setAngle(Number(value))}>{name}</button>)}<button onClick={() => setPortrait(!portrait)}>{portrait ? 'Весь персонаж' : 'Лицо'}</button></nav>
  </main>;
}
document.body.style.cssText = 'margin:0;background:#161d29;color:white;display:grid;place-items:center;min-height:100vh;font-family:Arial';
createRoot(document.getElementById('root')!).render(<Viewer/>);
