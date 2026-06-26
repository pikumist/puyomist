import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/app/globals.css';

/**
 * Toggle the `.dark` class on <html> to mirror next-themes' class strategy,
 * so stories preview both light and dark token sets from the toolbar.
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' }
        ],
        dynamicTitle: true
      }
    }
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as 'light' | 'dark';
      useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
      }, [theme]);
      return <Story />;
    }
  ]
};

export default preview;
