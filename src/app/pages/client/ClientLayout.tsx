import React, { ReactNode } from 'react';
import { Box } from 'folds';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  return (
    <Box grow="Yes" data-ui-option-shell>
      <Box shrink="No">{nav}</Box>
      <Box grow="Yes">{children}</Box>
    </Box>
  );
}
