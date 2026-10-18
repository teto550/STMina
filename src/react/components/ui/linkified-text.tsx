import type { FC } from 'react';
import { splitLinks } from '@/react/lib/links';
import { cn } from '@/react/lib/utils';

type LinkifiedTextProps = {
  text: string;
  className?: string;
};

/** User text as plain text with its line breaks kept, where every web link is a tappable link that opens in a new tab. */
export const LinkifiedText: FC<LinkifiedTextProps> = ({ text, className }) => (
  <span className={cn('tw:whitespace-pre-line tw:break-words', className)}>
    {splitLinks(text).map((piece, i) =>
      piece.href ? (
        <a key={i} href={piece.href} target="_blank" rel="noopener noreferrer" dir="ltr" className="tw:break-all tw:font-normal tw:text-accent tw:underline">{piece.text}</a>
      ) : (
        piece.text
      )
    )}
  </span>
);
