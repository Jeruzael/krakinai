const LOCK_NAME='krakinai.library-media-preparation.v1';
/** All app binary writers cooperate with the same origin-scoped Web Lock.
 * C hashing/decoding and its final IDB transaction hold one uninterrupted lease.
 * This is not a defense against arbitrary owner DevTools/database manipulation. */
export async function withStableLibraryMedia<T>(work:()=>Promise<T>,required=false):Promise<T>{
 const locks=typeof navigator!=='undefined'?navigator.locks:undefined;
 if(locks?.request)return locks.request(LOCK_NAME,{mode:'exclusive'},work);
 if(required)throw Error('This browser cannot safely save derived frame prompts without Web Locks. Keep your draft and use a supported Chromium browser; no scene was saved.');
 return work();
}
