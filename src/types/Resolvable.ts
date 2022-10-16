import { ClassConstructor } from './ClassConstructor';

export type Resolvable<T> = ClassConstructor<T> | symbol | string;