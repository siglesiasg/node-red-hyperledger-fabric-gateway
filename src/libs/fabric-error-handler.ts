import { GatewayError } from '@hyperledger/fabric-gateway';
import { Node, NodeDef } from 'node-red';

export function handleError(node: Node<NodeDef>, done: (err?: Error) => void, error: any) {

  if (error instanceof GatewayError) {
    const attached = [];
    for (const att of error.details) {
      attached.push(`${att.mspId}-${att.address}-${att.message}`);
    }
    node.status({ fill: 'red', shape: 'dot', text: `${error.message} : ${attached.join('|')}` });

    const outputError = new Error();
    outputError.message = error.message;
    outputError.stack = JSON.stringify(error.details);

    done(outputError);

  } else {
    node.status({ fill: 'red', shape: 'dot', text: error });
    done(error);
  }
 
}