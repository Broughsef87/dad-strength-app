import type { MetadataRoute } from 'next';

const SITE = 'https://www.dadstrength.tech';

// Public pages only. Everything else sits behind sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/disclaimer`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
