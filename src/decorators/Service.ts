import { Container } from "..";
import { ContainerInstance } from "../classes/Container";
import { ClassConstructor } from "../types/ClassConstructor";

export function Service(container: ContainerInstance = Container): ClassDecorator {
  return (target): void => {
    const targetTypes: ClassConstructor<unknown>[] = Reflect.getMetadata('design:paramtypes', target);
    const tTarget = target as unknown as ClassConstructor<unknown>;

    container.registerResolver({
      target: target as unknown as ClassConstructor<unknown>,
      async: false,
      dependencies: targetTypes ?? [],
      mechanism(container, dependencies) {
        return new tTarget(...dependencies)
      },
    })
  }
}