import { Node, NodeAPI, NodeMessageInFlow } from 'node-red';
import { closeConnection, invokeChaincode } from '../../libs/fabric-functions';
import { buildConnectionConfig } from '../../models/connection-config.model';
import { buildGenericDecoder } from './../../libs/fabric-decoder';
import { FabricGenericDef } from './fabric-cc-generic.def';

export = (RED: NodeAPI): void => {

  RED.nodes.registerType('fabric-cc-generic', fabricGenericNode);

  function fabricGenericNode(this: Node<FabricGenericDef>, config: FabricGenericDef) {

    RED.nodes.createNode(this, config); // First line always!

    const connection = buildConnectionConfig(RED, config);
    const genericDecoder = buildGenericDecoder();

    this.debug('Fabric Generic Node Created');
    this.status({ fill: 'green', shape: 'dot', text: 'Ready' });

    this.on('input', async (msg: NodeMessageInFlow, send, done) => {
      try {

        this.status({ fill: 'yellow', shape: 'dot', text: 'Querying...' });

        await invokeChaincode(RED, this, msg, genericDecoder, config.actionType, connection, config);

        this.status({ fill: 'green', shape: 'dot', text: 'Done' });

        send(msg);
        done();

      } catch (error: any) {
        this.status({ fill: 'red', shape: 'dot', text: error });
        done(error);
      }

    });


    // removed -> "Node disabled / deleted" | !removed -> "Node is reestarted"
    this.on('close', async (removed: boolean, done: () => void) => {
      await closeConnection.call(this, connection, done);
    });

  }

}

