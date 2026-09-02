import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

export default {
  url: 'https://osmechplast.com',
  name: 'OS.MECHPLAST',
  legalName: 'OS.MECHPLAST SRLS',
  organizationId: 'https://osmechplast.com/#organization',
  websiteId: 'https://osmechplast.com/#website',
  headerHtml: readFileSync(path.join(root, 'modules', 'header.html'), 'utf8'),
  footerHtml: readFileSync(path.join(root, 'modules', 'footer.html'), 'utf8'),
};
