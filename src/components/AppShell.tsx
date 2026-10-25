import React, { useState } from 'react';
import {
  Camera,
  Clapperboard,
  Film,
  FolderKanban,
  HardDrive,
  Heart,
  Home,
  Layers,
  LayoutTemplate,
  Library,
  Menu,
  Palette,
  Plus,
  Settings,
  Shirt,
  Sparkles,
  Sun,
  TreePine,
  User,
  X,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import type { PromptCategory } from '../types/domain';
import {
  ClipboardFallbackModal,
  CollectionMembershipModal,
  ConfirmModal,
  SettingsBackupModal,
} from './SharedModals';

const CATEGORY_NAV_ITEMS: Array<{
  category: PromptCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { category: 'characters', label: 'Characters', icon: <User size={18} /> },
  {
    category: 'wardrobe',
    label: 'Clothing & Accessories',
    icon: <Shirt size={18} />,
  },
  {
    category: 'actions',
    label: 'Actions & Emotions',
    icon: <Sparkles size={18} />,
  },
  {
    category: 'environments',
    label: 'Environments',
    icon: <TreePine size={18} />,
  },
  {
    category: 'camera',
    label: 'Camera & Movement',
    icon: <Camera size={18} />,
  },
  {
    category: 'lighting',
    label: 'Lighting & Mood',
    icon: <Sun size={18} />,
  },
  { category: 'styles', label: 'Art Styles', icon: <Palette size={18} /> },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    snapshot,
    hashPath,
    navigate,
    setIsSettingsOpen,
    toasts,
    dismissToast,
    storageError,
  } = useLibrary();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const cleanPath = hashPath.split('?')[0];

  const handleNav = (target: string) => {
    setDrawerOpen(false);
    navigate(target);
  };

  return (
    <div className="app-shell">
      {drawerOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 25 }}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${drawerOpen ? 'drawer-open' : ''}`}
        aria-label="Primary Sidebar Navigation"
      >
        <a
          href="#/"
          className="app-brand"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
        >
          <div className="app-brand-mark" aria-hidden="true">
            K
          </div>
          <div className="app-brand-text">
            <span className="app-brand-title">KRAKINAI</span>
            <span className="app-brand-subtitle">AI Video Prompt Library</span>
          </div>
        </a>

        <div className="nav-section">
          <button
            type="button"
            className={`nav-link ${cleanPath === '/' ? 'active' : ''}`}
            onClick={() => handleNav('/')}
          >
            <Home size={18} />
            <span>Home</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-label">Library</div>
          <button
            type="button"
            className={`nav-link ${cleanPath === '/library' ? 'active' : ''}`}
            onClick={() => handleNav('/library')}
          >
            <Library size={18} />
            <span>All Prompts</span>
            {snapshot && (
              <span className="nav-link-count">{snapshot.assets.length}</span>
            )}
          </button>

          {CATEGORY_NAV_ITEMS.map((item) => {
            const target = `/library/${item.category}`;
            const count =
              snapshot?.assets.filter((a) => a.category === item.category)
                .length ?? 0;
            return (
              <button
                key={item.category}
                type="button"
                className={`nav-link ${cleanPath === target ? 'active' : ''}`}
                onClick={() => handleNav(target)}
              >
                {item.icon}
                <span>{item.label}</span>
                {snapshot && <span className="nav-link-count">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-section-label">Workspace</div>
          <button
            type="button"
            className={`nav-link ${
              cleanPath.startsWith('/builder') ? 'active' : ''
            }`}
            onClick={() => handleNav('/builder')}
          >
            <Clapperboard size={18} />
            <span>Scene Builder</span>
          </button>
          <button
            type="button"
            className={`nav-link ${cleanPath === '/scenes' ? 'active' : ''}`}
            onClick={() => handleNav('/scenes')}
          >
            <Film size={18} />
            <span>Saved Scenes</span>
            {snapshot && (
              <span className="nav-link-count">{snapshot.scenes.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`nav-link ${cleanPath === '/templates' ? 'active' : ''}`}
            onClick={() => handleNav('/templates')}
          >
            <LayoutTemplate size={18} />
            <span>Templates</span>
            {snapshot && (
              <span className="nav-link-count">
                {snapshot.templates.length}
              </span>
            )}
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-label">Organize</div>
          <button
            type="button"
            className={`nav-link ${
              cleanPath.startsWith('/collections') ? 'active' : ''
            }`}
            onClick={() => handleNav('/collections')}
          >
            <FolderKanban size={18} />
            <span>Collections</span>
            {snapshot && (
              <span className="nav-link-count">
                {snapshot.collections.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`nav-link ${cleanPath === '/favorites' ? 'active' : ''}`}
            onClick={() => handleNav('/favorites')}
          >
            <Heart size={18} />
            <span>Favorites</span>
            {snapshot && (
              <span className="nav-link-count">
                {snapshot.assets.filter((a) => a.favorite).length +
                  snapshot.variants.filter((v) => v.favorite).length}
              </span>
            )}
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="local-storage-badge">
            <strong>
              <HardDrive size={14} /> Stored on this browser
            </strong>
            <span>
              Local IndexedDB storage is not cloud sync or a backup. Another
              browser or app URL has a separate library.
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setDrawerOpen(false);
                setIsSettingsOpen(true);
              }}
            >
              <Settings size={14} /> Settings & Backup (.zip)
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main-wrapper">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn mobile-menu-btn"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label="Toggle navigation menu"
            >
              {drawerOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--text-muted)',
              }}
            >
              KRAKINAI • Personal Visual Prompt Library
            </span>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleNav('/builder')}
            >
              <Layers size={15} /> Scene Builder
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleNav('/prompts/new')}
            >
              <Plus size={15} /> New Prompt
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open Settings and ZIP Backup"
              title="Settings & ZIP Backup"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <main className="app-content" role="main">
          {storageError && (
            <div className="banner banner-error" role="alert">
              <div>
                <strong>Storage Error / Limited Session Mode:</strong>{' '}
                {storageError}
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 80,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxWidth: 380,
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`banner banner-${t.type}`}
              style={{
                marginBottom: 0,
                boxShadow: 'var(--shadow-modal)',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                }}
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <SettingsBackupModal />
      <CollectionMembershipModal />
      <ClipboardFallbackModal />
      <ConfirmModal />
    </div>
  );
};
