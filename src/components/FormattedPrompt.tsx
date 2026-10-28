import React from 'react';

/** Presentation only: all user content stays in escaped React text nodes. */
export function FormattedPrompt({
  text,
  anchors,
  headingLevel = 2,
}: {
  text: string;
  anchors?: ReadonlyMap<number, string>;
  headingLevel?: 2 | 3;
}) {
  const lines = text.split('\n');
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
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
            <Heading
              id={anchors?.get(index)}
              tabIndex={anchors?.has(index) ? -1 : undefined}
              className="formatted-prompt-heading"
              key={index}
            >
              {title}
            </Heading>
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
            id={anchors?.get(index)}
            tabIndex={anchors?.has(index) ? -1 : undefined}
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
