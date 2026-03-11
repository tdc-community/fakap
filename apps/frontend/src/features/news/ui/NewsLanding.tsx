import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNewsHomepage } from '@features/news/services/news.service';

function formatNewsDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(iso));
}

export function NewsLanding(): ReactElement {
  const homepageQuery = useQuery({
    queryKey: ['news', 'public-home'],
    queryFn: getNewsHomepage,
  });

  if (homepageQuery.isLoading) {
    return (
      <section className="news-page" aria-live="polite">
        <h1 className="page-title news-page-title">Home</h1>
        <p className="muted news-page-subtitle">Loading news...</p>
      </section>
    );
  }

  if (homepageQuery.isError || !homepageQuery.data) {
    return (
      <section className="news-page" aria-live="polite">
        <h1 className="page-title news-page-title">Home</h1>
        <p className="save-error">Failed to load news homepage.</p>
      </section>
    );
  }

  const { hero, featured, list } = homepageQuery.data;

  return (
    <section className="news-page" aria-labelledby="news-page-title">
      <h1 id="news-page-title" className="page-title news-page-title">
        Home
      </h1>
      <p className="muted news-page-subtitle">Latest server stories, community highlights, and event updates.</p>

      <div className="news-grid-top">
        <a className="news-hero-card" href={`/news/${hero.id}`}>
          <div className="news-card-media news-hero-media">
            <img src={hero.imageUrl} alt={hero.title} className="news-hero-image" />
          </div>
          <div className="news-card-body news-hero-content">
            <span className="news-category">{hero.category}</span>
            <h2>{hero.title}</h2>
            <p className="muted">{hero.summary}</p>
            <div className="news-meta muted">
              <span>{hero.author}</span>
              <span>{formatNewsDate(hero.publishedAt)}</span>
            </div>
          </div>
        </a>

        <div className="news-featured-stack">
          {featured.map((article) => (
            <a key={article.id} className="news-featured-card" href={`/news/${article.id}`}>
              <div className="news-card-media news-featured-media">
                <img src={article.imageUrl} alt={article.title} className="news-featured-image" />
              </div>
              <div className="news-card-body news-featured-content">
                <span className="news-category">{article.category}</span>
                <h3>{article.title}</h3>
                <p className="muted">{article.summary}</p>
                <div className="news-meta muted">
                  <span>{article.author}</span>
                  <span>{formatNewsDate(article.publishedAt)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="news-list" aria-label="More news">
        {list.map((article) => (
          <a key={article.id} className="news-list-row" href={`/news/${article.id}`}>
            <div className="news-card-media news-list-media">
              <img src={article.imageUrl} alt={article.title} className="news-list-thumb" />
            </div>
            <div className="news-card-body news-list-content">
              <h3>{article.title}</h3>
              <p className="muted">{article.summary}</p>
              <div className="news-meta muted">
                <span>{article.author}</span>
                <span>{formatNewsDate(article.publishedAt)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
