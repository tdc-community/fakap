import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getNewsArticleById } from '@features/news/services/news.service';

type NewsDetailProps = {
  id: string;
};

function formatNewsDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(new Date(iso));
}

export function NewsDetail({ id }: NewsDetailProps): ReactElement {
  const articleQuery = useQuery({
    queryKey: ['news', 'article', id],
    queryFn: async () => getNewsArticleById(id),
    enabled: Boolean(id),
  });

  if (articleQuery.isLoading) {
    return (
      <section className="news-detail-empty" aria-live="polite">
        <h1>Loading article...</h1>
      </section>
    );
  }

  if (articleQuery.isError) {
    return (
      <section className="news-detail-empty" aria-live="polite">
        <h1>Failed to load article</h1>
        <p className="muted">Please try again in a moment.</p>
      </section>
    );
  }

  const article = articleQuery.data;

  if (!article) {
    return (
      <section className="news-detail-empty" aria-live="polite">
        <nav className="news-breadcrumb" aria-label="Breadcrumb">
          <div className="news-breadcrumb-list">
            <span>
              <Link to="/">Home</Link>
            </span>
            <span className="news-breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <span>
              <Link to="/">News</Link>
            </span>
            <span className="news-breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <span className="news-breadcrumb-current" aria-current="page">
              Unknown article
            </span>
          </div>
        </nav>

        <h1>Article not found</h1>
        <p className="muted">The requested news article does not exist or may have been removed.</p>
        <Link className="btn btn-ghost news-empty-back-link" to="/">
          Back to News
        </Link>
      </section>
    );
  }

  return (
    <article className="news-detail-page">
      <nav className="news-breadcrumb" aria-label="Breadcrumb">
        <div className="news-breadcrumb-list">
          <span>
            <Link to="/">Home</Link>
          </span>
          <span className="news-breadcrumb-separator" aria-hidden="true">
            /
          </span>
          <span>
            <Link to="/">News</Link>
          </span>
          <span className="news-breadcrumb-separator" aria-hidden="true">
            /
          </span>
          <span className="news-breadcrumb-category">{article.category}</span>
          <span className="news-breadcrumb-separator" aria-hidden="true">
            /
          </span>
          <span className="news-breadcrumb-current" aria-current="page">
            {article.title}
          </span>
        </div>
      </nav>

      <section className="news-detail-article card">
        <header className="news-detail-header">
          <span className="news-category">{article.category}</span>
          <h1>{article.title}</h1>
          <p className="news-detail-summary muted">{article.summary}</p>
          <div className="news-meta muted">
            <span className="news-meta-item news-meta-author">By {article.author}</span>
            <time className="news-meta-date" dateTime={article.publishedAt}>
              {formatNewsDate(article.publishedAt)}
            </time>
          </div>
        </header>

        <figure className="news-detail-media">
          <img src={article.imageUrl} alt={article.title} className="news-detail-image" />
        </figure>

        <div className="news-detail-content">
          {article.content.map((paragraph, index) => (
            <p key={`${article.id}-${index}`}>{paragraph}</p>
          ))}
        </div>
      </section>
    </article>
  );
}
