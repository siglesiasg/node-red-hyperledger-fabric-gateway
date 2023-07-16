import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { getGateway } from "../../libs/fabric-connection-pool";
import { getTransactionData, getTransactionName } from "../../libs/fabric-functions";
import { addResultToPayload, getConfigValidate } from "../../libs/node-red-utils";
import { FabricChannelDef } from "../config/fabric-channel.def";
import { FabricContractDef } from "../config/fabric-contract.def";
import { closeConnection } from "./../../libs/fabric-functions";
import { ConnectionConfigModel, buildConnectionConfig } from "./../../models/connection-config.model";
import { FabricCCSubmitDef } from "./fabric-cc-submit.def";
import { ProposalOptions } from "@hyperledger/fabric-gateway";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-cc-submit', fabricCCSubmitNode);

    const utf8Decoder = new TextDecoder();

    function fabricCCSubmitNode(this: Node<FabricCCSubmitDef>, config: FabricCCSubmitDef) {
        
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
                const proposal = getTransactionData(config.args, config.transientData, msg.payload);

                const getResult = await contract.submit(transactionName, proposal);
                const decodedResult = utf8Decoder.decode(getResult);

                addResultToPayload(RED, msg, transactionName, proposal, decodedResult);

                // this.debug('Fabric Node Executed Generic');

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
