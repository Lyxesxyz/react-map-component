import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { topicSchema } from 'starlight-sidebar-topics/schema'

// Starlight's docs collection, with two more frontmatter fields:
// - `topic` (starlight-sidebar-topics): the sidebar topic of a page no topic lists;
// - `framework`: set on the pages generated from a folder (src/guides), so components can show
//   which framework a page is for (`Astro.locals.starlightRoute.entry.data.framework`).
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: topicSchema.extend({ framework: z.enum(['react', 'angular']).optional() }),
    }),
  }),
}
