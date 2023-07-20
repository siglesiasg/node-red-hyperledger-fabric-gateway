import { Node, NodeAPI, NodeMessageInFlow } from 'node-red';
import { getConfigValidate } from '../../libs/node-red-utils';
import { buildConnectionConfig } from '../../models/connection-config.model';
import { buildChannelInfoDecoder } from './../../libs/fabric-decoder';
import { closeConnection, invokeChaincodeGeneric } from './../../libs/fabric-functions';
import { FabricChannelInfoDef } from './fabric-channel-info.def';

export = (RED: NodeAPI): void => {

  RED.nodes.registerType('fabric-channel-info', fabricChannelInfoNode);

  function fabricChannelInfoNode(this: Node<FabricChannelInfoDef>, config: FabricChannelInfoDef) {

    RED.nodes.createNode(this, config); // First line always!

    const connection = buildConnectionConfig(RED, config);
    const fabricChannelDef = getConfigValidate(RED, config.channelSelector);
    const chainInfoDecoder = buildChannelInfoDecoder();

    this.debug('Fabric Get Chain Info Node Created');
    this.status({ fill: 'green', shape: 'dot', text: 'Ready' });

    this.on('input', async (msg: NodeMessageInFlow, send, done) => {
      try {

        this.status({ fill: 'yellow', shape: 'dot', text: 'Querying...' });

        await invokeChaincodeGeneric(RED, this, msg, chainInfoDecoder, 'evaluate', connection, config.channelSelector, 'qscc', 'GetChainInfo', [fabricChannelDef.channel]);

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


