'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { SPCPlankViewer } from 'spc-plank-viewer';
import type { Locale, ViewPreset } from 'spc-plank-viewer';

export interface SPCViewerProps {
  productId?: string;
  view?: ViewPreset;
  locale?: Locale;
  autoRotate?: boolean;
  className?: string;
  style?: CSSProperties;
  onReady?: (viewer: SPCPlankViewer) => void;
  onProductChange?: (productId: string) => void;
  onLayerSelect?: (layerId: string | null) => void;
  onError?: (error: unknown) => void;
}

/** A client-only adapter that uses the package's public API. */
export function SPCViewer(props: SPCViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<SPCPlankViewer | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!containerRef.current) return;
    const initial = propsRef.current;
    const viewer = new SPCPlankViewer(containerRef.current, {
      productId: initial.productId ?? 'light-natural-oak',
      view: initial.view ?? 'perspective34',
      locale: initial.locale ?? 'th',
      autoRotate: initial.autoRotate ?? false,
    });
    instanceRef.current = viewer;
    let active = true;
    const productChanged = (event: Event) => {
      propsRef.current.onProductChange?.((event as CustomEvent<{ productId: string }>).detail.productId);
    };
    const layerSelected = (event: Event) => {
      propsRef.current.onLayerSelect?.((event as CustomEvent<{ layerId: string | null }>).detail.layerId);
    };
    viewer.addEventListener('productchange', productChanged);
    viewer.addEventListener('layerselect', layerSelected);
    viewer.ready.then(() => {
      if (active) propsRef.current.onReady?.(viewer);
    }).catch(error => { if (active) propsRef.current.onError?.(error); });
    return () => {
      active = false;
      viewer.removeEventListener('productchange', productChanged);
      viewer.removeEventListener('layerselect', layerSelected);
      viewer.dispose();
      if (instanceRef.current === viewer) instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = instanceRef.current;
    let active = true;
    if (viewer && props.productId) {
      viewer.ready.then(async () => {
        if (active && viewer === instanceRef.current && viewer.product.id !== props.productId) await viewer.setProduct(props.productId!);
      }).catch(error => { if (active) propsRef.current.onError?.(error); });
    }
    return () => { active = false; };
  }, [props.productId]);

  useEffect(() => { if (props.view) instanceRef.current?.setView(props.view); }, [props.view]);
  useEffect(() => { if (props.locale) instanceRef.current?.setLocale(props.locale); }, [props.locale]);
  useEffect(() => { instanceRef.current?.setAutoRotate(props.autoRotate ?? false); }, [props.autoRotate]);

  return <div ref={containerRef} className={props.className} style={{ width: '100%', height: 500, ...props.style }} aria-label="Interactive SPC flooring viewer" />;
}
