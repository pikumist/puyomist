import {
  type ThemeComponents,
  type ThemeConfig,
  extendTheme
} from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false
};

const styles = {
  global: {
    body: {
      fontSize: '16px'
    }
  }
};

const components: ThemeComponents = {
  Select: {
    defaultProps: {
      size: 'sm'
    }
  },
  NumberInput: {
    defaultProps: {
      size: 'sm'
    }
  },
  Radio: {
    defaultProps: {
      size: 'sm'
    }
  }
};

const theme = extendTheme({ config, styles, components });

export default theme;
