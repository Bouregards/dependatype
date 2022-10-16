import { Container } from '..';
import { Resolvable } from '../types/Resolvable';

export function Inject(token: Resolvable<unknown>, container = Container): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      container.setConstructorDependency(target as Resolvable<unknown>, parameterIndex, token);
    }
  }
}