import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { getGateway } from "../../libs/fabric-connection-pool";
import { addResultToPayload, getConfigValidate } from "../../libs/node-red-utils";
import { closeConnection } from "../../libs/fabric-functions";
import { ConnectionConfigModel, buildConnectionConfig } from "../../models/connection-config.model";
import { FabricBlockInfoDef } from "./fabric-block-info.def";
import { buildBlockEventModel } from "./models/block.model";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-block-info', fabricGetBlockNode);    

    let connection: ConnectionConfigModel;

    function fabricGetBlockNode(this: Node<FabricBlockInfoDef>, config: FabricBlockInfoDef) {
        
        RED.nodes.createNode(this, config); // First line always!

        connection = buildConnectionConfig(RED, config);
        const fabricChannelDef = getConfigValidate(RED, config.channelSelector);

        this.debug('Fabric Get Block By Number Node Created');
        this.status({ fill: 'green', shape: 'dot', text: "Ready" });

        this.on('input', async (msg: NodeMessageInFlow, send, done) => {
            try {
                this.status({ fill: 'yellow', shape: 'dot', text: "Querying..." });

                const gateway = await getGateway(this, connection);
                const network = gateway.getNetwork(fabricChannelDef.channel);
                const contract = network.getContract('qscc');

                let transactionName;
                let transactionArgs;

                if (config.method === 'number') {
                    transactionName = 'GetBlockByNumber';
                    transactionArgs = [fabricChannelDef.channel, config.blockNumber];

                } else if (config.method === 'hash') {
                    transactionName = 'GetBlockByHash';
                    transactionArgs = [fabricChannelDef.channel, config.blockHash];

                } else if (config.method === 'txId') {
                    transactionName = 'GetBlockByTxID';
                    transactionArgs = [fabricChannelDef.channel, config.txId];
                } else {
                    throw new Error('Config method invalid: ' + config.method);
                }

                const blockBin = await contract.evaluateTransaction(transactionName, ...transactionArgs);

                const blockModel = buildBlockEventModel(blockBin, fabricChannelDef.channel);

                addResultToPayload(RED, msg, transactionName, transactionArgs, JSON.stringify(blockModel));
                this.debug('Fabric Node Executed Get Block By Number');

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
