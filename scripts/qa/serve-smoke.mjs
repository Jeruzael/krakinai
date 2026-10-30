// Test-only Vite readiness, no application/data/approval endpoint. Do not make
// the first browser case pay the cold module-compilation cost after HTTP listen.
import { createServer } from 'vite';
let ready=false;
// Retained baseline exports/profiles are evidence, not application entry points
// or files that should trigger HMR during a synthetic browser run.
const server=await createServer({optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1',port:4173,strictPort:true,watch:{ignored:['**/qa-results/**']}},plugins:[{
  name:'isolated-smoke-readiness',
  configureServer(instance){instance.middlewares.use((request,response,next)=>{if(request.url!=='/__qa_ready')return next();response.statusCode=ready?200:503;response.setHeader('content-type','text/plain');response.end(ready?'ready':'warming');});},
}]});
await server.listen();
await Promise.all(['/src/main.tsx','/src/screens/ChangeSetImportScreen.tsx','/src/screens/AiConnectionsScreen.tsx'].map(url=>server.warmupRequest(url)));
await server.waitForRequestsIdle();
ready=true;
console.log('KRAKINAI_SYNTHETIC_SMOKE_READY');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void server.close();});
