// This declares the shape of our font module
declare module '../assets/fonts/tibetanFont' {
    export const tibetanFontBase64: string;
}

// This ensures TypeScript recognizes .js imports
declare module '@/assets/fonts/tibetanFont' {
    export const tibetanFontBase64: string;
}