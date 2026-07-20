export interface RecipeMeta {
  /** Folder name under src/recipes/ and the URL slug (/recipes/<slug>/). */
  slug: string;
  /** Shown in the nav bar, sidebar and page title. */
  title: string;
  /** One sentence; becomes the page description and llms.txt entry. */
  blurb: string;
}

export const recipes: RecipeMeta[] = [
  {
    slug: 'hero',
    title: 'Extend a function from outside',
    blurb: 'Wrap a function with capable(), then replace, augment and transform it from a registry in scope.',
  },
];
