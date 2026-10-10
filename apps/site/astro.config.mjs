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
const title = 'Geospatial map'

export default defineConfig({
  site,
  base,
  image: { service: passthroughImageService() },
  integrations: [
    guides({ siteTitle: title }),
    starlight({
      title,
      description:
        'An OpenLayers map component for indicator pages, for React and Angular: copy one folder into your app and own the code.',
      logo: { light: './src/assets/logo-light.svg', dark: './src/assets/logo-dark.svg' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: repository }],
      editLink: { baseUrl: `${repository}/edit/${branch}/apps/site/` },
      lastUpdated: true,
      customCss: ['@fontsource-variable/inter/index.css', './src/styles/theme.css'],
      components: {
        // The landing page's hero with the live demo; the React/Angular switch above a guide's
        // title; the sidebar's topics drawn as a switch (src/components).
        Hero: './src/components/Hero.astro',
        PageTitle: './src/components/PageTitle.astro',
        Sidebar: './src/components/Sidebar.astro',
      },
      head: [
        // The reader's framework (React or Angular, src/components/framework-choice.ts) on <html>
        // before the page paints, so content for the other framework never flashes.
        {
          tag: 'script',
          content: `try{var f=localStorage.getItem('starlight-synced-tabs__framework');document.documentElement.dataset.framework=f==='Angular'?'angular':'react'}catch(e){document.documentElement.dataset.framework='react'}`,
        },
      ],
      expressiveCode: {
        themes: ['github-dark-default', 'github-light-default'],
        // A guide's first-line comment stays in its code instead of becoming the block's title.
        frames: { extractFileNameFromCode: false },
        styleOverrides: {
          borderRadius: '0.75rem',
          borderColor: 'var(--site-line)',
          codeFontSize: '0.8125rem',
          frames: {
            frameBoxShadowCssValue: 'none',
            editorActiveTabIndicatorTopColor: 'transparent',
          },
        },
      },
      plugins: [
        starlightSidebarTopics(topics, topicsOptions),
        starlightLinksValidator({ exclude: [`${base}/demo/**`] }),
      ],
    }),
  ],
})
