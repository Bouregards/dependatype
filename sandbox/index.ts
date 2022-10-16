import 'reflect-metadata';
import { Container } from '../src';
import { Inject } from '../src/decorators/Inject';
import { Service } from '../src/decorators/Service';


const a = Symbol('jeff');

@Service()
class Demo { 
  constructor(@Inject(a) private dollarBillYall: Record<string, string>){}

  public attr1! : string;

  doSomething(
    a: number,
  ) : number { 
      return a
  }
}

async function doSandboxStuff() {
  Container.registerResolver({
    target: a,
    dependencies: [],
    async: true,
    mechanism: async (container, depa: string) => {
      return {
        s: 'b',
      }
    }
  })

  const test = await Container.resolveAsync(Demo);

  console.log(test.doSomething(1));
}

doSandboxStuff();