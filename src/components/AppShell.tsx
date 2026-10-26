import React, { useEffect, useRef, useState } from 'react';
import '../studio.css';
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
  PanelLeftClose,
  PanelLeftOpen,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia?.('(max-width: 767px)').matches ?? false
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 767px)');
    if (!query) return;
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setDrawerOpen(false);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.inert = mobile && !drawerOpen;
    if (!mobile || !drawerOpen) return;
    const main = mainRef.current;
    const priorInert = main?.inert ?? false;
    const priorOverflow = document.body.style.overflow;
    if (main) main.inert = true;
    document.body.style.overflow = 'hidden';
    const controls = () => [
      ...(sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled)'
      ) ?? []),
    ];
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
      }
      if (event.key === 'Tab') {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (main) main.inert = priorInert;
      document.body.style.overflow = priorOverflow;
      menuRef.current?.focus();
    };
  }, [mobile, drawerOpen]);

  const cleanPath = hashPath.split('?')[0];

  const handleNav = (target: string) => {
    setDrawerOpen(false);
    navigate(target);
  };

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}
    >
      {drawerOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 25 }}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="primary-navigation"
        ref={sidebarRef}
        className={`app-sidebar ${drawerOpen ? 'drawer-open' : ''}`}
        aria-label="Primary Sidebar Navigation"
        role={mobile && drawerOpen ? 'dialog' : undefined}
        aria-modal={mobile && drawerOpen ? true : undefined}
        aria-hidden={mobile && !drawerOpen ? true : undefined}
      >
        {mobile && drawerOpen && (
          <button
            type="button"
            className="icon-btn mobile-nav-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
        <a
          href="#/"
          className="app-brand"
          aria-label="KRAKINAI Home"
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
            aria-label="Home"
            title="Home"
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
            aria-label="All Prompts"
            title="All Prompts"
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
                aria-label={item.label}
                title={item.label}
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
            aria-label="Scene Builder"
            title="Scene Builder"
          >
            <Clapperboard size={18} />
            <span>Scene Builder</span>
          </button>
          <button
            type="button"
            className={`nav-link ${cleanPath === '/scenes' ? 'active' : ''}`}
            onClick={() => handleNav('/scenes')}
            aria-label="Saved Scenes"
            title="Saved Scenes"
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
            aria-label="Templates"
            title="Templates"
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
            aria-label="Collections"
            title="Collections"
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
            aria-label="Favorites"
            title="Favorites"
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

      <div className="app-main-wrapper" ref={mainRef}>
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn desktop-sidebar-toggle"
              aria-label={
                sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
              aria-expanded={!sidebarCollapsed}
              aria-controls="primary-navigation"
              onClick={() => setSidebarCollapsed((value) => !value)}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <button
              ref={menuRef}
              type="button"
              className="icon-btn mobile-menu-btn"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="primary-navigation"
            >
              {drawerOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
