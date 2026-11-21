import { InputError } from '../domain/InputError.js';

export class InputViewService {
  constructor(source, { ttlMs = 60000, maxViews = 4 } = {}) {
    Object.assign(this, { source, ttlMs, maxViews });
    this.views = new Map();
    this.opening = 0;
  }

  async open(selection) {
    if (this.views.size + this.opening >= this.maxViews)
      throw new InputError('INPUT_SOURCE_UNAVAILABLE', 'Planning read capacity is temporarily exhausted.', 503);
    this.opening++;
    try {
      const view = await this.source.open(selection);
      const timer = setTimeout(() => this.close(view.info.viewId).catch(() => {}), this.ttlMs);
      timer.unref();
      this.views.set(view.info.viewId, { view, timer, expiresAt: Date.now() + this.ttlMs, busy: false });
      return view.info;
    } finally { this.opening--; }
  }

  async read(id, group, productIds, sizeIds) {
    const entry = this.views.get(id);
    if (!entry || Date.now() >= entry.expiresAt)
      throw new InputError('READ_VIEW_EXPIRED', 'The read view is absent or expired; restart the entire capture.', 409);
    if (entry.busy) throw new InputError('READ_VIEW_BUSY', 'Reads in a view must be sequential.', 409);
    entry.busy = true;
    try { return { viewId: id, revision: entry.view.info.revision,
      items: await entry.view.read(group, productIds, sizeIds) }; }
    finally { entry.busy = false; }
  }

  async close(id) {
    const entry = this.views.get(id);
    if (!entry) return;
    this.views.delete(id);
    clearTimeout(entry.timer);
    await entry.view.close();
  }

  async dispose() { await Promise.all([...this.views.keys()].map((id) => this.close(id))); }
}
