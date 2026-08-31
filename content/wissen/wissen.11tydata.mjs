import {
  articleUrl,
  isPublished,
  validateArticle,
} from '../../scripts/wissen-content.mjs';

export default {
  tags: ['wissen'],
  layout: 'wissen/article.njk',
  pageType: 'article',
  eleventyComputed: {
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

