import React from 'react';

export const useViewportSize = () => {
  const [size, setSize] = React.useState(() => ({
    width: typeof window === 'undefined' ? 1440 : Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: typeof window === 'undefined' ? 900 : Math.round(window.visualViewport?.height ?? window.innerHeight),
  }));

  React.useEffect(() => {
    const onResize = () => {
      setSize({
        width: Math.round(window.visualViewport?.width ?? window.innerWidth),
        height: Math.round(window.visualViewport?.height ?? window.innerHeight),
      });
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
    };
  }, []);

  return size;
};
