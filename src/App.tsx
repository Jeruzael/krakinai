import React from 'react';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { AppShell } from './components/AppShell';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { CinematographyScreen } from './screens/CinematographyScreen';
import { PromptDetailScreen } from './screens/PromptDetailScreen';
import { EditorScreen } from './screens/EditorScreen';
import { VariantsScreen } from './screens/VariantsScreen';
import { SceneBuilderScreen } from './screens/SceneBuilderScreen';
import {DirectPromptScreen} from './screens/DirectPromptScreen';
import {isDirectPrompt} from './domain/directPrompt';
import { PromptOutputScreen } from './screens/PromptOutputScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { CATEGORY_TO_SLOT } from './domain/validation';
import type { PromptCategory } from './types/domain';
const CollectionWorkspace = React.lazy(() => import('./screens/CollectionWorkspace').then(module => ({default:module.CollectionWorkspace})));
const ChangeSetImportScreen=React.lazy(()=>import('./screens/ChangeSetImportScreen').then(m=>({default:m.ChangeSetImportScreen})));
const AiContextScreen=React.lazy(()=>import('./screens/AiContextScreen').then(m=>({default:m.AiContextScreen})));

const RouteDispatcher: React.FC = () => {
  const { hashPath, loading, navigate, snapshot } = useLibrary();

  if (loading) {
    return (
      <div className="card">
        <p className="muted-text">Loading local IndexedDB library...</p>
      </div>
    );
  }

  const [rawPath, queryStr = ''] = hashPath.split('?');
  const path = rawPath.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(queryStr);

  // S01 Home
  if(path==='/imports/ai')return <React.Suspense fallback={<div role="status" className="card">Loading import workspace…</div>}><ChangeSetImportScreen/></React.Suspense>;
  if(path==='/context/ai')return <React.Suspense fallback={<div role="status" className="card">Loading context export…</div>}><AiContextScreen key={hashPath}/></React.Suspense>;
  if (path === '/') {
    return <HomeScreen />;
  }

  // S02 Library / Category / Favorites / Saved Scenes
  if (path === '/library') {
    return <LibraryScreen mode="all" />;
  }
  if (path === '/favorites') {
    return <LibraryScreen mode="favorites" />;
  }
  if (path === '/scenes') {
    return <LibraryScreen mode="scenes" />;
  }
  const libCatMatch = path.match(/^\/library\/([^/]+)$/);
  if (libCatMatch) {
    const cat = libCatMatch[1] as PromptCategory;
    if (cat in CATEGORY_TO_SLOT) {
      if (cat === 'camera') return <CinematographyScreen />;
      return <LibraryScreen mode="category" category={cat} />;
    }
  }

  // S04 Create / Edit Prompt or Variant
  if (path === '/prompts/new') {
    const catParam = searchParams.get('category') as PromptCategory | null;
    const validCat =
      catParam && catParam in CATEGORY_TO_SLOT ? catParam : 'characters';
    return (
      <EditorScreen
        key={`create_${validCat}`}
        mode="create-asset"
        initialCategory={validCat}
      />
    );
  }

  const editAssetMatch = path.match(/^\/prompts\/([^/]+)\/edit$/);
  if (editAssetMatch) {
    return (
      <EditorScreen
        key={`edit_asset_${editAssetMatch[1]}`}
        mode="edit-asset"
        targetId={editAssetMatch[1]}
      />
    );
  }

  const createVariantMatch = path.match(
    /^\/characters\/([^/]+)\/variants\/new$/
  );
  if (createVariantMatch) {
    return (
      <EditorScreen
        key={`create_var_${createVariantMatch[1]}`}
        mode="create-variant"
        parentCharacterId={createVariantMatch[1]}
      />
    );
  }

  const editVariantMatch = path.match(/^\/variants\/([^/]+)\/edit$/);
  if (editVariantMatch) {
    return (
      <EditorScreen
        key={`edit_var_${editVariantMatch[1]}`}
        mode="edit-variant"
        targetId={editVariantMatch[1]}
      />
    );
  }

  // S03 Prompt / Variant Detail
  const assetDetailMatch = path.match(/^\/prompts\/([^/]+)$/);
  if (assetDetailMatch) {
    return (
      <PromptDetailScreen
        key={`detail_asset_${assetDetailMatch[1]}`}
        id={assetDetailMatch[1]}
        kind="asset"
      />
    );
  }

  const variantDetailMatch = path.match(/^\/variants\/([^/]+)$/);
  if (variantDetailMatch) {
    return (
      <PromptDetailScreen
        key={`detail_var_${variantDetailMatch[1]}`}
        id={variantDetailMatch[1]}
        kind="variant"
      />
    );
  }

  // S05 Character Variants
  const charVariantsMatch = path.match(/^\/characters\/([^/]+)\/variants$/);
  if (charVariantsMatch) {
    return <VariantsScreen characterId={charVariantsMatch[1]} />;
  }

  // S06 Scene Builder
  if(path==='/direct/new')return <DirectPromptScreen key="new-direct"/>;
  if (path === '/builder') {
    const active=snapshot?.drafts.find(d=>d.id===snapshot.preferences.activeDraftId)??snapshot?.drafts[0];
    if(active&&isDirectPrompt(active))return <DirectPromptScreen key={active.id} id={active.id}/>;
    return <SceneBuilderScreen />;
  }
  const builderDraftMatch = path.match(/^\/builder\/([^/]+)$/);
  if (builderDraftMatch) {
    const draft=snapshot?.drafts.find(d=>d.id===builderDraftMatch[1]);
    if(draft&&isDirectPrompt(draft))return <DirectPromptScreen key={draft.id} id={draft.id}/>;
    return <SceneBuilderScreen draftId={builderDraftMatch[1]} />;
  }

  // S07 Prompt Output
  const outputMatch = path.match(/^\/output\/([^/]+)$/);
  if (outputMatch) {
    return <PromptOutputScreen id={outputMatch[1]} />;
  }

  // S08 Collections
  if (path === '/collections') {
    return <CollectionsScreen />;
  }
  const colDetailMatch = path.match(/^\/collections\/([^/]+)$/);
  if (colDetailMatch) {
    let collectionId = colDetailMatch[1];
    try { collectionId = decodeURIComponent(collectionId); } catch { /* Display missing collection for malformed route. */ }
    return <React.Suspense fallback={<div className="card" role="status">Loading project workspace…</div>}><CollectionWorkspace collectionId={collectionId} /></React.Suspense>;
  }

  // S09 Templates
  if (path === '/templates') {
    return <TemplatesScreen />;
  }

  return (
    <div className="card">
      <h1 className="section-title" style={{ marginBottom: 8 }}>
        Page Not Found
      </h1>
      <p className="muted-text" style={{ margin: '0 0 14px' }}>
        The route <code>{path}</code> does not exist in KRAKINAI.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => navigate('/')}
      >
        Return Home
      </button>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LibraryProvider>
      <AppShell>
        <RouteDispatcher />
      </AppShell>
    </LibraryProvider>
  );
};

export default App;
