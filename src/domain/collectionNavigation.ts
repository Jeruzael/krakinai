import type { Collection } from '../types/domain';
export interface CollectionViewState { tab: string; view: 'grid'|'list'; sort: string; filter: string; shot?: string }
const tabs = ['assets','variants','scenes','storyboard','characters','results','details'];
const sorts = ['updated','created','title','name','order','newest','oldest','updated-desc','created-desc','title-asc'];
export function collectionViewState(path: string): CollectionViewState {
 const q = new URLSearchParams(path.split('?')[1] || '');
 return {tab: tabs.includes(q.get('tab') || '') ? q.get('tab')! : 'assets', view:q.get('view') === 'list' ? 'list':'grid', sort:sorts.includes(q.get('sort') || '') ? q.get('sort')!:'updated', filter:(q.get('filter') || '').slice(0,500), ...(q.get('shot') ? {shot:q.get('shot')!}:{})};
}
export function collectionRoute(id: string, state: Partial<CollectionViewState> = {}): string {
 const s = collectionViewState('?' + new URLSearchParams(state as Record<string,string>).toString());
 return `/collections/${encodeURIComponent(id)}?${new URLSearchParams({tab:s.tab,view:s.view,sort:s.sort,filter:s.filter}).toString()}`;
}
export function collectionSceneRoute(sceneId: string, collectionId: string, state: Partial<CollectionViewState> = {}): string {
 const s = collectionViewState('?' + new URLSearchParams(state as Record<string,string>).toString());
 return `/output/${encodeURIComponent(sceneId)}?${new URLSearchParams({collection:collectionId,tab:s.tab,view:s.view,sort:s.sort,filter:s.filter,...(s.shot ? {shot:s.shot}:{})}).toString()}`;
}
export function resolveCollectionContext(path: string, sceneId: string, collections: Collection[]) {
 const q = new URLSearchParams(path.split('?')[1] || '');
 const collection = collections.find(c=>c.id === q.get('collection'));
 if (!collection || !collection.members.some(m=>m.type === 'scene' && m.id === sceneId)) return null;
 const state = collectionViewState(path);
 if (state.shot) {
  const project = (collection as Collection & {project?:{shots?:{id:string;takeSceneIds:string[]}[]}}).project;
  if (!project?.shots?.some(s=>s.id === state.shot && s.takeSceneIds.includes(sceneId))) return null;
 }
 return {collection,state,route:collectionRoute(collection.id,state)};
}
const scroll = new Map<string,number>();
export function rememberCollectionScroll(route:string, top:number) { scroll.set(route, Math.max(0,top)); }
export function getCollectionScroll(route:string) { return scroll.get(route) ?? 0; }
