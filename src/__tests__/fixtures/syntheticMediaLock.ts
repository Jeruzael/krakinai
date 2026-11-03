/** Unit-only same-origin lock scheduler. Real two-tab Web Locks run in Chromium QA. */
export function installSyntheticMediaLock(){
 const tails=new Map<string,Promise<unknown>>(),calls:string[]=[];
 const manager={request<T>(name:string,_options:LockOptions,work:(lock:Lock)=>T|Promise<T>):Promise<T>{
  calls.push(name);const previous=tails.get(name)??Promise.resolve(),next=previous.catch(()=>undefined).then(()=>work({name,mode:'exclusive'}));tails.set(name,next);return next;
 }};
 Object.defineProperty(navigator,'locks',{value:manager,configurable:true});return{calls};
}
