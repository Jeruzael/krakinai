import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import { resolveCollectionContext } from '../domain/collectionNavigation';
export const CollectionReturnControl: React.FC<{sceneId:string}> = ({sceneId}) => {
 const {hashPath,snapshot,navigate} = useLibrary();
 const context = resolveCollectionContext(hashPath,sceneId,snapshot?.collections ?? []);
 const shot = context?.collection.project?.shots.find(shot => shot.id === context.state.shot);
 return <nav aria-label="Saved scene location">{context && <span>{context.collection.name} / {shot ? `${shot.code} · ${shot.title}` : 'Saved Scene'} · </span>}<button type="button" className="btn btn-secondary btn-sm" onClick={()=>navigate(context?.route ?? '/scenes')}>{context ? 'Back to Collection':'Back to Saved Scenes'}</button></nav>;
};
