import { prevNext } from './tree.mjs';
import { recipes } from '../recipes/manifest';

/**
 * Slim recipe pager: prev/next links to neighboring recipes. The recipe title is
 * the real Starlight page <h1> above the IDE, so it is not repeated here. Renders
 * nothing when a recipe has no neighbors (e.g. a lone recipe).
 */
export default function RecipeNav({ slug }: { slug: string }) {
  const { prev, next } = prevNext(recipes, slug);
  if (!prev && !next) return null;
  return (
    <div className="rcp-nav">
      <nav className="rcp-nav-pagers" aria-label="Recipes">
        {prev && (
          <a className="rcp-pager" href={`/recipes/${prev.slug}/`}>
            <span aria-hidden="true">&lsaquo;</span>
            <span className="rcp-pager-title">{prev.title}</span>
          </a>
        )}
        {next && (
          <a className="rcp-pager" href={`/recipes/${next.slug}/`}>
            <span className="rcp-pager-title">{next.title}</span>
            <span aria-hidden="true">&rsaquo;</span>
          </a>
        )}
      </nav>
    </div>
  );
}
