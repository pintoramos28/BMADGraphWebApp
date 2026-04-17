export const ROUTES = {
  home: '/',
  workspaceIndex: '/workspace',
  workspaceDetail: '/workspace/:workspaceId',
  reviewDetail: '/review/:workspaceId',
  unsupported: '/unsupported',
} as const;

export const routePath = {
  workspace: (workspaceId: string) => `/workspace/${workspaceId}`,
  review: (workspaceId: string) => `/review/${workspaceId}`,
} as const;
