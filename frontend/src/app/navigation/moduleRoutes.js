// Table 1 of the Sprint 2 specification. WEB03 can consume these entries
// in its navigation policy without duplicating their paths or permissions.
export const moduleRoutes = [
  {
    id: 'kitchenViewer',
    path: '/kitchen/viewer',
    label: 'Kitchen viewer',
    labelKey: 'viewer',
    roles: ['EMPLOYEE', 'MANAGER'],
  },
  {
    id: 'kitchenConfigurations',
    path: '/kitchen/configurations',
    label: 'Kitchen configurations',
    labelKey: 'kitchenConfigurations',
    // WEB06 supplies the loader and the views for these documented URLs.
    childPaths: ['new', ':configurationId'],
    roles: ['MANAGER'],
  },
  {
    id: 'planning',
    path: '/planning',
    label: 'Planning',
    labelKey: 'planning',
    roles: ['MANAGER'],
  },
];