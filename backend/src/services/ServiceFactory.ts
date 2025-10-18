// src/services/ServiceFactory.ts - ENHANCED
export class ServiceFactory {
  private static instances: Map<string, any> = new Map();

  static getService<T>(
    ServiceClass: new (...args: any[]) => T, 
    ...args: any[]
  ): T {
    const key = ServiceClass.name + JSON.stringify(args);
    if (!this.instances.has(key)) {
      const instance = new ServiceClass(...args);
      this.instances.set(key, instance);
      console.log(`✅ Created singleton instance of ${ServiceClass.name}`);
    }
    return this.instances.get(key);
  }

  static clearInstances() {
    this.instances.clear();
  }
}