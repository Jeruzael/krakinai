import React, { useMemo, useState } from "react";
import type { ShotType } from "../types/domain";
import {
  CINEMATOGRAPHY_FAMILIES,
  getCinematographyTechnique,
  searchCinematography,
  type CinematographyFamilyId,
} from "../domain/cinematographyRegistry";
import { SHOT_TYPES, SHOT_TYPE_LABELS } from "../domain/shotTypeRules";
import "./cinematography.css";
export interface CinematographyExplorerProps {
  onCompose: (techniqueId?: string) => void;
  onBrowseOwner?: (owner: "lighting" | "styles" | "storyboard") => void;
  initialShotType?: ShotType;
}
const PREFERENCES = "krakinai.cinematography.ui.v1";
function preferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFERENCES) ?? "{}");
    return {
      favorites: Array.isArray(raw.favorites)
        ? (raw.favorites
            .filter(
              (id: unknown) =>
                typeof id === "string" && getCinematographyTechnique(id),
            )
            .slice(0, 200) as string[])
        : [],
      recent: Array.isArray(raw.recent)
        ? (raw.recent
            .filter(
              (id: unknown) =>
                typeof id === "string" && getCinematographyTechnique(id),
            )
            .slice(0, 12) as string[])
        : [],
    };
  } catch {
    return { favorites: [] as string[], recent: [] as string[] };
  }
}
export const CinematographyExplorer: React.FC<CinematographyExplorerProps> = ({
  onCompose,
  onBrowseOwner,
  initialShotType,
}) => {
  const [query, setQuery] = useState(""),
    [family, setFamily] = useState<CinematographyFamilyId | "">(""),
    [shotType, setShotType] = useState<ShotType | "all">(
      initialShotType ?? "all",
    ),
    [property, setProperty] = useState(false),
    [favoritesOnly, setFavoritesOnly] = useState(false),
    [saved, setSaved] = useState(preferences);
  const matches = useMemo(
    () =>
      searchCinematography(query, {
        family: family || undefined,
        shotType: shotType === "all" ? undefined : shotType,
        propertyRecommended: property,
      }).filter((t) => !favoritesOnly || saved.favorites.includes(t.id)),
    [query, family, shotType, property, favoritesOnly, saved.favorites],
  );
  const write = (next: ReturnType<typeof preferences>) => {
    setSaved(next);
    try {
      localStorage.setItem(PREFERENCES, JSON.stringify(next));
    } catch {
      /* UI preferences remain usable for this session. */
    }
  };
  const compose = (id?: string) => {
    if (id)
      write({
        ...saved,
        recent: [id, ...saved.recent.filter((v) => v !== id)].slice(0, 12),
      });
    onCompose(id);
  };
  const browse = (
    owner: "lighting" | "styles" | "storyboard",
    event: React.MouseEvent,
  ) => {
    if (onBrowseOwner) {
      event.preventDefault();
      onBrowseOwner(owner);
    }
  };
  return (
    <section
      className="cinema-explorer"
      aria-label="Cinematography technique explorer"
    >
      <div className="cinema-heading">
        <div>
          <h1 className="page-title">Camera &amp; Cinematography</h1>
          <p className="muted-text">
            Explore techniques independently, then compose directions for one
            scene. Your reusable Camera presets remain separate.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => compose()}>
          Compose Camera directions
        </button>
      </div>
      <div className="card cinema-filters">
        <label>
          Search cinematography techniques
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="MCU, focus pull, dolly zoom…"
          />
        </label>
        <label>
          Technique family
          <select
            className="select"
            value={family}
            onChange={(e) =>
              setFamily(e.target.value as CinematographyFamilyId | "")
            }
          >
            <option value="">All families</option>
            {CINEMATOGRAPHY_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Filter by Shot Type
          <select
            className="select"
            value={shotType}
            onChange={(e) => setShotType(e.target.value as ShotType | "all")}
          >
            <option value="all">All Shot Types</option>
            {SHOT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SHOT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <div className="cinema-checks">
          <label>
            <input
              type="checkbox"
              checked={property}
              onChange={(e) => setProperty(e.target.checked)}
            />{" "}
            Property recommendations
          </label>
          <label>
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />{" "}
            Favorites only
          </label>
        </div>
      </div>
      {saved.recent.length > 0 && (
        <div
          className="cinema-recents"
          role="region"
          aria-label="Recent techniques"
        >
          <span className="muted-text">Recent</span>
          {saved.recent.slice(0, 5).map((id) => {
            const t = getCinematographyTechnique(id)!;
            return (
              <button
                className="btn btn-secondary btn-sm"
                key={id}
                onClick={() => compose(id)}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}
      <p className="muted-text" role="status">
        {matches.length} matching coverage items. Techniques, optional controls
        and related planning guidance are distinct. These are planning
        descriptors, not guaranteed provider controls.
      </p>
      {matches.length === 0 && (
        <div className="card">
          <p>No techniques match these filters.</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setQuery("");
              setFamily("");
              setShotType("all");
              setProperty(false);
              setFavoritesOnly(false);
            }}
          >
            Clear technique filters
          </button>
        </div>
      )}
      {CINEMATOGRAPHY_FAMILIES.map((f) => {
        const entries = matches.filter((t) => t.family === f.id);
        if (!entries.length) return null;
        return (
          <details
            key={f.id}
            className="card cinema-family"
            open={query.trim() || family || favoritesOnly ? true : undefined}
          >
            <summary>
              {f.name}
              <span className="badge" aria-label={`${entries.length} items`}>
                {entries.length}
              </span>
            </summary>
            <div className="cinema-techniques">
              {entries.map((t) => (
                <article className="cinema-technique" key={t.id}>
                  <div className="cinema-technique-title">
                    <h2>{t.name}</h2>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${saved.favorites.includes(t.id) ? "Unfavorite" : "Favorite"} ${t.name}`}
                      aria-pressed={saved.favorites.includes(t.id)}
                      onClick={() =>
                        write({
                          ...saved,
                          favorites: saved.favorites.includes(t.id)
                            ? saved.favorites.filter((id) => id !== t.id)
                            : [...saved.favorites, t.id].slice(-200),
                        })
                      }
                    >
                      {saved.favorites.includes(t.id) ? "★" : "☆"}
                    </button>
                  </div>
                  <div className="cinema-badges">
                    <span className="badge">
                      {t.kind === "parameter"
                        ? "Optional control"
                        : t.owner === "camera"
                          ? t.method === "editing"
                            ? "Editing direction"
                            : t.method === "simulation"
                              ? "Simulation"
                              : "Capture / planning"
                          : "Related planning"}
                    </span>
                    <span className="badge">
                      {t.owner === "styles"
                        ? "Art Styles"
                        : t.owner === "lighting"
                          ? "Lighting & Mood"
                          : t.owner === "storyboard"
                            ? "Storyboard"
                            : "Camera"}
                    </span>
                  </div>
                  <p>{t.description}</p>
                  <details className="cinema-guidance">
                    <summary>Aliases &amp; compatibility</summary>
                    <p>
                      {t.aliases.length
                        ? t.aliases.join(", ")
                        : "Searchable by its canonical name."}
                    </p>
                    <p>{t.guidance}</p>
                    <p className="muted-text">
                      {t.shotTypes
                        .map((type) => SHOT_TYPE_LABELS[type])
                        .join(" · ")}
                    </p>
                  </details>
                  {t.owner === "camera" ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        compose(t.kind === "parameter" ? undefined : t.id)
                      }
                      aria-label={
                        t.kind === "parameter"
                          ? `Edit ${t.name} in composer`
                          : `Compose with ${t.name}`
                      }
                    >
                      {t.kind === "parameter"
                        ? "Edit in composer"
                        : "Compose for scene"}
                    </button>
                  ) : (
                    <a
                      className="btn btn-secondary btn-sm"
                      href={
                        t.owner === "storyboard"
                          ? "#/collections"
                          : `#/library/${t.owner}`
                      }
                      onClick={(e) =>
                        browse(
                          t.owner as "lighting" | "styles" | "storyboard",
                          e,
                        )
                      }
                    >
                      {t.owner === "lighting"
                        ? "Browse Lighting & Mood"
                        : t.owner === "styles"
                          ? "Browse Art Styles"
                          : "Browse Storyboard projects"}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </details>
        );
      })}
      <p className="muted-text cinema-footnote">
        Technique favorites and recents are browser UI preferences. They do not
        alter library assets and are not part of a full-library backup.
      </p>
    </section>
  );
};
