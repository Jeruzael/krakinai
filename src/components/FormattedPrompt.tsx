import React from 'react';

/** Presentation only: all user content stays in escaped React text nodes. */
export function FormattedPrompt({ text }: { text: string }) {
  const lines = text.split('\n');
  let inDialogue = false;
  return (
    <div className="formatted-prompt">
      {lines.map((line, index) => {
        const heading = /^\s*(?:===\s*(.*?)\s*===|#{1,3}\s+(.+))\s*$/.exec(
          line
        );
        if (heading) {
          const title = heading[1] ?? heading[2];
          inDialogue = /dialogue|spoken/i.test(title);
          return (
            <h2 className="formatted-prompt-heading" key={index}>
              {title}
            </h2>
          );
        }
        const parts = line
          .split(/(\*\*[^*]+\*\*)/g)
          .map((part, partIndex) =>
            /^\*\*[^*]+\*\*$/.test(part) ? (
              <strong key={partIndex}>{part.slice(2, -2)}</strong>
            ) : (
              part
            )
          );
        const label = /^([^:]{1,45}:)(.*)$/.exec(line);
        return (
          <div
            className={`formatted-prompt-line${inDialogue ? ' formatted-prompt-dialogue' : ''}`}
            key={index}
          >
            {label ? (
              <>
                <strong>{label[1]}</strong>
                {label[2]}
              </>
            ) : (
              parts
            )}
            {line === '' ? '\u00a0' : null}
          </div>
        );
      })}
    </div>
  );
}
