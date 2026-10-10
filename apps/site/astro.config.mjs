// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig, passthroughImageService } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'
import starlightSidebarTopics from 'starlight-sidebar-topics'
import { base, branch, repository, site } from './site.config.mjs'
import { guides } from './src/integrations/guides.mjs'
import { topics, topicsOptions } from './src/sidebar.mjs'

// The docs site. The guides of both folders are copied in by `guides()` (src/integrations/guides.mjs);
// the landing page and the examples embed the demos, which scripts/build.mjs builds next to the site
// at <base>/demo/react/ and <base>/demo/angular/.
export default defineConfig({
  site,
  base,
  image: { service: passthroughImageService() },
  integrations: [
    guides(),
    starlight({
      title: 'Geospatial map',
      description:
        'An OpenLayers map component for indicator pages, for React and Angular: copy one folder into your app and own the code.',
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: repository }],
      editLink: { baseUrl: `${repository}/edit/${branch}/apps/site/` },
      lastUpdated: true,
      customCss: ['@fontsource-variable/inter/index.css', './src/styles/theme.css'],
      components: {},
      plugins: [
        starlightSidebarTopics(topics, topicsOptions),
        starlightLinksValidator({ exclude: [`${base}/demo/**`] }),
      ],
    }),
  ],
})
