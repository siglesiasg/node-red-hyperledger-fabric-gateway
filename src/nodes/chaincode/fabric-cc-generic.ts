import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { getGateway } from "../../libs/fabric-connection-pool";
import { getTransactionName } from "../../libs/fabric-functions";
import { addResultToPayload, getConfigValidate } from "../../libs/node-red-utils";
import { closeConnection } from "../../libs/fabric-functions";
import { ConnectionConfigModel, buildConnectionConfig } from "../../models/connection-config.model";
import { FabricChannelDef } from "../config/fabric-channel.def";
import { FabricContractDef } from "../config/fabric-contract.def";
import { FabricGenericDef } from "./fabric-cc-generic.def";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-cc-generic', fabricGenericNode);

    const utf8Decoder = new TextDecoder();

    function fabricGenericNode(this: Node<FabricGenericDef>, config: FabricGenericDef) {
        
        RED.nodes.createNode(this, config); // First line always!

        const connection = buildConnectionConfig(RED, config);

        this.debug('Fabric Generic Node Created');
        this.status({ fill: 'green', shape: 'dot', text: "Ready" });
        
        this.on('input', async (msg: NodeMessageInFlow, send, done) => {
            try {
                
                this.status({ fill: 'yellow', shape: 'dot', text: "Querying..." });

                const fabricChannelDef: FabricChannelDef = getConfigValidate(RED, config.channelSelector);
                const fabricContractDef: FabricContractDef = getConfigValidate(RED, config.contractSelector);

                const gateway = await getGateway(this, connection);
                const network = gateway.getNetwork(fabricChannelDef.channel);
                const contract = network.getContract(fabricContractDef.contract);
        
                const transactionName = getTransactionName(config.transaction, msg.payload);
                // const transactionArgs = getTransactionArgs(config.args, msg.payload);

                let getResult; 
                // if (config.actionType === 'submit') {
                //     getResult = await contract.submit(transactionName, ...transactionArgs);
                // } else if (config.actionType === 'evaluate') {
                //     getResult = await contract.evaluate(transactionName, ...transactionArgs);
                // } else {
                //     throw new Error("Undefined action type: " + config.actionType);
                // }
                const decodedResult = utf8Decoder.decode(getResult);

                // addResultToPayload(RED, msg, transactionName, transactionArgs, decodedResult);

                this.debug('Fabric Node Executed Generic');

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
