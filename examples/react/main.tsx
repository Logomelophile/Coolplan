import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SPCViewer } from './SPCViewer';
import { products } from '../../src/index';
import type { ViewPreset } from '../../src/types';

function Example() {
  const [productId, setProductId] = useState('light-natural-oak');
  const [view, setView] = useState<ViewPreset>('perspective34');
  const [autoRotate, setAutoRotate] = useState(false);
  const [status, setStatus] = useState('Preparing the studio…');
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', fontFamily: 'Arial, sans-serif', color: '#353238' }}>
    <a href="../../" style={{ color: '#655278', fontSize: 13 }}>← Material Studio</a>
    <h1 style={{ fontSize: 28, fontWeight: 400 }}>React integration</h1>
    <p style={{ color: '#777', fontSize: 14 }}>The same viewer, controlled through React props.</p>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <label>Finish <select aria-label="Finish" value={productId} onChange={event => setProductId(event.target.value)} style={{ padding: 8, marginLeft: 8 }}>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      <label>View <select aria-label="View" value={view} onChange={event => setView(event.target.value as ViewPreset)} style={{ padding: 8, marginLeft: 8 }}>{(['front', 'perspective34', 'stacked', 'closeup', 'back', 'exploded', 'profile'] as ViewPreset[]).map(preset => <option key={preset}>{preset}</option>)}</select></label>
      <label><input type="checkbox" checked={autoRotate} onChange={event => setAutoRotate(event.target.checked)} /> Auto-rotate</label>
    </div>
    <SPCViewer productId={productId} view={view} autoRotate={autoRotate} locale="en" style={{ height: 'min(65vh, 640px)', minHeight: 350 }} onReady={() => setStatus('Ready. Drag to orbit; click the plank to separate its layers.')} onLayerSelect={layerId => setStatus(layerId ? `Selected layer: ${layerId}` : 'Click a layer to explore it.')} onError={error => setStatus(error instanceof Error ? error.message : 'Unable to load the viewer.')} />
    <p role="status" style={{ fontSize: 12, color: '#777' }}>{status}</p>
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Example /></StrictMode>);
