import { myclBundle } from '../playground/deps';

// One blob URL for the @mycl/core bundle (main + /helpers), shared by every
// runner instance on a page.
let bundleUrl: string | null = null;
export function getBundleUrl(): string {
  if (!bundleUrl) {
    bundleUrl = URL.createObjectURL(new Blob([myclBundle], { type: 'text/javascript' }));
  }
  return bundleUrl;
}
