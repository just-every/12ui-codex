export const inAppBrowserAction = (url: string): string => (
  `Open this URL in the Codex in-app browser now: ${url}`
);

export const userVisibleBrowserAction = (url: string, nextStep: string): string => (
  `${inAppBrowserAction(url)} Also show the link to the user so they can ${nextStep}.`
);
