import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { getGateway } from "../../libs/fabric-connection-pool";
import { addResultToPayload, getConfigValidate } from "../../libs/node-red-utils";
import { ConnectionConfigModel, buildConnectionConfig } from "../../models/connection-config.model";
import { closeConnection } from "./../../libs/fabric-functions";
import { FabricChannelInfoDef } from "./fabric-channel-info.def";
import { buildChannelInfoModel } from "./models/channel-info.model";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-channel-info', fabricChannelInfoNode);

    function fabricChannelInfoNode(this: Node<FabricChannelInfoDef>, config: FabricChannelInfoDef) {
        
        RED.nodes.createNode(this, config); // First line always!

        const connection = buildConnectionConfig(RED, config);
        const fabricChannelDef = getConfigValidate(RED, config.channelSelector);

        this.debug('Fabric Get Chain Info Node Created');
        this.status({ fill: 'green', shape: 'dot', text: "Ready" });

        this.on('input', async (msg: NodeMessageInFlow, send, done) => {
            try {

                this.status({ fill: 'yellow', shape: 'dot', text: "Querying..." });

                const gateway = await getGateway(this, connection);
                const network = gateway.getNetwork(fabricChannelDef.channel);
                const contract = network.getContract('qscc');
                
                const transactionName = 'GetChainInfo';
                const transactionArgs = [fabricChannelDef.channel];
                
                const chainInfoBin = await contract.evaluateTransaction(transactionName, ...transactionArgs);
                
                const chainInfoModel = buildChannelInfoModel(chainInfoBin);
                addResultToPayload(RED, msg, transactionName, transactionArgs, JSON.stringify({ chainInfo: chainInfoModel }));

                this.debug('Fabric Node Executed Get Chain Info');

                this.status({ fill: 'green', shape: 'dot', text: "Done" });
                
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


