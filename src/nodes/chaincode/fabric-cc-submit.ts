import { Node, NodeAPI, NodeMessageInFlow } from 'node-red';
import { invokeChaincode } from '../../libs/fabric-functions';
import { buildGenericDecoder } from './../../libs/fabric-decoder';
import { handleError } from './../../libs/fabric-error-handler';
import { closeConnection } from './../../libs/fabric-functions';
import { buildConnectionConfig } from './../../models/connection-config.model';
import { FabricCCSubmitDef } from './fabric-cc-submit.def';

export = (RED: NodeAPI): void => {

  RED.nodes.registerType('fabric-cc-submit', fabricCCSubmitNode);

  function fabricCCSubmitNode(this: Node<FabricCCSubmitDef>, config: FabricCCSubmitDef) {

    RED.nodes.createNode(this, config); // First line always!

    const connection = buildConnectionConfig(RED, config);
    const genericDecoder = buildGenericDecoder();

    this.debug('Fabric Generic Node Created');
    this.status({ fill: 'green', shape: 'dot', text: 'Ready' });

    this.on('input', async (msg: NodeMessageInFlow, send, done) => {
      try {

        this.status({ fill: 'yellow', shape: 'dot', text: 'Querying...' });

        await invokeChaincode(RED, this, msg, genericDecoder, 'submit', connection, config);

        this.status({ fill: 'green', shape: 'dot', text: 'Done' });

        send(msg);
        done();

      } catch (error: any) {
        handleError(this, done, error);
      }

    });


    // removed -> "Node disabled / deleted" | !removed -> "Node is reestarted"
    this.on('close', async (removed: boolean, done: () => void) => {
      await closeConnection.call(this, connection, done);
    });

  }

}
