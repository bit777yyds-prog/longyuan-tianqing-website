import * as React from 'react';
import Link from 'next/link';
import type { Book } from '@longyuan/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

export interface BookCardProps {
  book: Book;
  className?: string;
}

export function BookCard({ book, className }: BookCardProps) {
  return (
    <article
      className={cn(
        'group flex flex-col rounded-lg border border-border bg-surface p-4 transition-colors hover:border-celadon-500',
        className
      )}
    >
      <Link href={`/books/${book.id}`} className="block overflow-hidden rounded-md bg-bg">
        <div className="aspect-[3/4] w-full bg-celadon-100" />
      </Link>
      <div className="mt-4 flex flex-col gap-2">
        <StatusBadge status={book.status} />
        <h3 className="font-serif text-lg font-semibold leading-snug text-text group-hover:text-celadon-700">
          <Link href={`/books/${book.id}`}>{book.title}</Link>
        </h3>
        <p className="text-sm text-text-muted">{book.series}</p>
        <p className="line-clamp-2 text-sm text-text">{book.tagline}</p>
        {book.author && <p className="text-xs text-text-muted">{book.author} · {book.year}</p>}
      </div>
    </article>
  );
}
