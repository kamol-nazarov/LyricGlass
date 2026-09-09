// Firefox's browser namespace and modern Chromium's chrome namespace both return
// promises. Firefox's compatibility chrome namespace is not used.
export const browserApi:typeof chrome=(globalThis as typeof globalThis & {browser?:typeof chrome}).browser ?? globalThis.chrome;
