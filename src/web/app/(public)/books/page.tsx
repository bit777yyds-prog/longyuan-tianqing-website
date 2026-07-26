import { BookCard } from '@/components/business/book-card';
import { books } from '@/lib/fixtures/books';

export const metadata = {
  title: '书籍 - 龙渊天青',
};

export default function BooksPage() {
  return (
    <div className="px-4 py-12 md:px-8 lg:px-16">
      <div className="mx-auto max-w-content">
        <h1 className="font-serif text-3xl font-semibold text-text md:text-h1">书籍</h1>
        <p className="mt-3 text-text-muted">龙渊天青系列出版物与研究项目。</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </div>
  );
}
