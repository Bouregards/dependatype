import { ClassConstructor } from "../types/ClassConstructor";
import { Resolvable } from "../types/Resolvable";

type ResolveMechanism<T> = (container: ContainerInstance, ...dependencies: any[]) => T;

type ResolveConfig<T> = {
  target: Resolvable<T>;
  dependencies: Resolvable<unknown>[];
} & ({
  mechanism: ResolveMechanism<T>;
  async: false;
} | {
  mechanism: ResolveMechanism<Promise<T>>;
  async: true;
})

type ConstructorDependencies<T> = {
  target: Resolvable<T>;
  dependencies: Record<number, Resolvable<unknown>>; 
}

type ResolveConfigMap = Record<string, ResolveConfig<unknown>[]>;

type ResolvedInstance<T> = {
  target: Resolvable<T>;
  instance: T;
}

type ResolveMap = {
  resolved: Record<string, ResolvedInstance<unknown>[]>;
  resolving: Record<string, Resolvable<unknown>[]>;
}

interface IContainerInstance {
  resolveAsync: (type: ClassConstructor<unknown>) => Promise<unknown>;
  resolve: (type: ClassConstructor<unknown>) => unknown;
}

export class ContainerInstance implements IContainerInstance {
  private resolveConfig: ResolveConfigMap = {};
  private resolveMap: ResolveMap = {
    resolved: {},
    resolving: {},
  }; 
  private dependencyList: Record<string, ConstructorDependencies<unknown>[]> = {};

  public registerResolver<T>(resolveConfig: ResolveConfig<T>) {
    const {key} = this._generateName(resolveConfig.target);
    if (!(key in this.resolveConfig)) {
      this.resolveConfig[key] = [];
    }

    // Remove any duplicates.
    this.resolveConfig[key] = this.resolveConfig[key].filter((v) => !(v.target === resolveConfig.target));

    for (const [key, value] of Object.entries(this._getConstructorDependencies(resolveConfig.target))) {
      resolveConfig.dependencies[key as unknown as number] = value;
    }

    this.resolveConfig[key].push(resolveConfig);
  }

  private _getConstructorDependencies(target: Resolvable<unknown>): Record<number, Resolvable<unknown>> {
    const {key} = this._generateName(target);
    
    if (!(key in this.dependencyList)) {
      return {};
    }

    const search = this.dependencyList[key].find((v) => v.target === target)

    if (!search) {
      return {};
    }

    return search.dependencies;
  }

  public setConstructorDependency(target: Resolvable<unknown>, index: number, dependency: Resolvable<unknown>) {
    const {key} = this._generateName(target);
    if (!(key in this.dependencyList)) {
      this.dependencyList[key] = [];
    }

    // If the resolvable is already registered, amend it.
    this.dependencyList[key] = this.dependencyList[key].map((v) => {
      if (!(v.target === target)) {
        return v;
      }
      const mod = v;
      mod.dependencies[index] = dependency;
      return mod;
    });

    //Create the section if it doesnt exist
    if (!(key in this.dependencyList)) {
      this.dependencyList[key] = [];
    }

    //Create the dependency list if it doesnt exist
    if (!(this.dependencyList[key].find((v) => v.target === target))) {
      this.dependencyList[key].push({
        target,
        dependencies: {},
      })
    }

    //Add the dependency
    this.dependencyList[key] = this.dependencyList[key].map((v) => {
      if (!(v.target === target)) {
        return v;
      }
      v.dependencies[index] = dependency;
      return v;
    })
  }

  private _generateName<T>(resolvable: Resolvable<T>): { key: string; name: string; } {
    const prefix = 'dt';
    if (typeof resolvable === 'string') {
      return {
        key: `${prefix}:str:${resolvable}`,
        name: `${resolvable}`,
      }
    }
    if (typeof resolvable === 'symbol') {
      return {
        key: `${prefix}:str:${resolvable.description}`,
        name: `${resolvable.description}`,
      }
    }
    if (typeof resolvable === 'function') {
      return {
        key: `${prefix}:str:${resolvable.name}`,
        name: `${resolvable.name}`,
      }
    }
    throw new Error('Received non-resolvable object to be resolved.');
  }

  private _initResolve<T>(resolvable: Resolvable<T>): void {
    const {key} = this._generateName(resolvable);
    if (!(key in this.resolveMap.resolving)) {
      this.resolveMap.resolving[key] = [];
    }

    this.resolveMap.resolving[key].push(resolvable);
  }

  private _isResolving<T>(resolvable: Resolvable<T>): boolean {
    const {key} = this._generateName(resolvable);
    if (!(key in this.resolveMap.resolving)) {
      return false;
    }
    for (const entry of this.resolveMap.resolving[key]) {
      if (resolvable === entry) {
        return true;
      }
    }
    return false;
  }

  private _finishResolve<T>(resolvable: Resolvable<T>, instance: T): T {
    const {key} = this._generateName(resolvable);

    if (!(key in this.resolveMap.resolved)) {
      this.resolveMap.resolved[key] = [];
    }

    this.resolveMap.resolved[key].push({
      target: resolvable,
      instance,      
    })

    if (key in this.resolveMap.resolving) {
      this.resolveMap.resolving[key] = this.resolveMap.resolving[key].filter((v) => !(v === resolvable));
    }

    return instance;
  }

  private _getResolver<T>(resolvable: Resolvable<T>): ResolveConfig<T> {
    const {key, name} = this._generateName(resolvable);
    if (!(key in this.resolveConfig)) {
      throw new Error(`Could not find resolver for ${typeof resolvable} ${name} in resolver map.`)
    }

    let conf: ResolveConfig<T> | undefined = undefined;

    for (const entry of this.resolveConfig[key]) {
      if (entry.target === resolvable) {
        conf = entry as ResolveConfig<T>;
        break;
      }
    }
    
    if (!conf) {
      throw new Error(`Could not find resolver for ${typeof resolvable} ${name} in resolver map.`)
    }

    return conf;
  }

  private _resolveMany(...resolvables: Resolvable<unknown>[]): unknown[] {
    const resolvedDeps: unknown[] = [];
    
    for (const dep of resolvables) {
      resolvedDeps.push(this._resolve(dep, false))
    }

    return resolvedDeps;
  }

  private async _resolveManyAsync(...resolvables: Resolvable<unknown>[]): Promise<unknown[]> {
    const resolvedDeps: Promise<unknown>[] = [];
    
    for (const dep of resolvables) {
      resolvedDeps.push(this._resolve(dep, true))
    }

    return Promise.all(resolvedDeps);
  }

  private _resolve<T extends unknown>(resolvable: Resolvable<T>, async: false): T
  private _resolve<T extends unknown>(resolvable: Resolvable<T>): T
  private _resolve<T extends unknown>(resolvable: Resolvable<T>, async: true): Promise<T>
  private _resolve<T extends unknown>(resolvable: Resolvable<T>, async: boolean): T | Promise<T>

  private _resolve<T extends unknown>(resolvable: Resolvable<T>, async = false): T | Promise<T> {
    if (this._isResolving(resolvable)) {
      throw new Error('Attempted to resolve a circular dependency.')
    }

    this._initResolve(resolvable);

    const resolveConfig = this._getResolver(resolvable);

    if (resolveConfig.async) {
      if (!async) {
        throw new Error('Unable to resolve dependencies synchronously, an asynchronous dependency is required.')
      }
    }
  
    if (async) {
      return (async () => resolveConfig.mechanism(this, await this._resolveManyAsync(...resolveConfig.dependencies)))()
    }
    return resolveConfig.mechanism(this, this._resolveMany(...resolveConfig.dependencies));
  }

  /**
   * Attempt to resolve the value of a resolvable asynchronously.
   * @param resolvable 
   * @returns A promise that resolves to the value of the resolvable.
   */
  public async resolveAsync<T extends unknown>(resolvable: Resolvable<T>): Promise<T> {
    return this._finishResolve(resolvable, await this._resolve(resolvable, true));
  }

  /**
   * Attempt to resolve the value of a resolvable synchronously.
   * @param resolvable 
   * @returns The value of the resolvable.
   */
  public resolve<T extends unknown>(resolvable: Resolvable<T>): T {
    return this._finishResolve(resolvable, this._resolve(resolvable, false));
  }
}