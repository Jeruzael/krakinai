import React from "react";
export const CinematographyTabs: React.FC<{
  id: string;
  label: string;
  value: string;
  tabs: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ id, label, value, tabs, onChange }) => (
  <div
    className="cinema-tabs"
    role="tablist"
    aria-label={label}
    onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      const elements = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "[role=tab]",
          ),
        ],
        index = elements.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? elements.length - 1
            : (index +
                (event.key === "ArrowRight" ? 1 : -1) +
                elements.length) %
              elements.length;
      elements[next].focus();
      elements[next].click();
    }}
  >
    {tabs.map((tab) => (
      <button
        type="button"
        role="tab"
        key={tab.value}
        id={`${id}-${tab.value}`}
        aria-controls={`${id}-${tab.value}-panel`}
        aria-selected={value === tab.value}
        tabIndex={value === tab.value ? 0 : -1}
        onClick={() => onChange(tab.value)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
