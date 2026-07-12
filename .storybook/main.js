/** @type { import('@storybook/web-components-vite').StorybookConfig } */
const config = {
  stories: ['../packages/lyra-ui/src/components/**/*.stories.ts', '../.storybook/*.mdx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
};

export default config;
