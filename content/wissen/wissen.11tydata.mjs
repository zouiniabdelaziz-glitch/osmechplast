import {
  articleUrl,
  isPublished,
  validateArticle,
} from '../../scripts/wissen-content.mjs';
import { isLocalPreview, draftUrl } from '../../scripts/preview-mode.mjs';

export default {
  tags: ['wissen'],
  pageType: 'article',
  eleventyComputed: {
    layout(data) {
      return isPublished(data) ? 'wissen/article.njk' : (isLocalPreview() ? 'wissen/draft.njk' : false);
    },
    permalink(data) {
      if (!isPublished(data)) return isLocalPreview() ? `${draftUrl(data).slice(1)}index.html` : false;
      validateArticle(data, data.page?.inputPath || 'knowledge article');
      return `${articleUrl(data).replace(/^\//, '')}index.html`;
    },
    eleventyExcludeFromCollections(data) {
      return !isPublished(data) && !isLocalPreview();
    },
  },
};
