declare module 'virtual:spc-texture-manifest' {
  const manifest: Record<string, {albedo?: string; normal?: string; roughness?: string}>;
  export default manifest;
}
