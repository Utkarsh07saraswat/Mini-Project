const { AsyncLocalStorage } = require('async_hooks');

// Create async local storage for tenant context
const tenantStorage = new AsyncLocalStorage();

class TenantContext {
  static run(tenantId, callback) {
    return tenantStorage.run({ tenantId }, callback);
  }

  static get() {
    return tenantStorage.getStore();
  }

  static getTenantId() {
    const context = this.get();
    if (!context || !context.tenantId) {
      throw new Error('Tenant context not found - potential isolation breach');
    }
    return context.tenantId;
  }

  static requireTenant() {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error('Access denied: No tenant context');
    }
    return tenantId;
  }

  /**
   * Captures the current tenant context and returns a function
   * that restores the context when executed.
   */
  static bind(fn) {
    const tenantId = this.requireTenant();
    return (...args) => this.run(tenantId, () => fn(...args));
  }

  /**
   * Wraps an EventEmitter to ensure all listeners added hereafter
   * inherit the tenant context of where they were registered.
   */
  static wrapEmitter(emitter) {
    const originalOn = emitter.on;
    const self = this;
    emitter.on = function (event, listener) {
      return originalOn.call(this, event, self.bind(listener));
    };
    return emitter;
  }
}

module.exports = { TenantContext, tenantStorage };
