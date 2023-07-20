import { Node, NodeAPI, NodeMessageInFlow } from 'node-red';
import { buildGenericDecoder } from './../../libs/fabric-decoder';
import { closeConnection, invokeChaincodeGeneric } from './../../libs/fabric-functions';
import { buildConnectionConfig } from './../../models/connection-config.model';
import { FabricMetadataDef } from './fabric-metadata.def';

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-metadata', fabricMetadataNode);

    function fabricMetadataNode(this: Node<FabricMetadataDef>, config: FabricMetadataDef) {

        RED.nodes.createNode(this, config); // First line always!

        const connection = buildConnectionConfig(RED, config);
        const genericDecoder = buildGenericDecoder();

        this.debug('Fabric Metadata Node Created: ' + config.id);
        this.status({ fill: 'green', shape: 'dot', text: 'Ready' });

        this.on('input', async (msg: NodeMessageInFlow, send, done) => {
            try {
                this.status({ fill: 'yellow', shape: 'dot', text: 'Querying...' });

                await invokeChaincodeGeneric(RED, this, msg, genericDecoder, 'evaluate', connection, config.channelSelector, 'org.hyperledger.fabric', 'GetMetadata');

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
