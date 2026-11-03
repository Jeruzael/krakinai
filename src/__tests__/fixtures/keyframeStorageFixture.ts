import {clearAllStoresForTesting,initializeDatabase,saveSceneDraft} from '../../storage/db';
import {writeRecord} from './ensembleStorageFixture';
import {keyframeChangeScenario} from './keyframeChangeSetFixture';
import {installSyntheticMediaLock} from './syntheticMediaLock';
import {installSyntheticRasterDecoder} from './syntheticRasterDecoder';
export async function seedKeyframeStorage(){
 if(!navigator.locks)installSyntheticMediaLock();
 installSyntheticRasterDecoder();
 await clearAllStoresForTesting();await initializeDatabase();const f=await keyframeChangeScenario();
 for(const store of ['assets','variants','media','scenes','collections'] as const)for(const row of f.state[store])await writeRecord(store,row);
 f.draft.imagePromptSnapshots=structuredClone(f.parent.imagePromptSnapshots);
 const draft=await saveSceneDraft(f.draft);return{...f,draft};
}
