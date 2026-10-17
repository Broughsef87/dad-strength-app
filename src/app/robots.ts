import type { MetadataRoute } from 'next';

// Signed-in routes already redirect anonymous visitors to / in middleware;
// disallowing them keeps crawlers from spending time on those redirects.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/', '/monitoring', '/dashboard', '/body', '/profile', '/workout',
        '/edit-program', '/onboarding', '/history', '/library', '/build',
        '/schedule', '/exercises', '/train', '/fuel', '/mind', '/spirit',
        '/design-proof',
      ],
    },
    sitemap: 'https://www.dadstrength.tech/sitemap.xml',
  };
}
