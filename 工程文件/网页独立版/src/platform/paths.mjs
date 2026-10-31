/** Static app root works at /, /play/ and a versioned ST extension directory. */
export const APP_ROOT=new URL('../../',import.meta.url);
export const appUrl=relative=>new URL(relative,APP_ROOT).href;
