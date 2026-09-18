export class FakeR2Bucket {
  constructor(options = {}) { this.objects = new Map(); this.options = options; }
  async put(key, value, options = {}) {
    if (this.options.failPut) throw new Error('r2_put_failed');
    if (this.objects.has(key)) throw new Error('object_exists');
    const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, { bytes, httpMetadata: options.httpMetadata || {} });
  }
  async get(key) {
    const object = this.objects.get(key);
    return object ? { body: new Uint8Array(object.bytes), httpMetadata: object.httpMetadata } : null;
  }
  async delete(key) { this.objects.delete(key); }
  async list() { return { objects: [...this.objects.keys()].map(key => ({ key })) }; }
}
