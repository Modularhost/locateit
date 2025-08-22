export const abc = (n) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const uid = () => Math.random().toString(36).slice(2, 10);
