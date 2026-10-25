import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import EinsteinAvatar from '../../src/components/EinsteinAvatar.tsx';
import type { EinsteinMode } from '../../src/graphics/createEinstein.ts';

function Fixture() {
  const [mode, setMode] = useState<EinsteinMode>('idle');
  const [viewAngle, setViewAngle] = useState(-.065);
  const [portrait, setPortrait] = useState(false);
  const [still, setStill] = useState(false);
  const [blink, setBlink] = useState(false);
  return <main style={{ minHeight: '100vh', margin: 0, background: 'radial-gradient(ellipse at 45% 25%,#414651,#161d29 70%)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'Arial' }}>
    <div><div style={{ width: 560, height: 660, maxWidth: '100vw' }}><EinsteinAvatar mode={mode} viewAngle={viewAngle} portrait={portrait} still={still} sampleTime={blink ? 4.98 : undefined}/></div>
      <nav style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>{(['idle', 'guide', 'wave'] as const).map(value => <button key={value} onClick={() => setMode(value)}>{value}</button>)}</nav>
      <nav style={{display:'flex',justifyContent:'center'}}><button onClick={() => setBlink(!blink)}>{blink ? 'Открыть глаза' : 'Закрыть глаза'}</button></nav>
      <nav style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: 12 }}>{[['Спереди', 0], ['Три четверти', -.65], ['Профиль', -1.57], ['Сзади', 3.14]].map(([label, angle]) => <button key={label} onClick={() => setViewAngle(Number(angle))}>{label}</button>)}<button onClick={() => setPortrait(!portrait)}>{portrait ? 'Весь персонаж' : 'Лицо крупно'}</button><button onClick={() => setStill(!still)}>{still ? 'Оживить' : 'Стоп-кадр'}</button></nav>
    </div>
  </main>;
}
document.body.style.margin = '0';
createRoot(document.getElementById('root')!).render(<Fixture/>);
