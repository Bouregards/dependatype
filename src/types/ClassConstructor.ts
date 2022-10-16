/**
 * Type to represent a class constructor.
 */
export type ClassConstructor<T> = new (...args: any[]) => T;