import {clearAllStoresForTesting,initializeDatabase,saveSceneDraft,getAllSnapshot} from '../../storage/db';
import {saveAuthoredScene} from '../../storage/sceneAuthoring';
import {makeBlockingFixture} from './blockingFixture';
import {writeRecord} from './ensembleStorageFixture';
export async function seedBlockingStorage({saveScene=false,select=false}={}){
 await clearAllStoresForTesting();await initializeDatabase();const fixture=makeBlockingFixture();
 for(const store of ['assets','variants','media','scenes','collections']as const)for(const record of fixture.state[store])await writeRecord(store,record);
 const draft=await saveSceneDraft(fixture.draft),scene=saveScene?await saveAuthoredScene(draft.id,{requestId:'synthetic-blocking-save',expectedInputRevision:draft.inputRevision,selectAsPreferred:select}):undefined;
 return{...fixture,draft,scene,snapshot:await getAllSnapshot()};
}
