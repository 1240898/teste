export function getActive(request, signal) {
  return request('GET', '/kitchen-configurations/active', { signal });
}