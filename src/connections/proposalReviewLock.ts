/** Browser-owned, crash-releasing coordination only; never a save permission. */
export async function withProposalReviewLock<T>(id:string,work:()=>Promise<T>):Promise<T>{
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(id))throw Error('Invalid review identity.');
  const locks=typeof navigator!=='undefined'?navigator.locks:undefined;
  if(!locks?.request)throw Error('This browser needs Web Locks to safely update saved reviews. Keep or download the package and use a supported browser.');
  return locks.request('krakinai-review:'+id,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw Error('Another tab is processing this proposal. Wait for its result, then revalidate; no review state was changed.');
    return work();
  });
}
