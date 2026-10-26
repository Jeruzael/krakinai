import { describe, it, expect } from 'vitest';
import { collectionSceneRoute, resolveCollectionContext, rememberCollectionScroll, getCollectionScroll } from '../domain/collectionNavigation';
const collections = [{id:'one',name:'One',members:[{type:'scene',id:'s'}]}, {id:'two',name:'Two',members:[{type:'scene',id:'s'}]}] as any;
describe('collection navigation', () => {
 it('preserves encoded independent origins and state through refresh', () => {
  for (const id of ['one','two']) {
   const route = collectionSceneRoute('s', id, {tab:'scenes',view:'list',sort:'updated',filter:'a & b'});
   expect(resolveCollectionContext(route, 's', collections)?.route).toContain(`collections/${id}?`);
   expect(resolveCollectionContext(route,'s',collections)?.state.filter).toBe('a & b');
  }
 });
 it('rejects missing origins and nonmembers and invalid shots', () => {
  expect(resolveCollectionContext('/output/s','s',collections)).toBeNull();
  expect(resolveCollectionContext('/output/s?collection=gone','s',collections)).toBeNull();
  expect(resolveCollectionContext('/output/x?collection=one','x',collections)).toBeNull();
  expect(resolveCollectionContext('/output/s?collection=one&shot=missing','s',collections)).toBeNull();
 });
 it('stores scroll per full collection route', () => {
  rememberCollectionScroll('/collections/one?tab=scenes',123);
  expect(getCollectionScroll('/collections/one?tab=scenes')).toBe(123);
  expect(getCollectionScroll('/collections/two?tab=scenes')).toBe(0);
 });
});
