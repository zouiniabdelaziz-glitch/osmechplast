import {
  articleUrl,
  isPublished,
  validateArticle,
} from '../../scripts/wissen-content.mjs';

export default {
  tags: ['wissen'],
  pageType: 'article',
  eleventyComputed: {
    layout(data) {
      return isPublished(data) ? 'wissen/article.njk' : false;
    },
    permalink(data) {
      if (!isPublished(data)) return false;
      validateArticle(data, data.page?.inputPath || 'knowledge article');
      return `${articleUrl(data).replace(/^\//, '')}index.html`;
    },
    eleventyExcludeFromCollections(data) {
      return !isPublished(data);
    },
  },
};
