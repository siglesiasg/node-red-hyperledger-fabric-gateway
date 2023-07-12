import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { addResultToPayload, getConfigValidate } from "../../libs/node-red-utils";
import { getGateway } from "./../../libs/fabric-connection-pool";
import { closeConnection } from "./../../libs/fabric-functions";
import { ConnectionConfigModel, buildConnectionConfig } from "./../../models/connection-config.model";
import { FabricChannelDef } from "./../config/fabric-channel.def";
import { FabricMetadataDef } from "./fabric-metadata.def";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-metadata', fabricMetadataNode);

    const utf8Decoder = new TextDecoder();

    function fabricMetadataNode(this: Node<FabricMetadataDef>, config: FabricMetadataDef) {
        
        RED.nodes.createNode(this, config); // First line always!

        const connection = buildConnectionConfig(RED, config);

        this.debug('Fabric Metadata Node Created: ' + config.id);
        this.status({ fill: 'green', shape: 'dot', text: "Ready" });

        this.on('input', async (msg: NodeMessageInFlow, send, done) => {
            try {
                this.status({ fill: 'yellow', shape: 'dot', text: "Querying..." });

                const fabricChannelDef: FabricChannelDef = getConfigValidate(RED, config.channelSelector);

                const gateway = await getGateway(this, connection);
                const network = gateway.getNetwork(fabricChannelDef.channel);
                const contract = network.getContract('org.hyperledger.fabric');

                const getResult = await contract.evaluateTransaction('GetMetadata');
                const decodedResult = utf8Decoder.decode(getResult);

                addResultToPayload(RED, msg, 'org.hyperledger.fabric', ['GetMetadata'], decodedResult);

                this.debug('Fabric Node Executed Metadata');

                this.status({ fill: 'green', shape: 'dot', text: "Done" });

                send(msg);
                done();

            } catch (error: any) {
                this.error(error.stack);
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
