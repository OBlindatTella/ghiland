import publicUrls from './scripts/postcss-public-urls.mjs';

const config = {
  plugins: [['@tailwindcss/postcss', {}], publicUrls()],
};

export default config;
