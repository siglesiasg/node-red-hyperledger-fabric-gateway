import Semaphore from '@chriscdn/promise-semaphore';
import { Node, NodeAPI, NodeMessageInFlow } from 'node-red';
import { getSharedData } from '../../libs/node-red-utils';
import { FabricBlockListenerCommitDef } from './fabric-block-listener-commit.def';

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-block-listener-commit', fabricBlockListenerCommitNode);

    function fabricBlockListenerCommitNode(this: Node<FabricBlockListenerCommitDef>, config: FabricBlockListenerCommitDef) {

        RED.nodes.createNode(this, config); // First line always!

        this.debug('Fabric BLock Listener Commit Node Created');
        this.status({ fill: 'green', shape: 'dot', text: 'Ready' });

        this.on('input', async (msg: NodeMessageInFlow, send, done) => {
            try {

                const _lockSession: string = (msg as any)._lockSession;
                if (!_lockSession) { throw new Error('Unable to get _lockSession attribute'); }

                const nodeId = _lockSession.split('-');
                if (!nodeId || nodeId.length !==2 && nodeId.length !==3) { throw new Error('Unable to get node id from lockSession: ' + _lockSession); }

                const listenerNodeId = nodeId[0];
                const currentBlock = BigInt(parseInt(nodeId[1]));
                const withTx = nodeId.length === 3;
                const currentTx = (nodeId.length === 3) ? Number(nodeId[2]) : undefined;

                const isDupplicated = await updateCheckpointer.call(this, listenerNodeId, withTx, currentBlock, currentTx);

                if (!isDupplicated) {
                    const semaphore = getSharedData(RED, listenerNodeId, 'semaphore') as Semaphore;
                    this.debug(`Releasing lock ${_lockSession} of node ${listenerNodeId}`);
                    semaphore.release();
                } else {
                    this.trace(`Lock ${_lockSession} of node ${listenerNodeId} got duplicated`);
                }

                done();

            } catch (error: any) {
                this.status({ fill: 'red', shape: 'dot', text: error });
                done(error);
            }

        });

        async function updateCheckpointer(this: Node<FabricBlockListenerCommitDef>, listenerNodeId: string, withTx: boolean, currentBlock: bigint, currentTx: number): Promise<boolean> {

            const checkpointer = getSharedData(RED, listenerNodeId, 'checkpointer');

            if (!withTx) {
                if (currentBlock >= checkpointer.getBlockNumber()) {
                    await checkpointer.checkpointBlock(currentBlock);
                    this.status({ fill: 'green', shape: 'dot', text: `Checkpointed block: ${currentBlock} for node ${listenerNodeId}`});
                } else {
                    return true;
                }
            } else {
                if (currentBlock > checkpointer.getBlockNumber() || (currentBlock === checkpointer.getBlockNumber() && currentTx >= Number(checkpointer.getTransactionId()))) {
                    await checkpointer.checkpointTransaction(currentBlock, String(currentTx+1));
                    this.status({ fill: 'green', shape: 'dot', text: `Checkpointed block: ${currentBlock} - ${currentTx} for node ${listenerNodeId}`});
                } else {
                    return true;
                }
            }

            return false;
        }
    }
}
