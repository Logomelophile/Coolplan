/** Source dimensions keep project photographs intact before their lazy image loads. */
const SIZES: Record<string, readonly [number, number]> = {
    'cafe-herringbone': [717, 960], 'cafe-herringbone-top': [717, 960],
    'chevron-hall': [736, 981], 'customer-connected-room': [960, 719],
    'customer-open-plan': [960, 540], 'experience-herringbone-hall': [1440, 1080],
    'experience-window-room': [960, 719], 'installation-prep': [1108, 1476],
    'installation-room': [1477, 1108], 'installation-team': [1108, 1477],
    'narasiri-dark': [763, 618], 'narasiri-light': [757, 618],
    'narasiri-stairs': [763, 618], 'office-lounge': [1477, 1108],
    'office-meeting': [1477, 1108], 'pethotel-herringbone': [759, 615],
    'stair-oak': [825, 1100], 'stair-railing': [703, 551], 'stair-teak': [825, 1100],
};
export function projectPhotoSize(path: string) {
    const key = path.split('/').at(-1)!.replace(/\.webp$/, '');
    const size = SIZES[key];
    if (!size) throw new Error(`Missing project photo dimensions: ${key}`);
    return { width: size[0], height: size[1], ratio: size[0] / size[1], portrait: size[0] < size[1] };
}
