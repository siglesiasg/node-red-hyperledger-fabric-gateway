import { Node, NodeAPI } from 'node-red';
import { addConfiguration } from './../../libs/node-red-utils';
import { FabricIdentityDef } from './fabric-identity.def';

export = function (RED: NodeAPI): void {

  function fabricIdentityNode(this: Node<FabricIdentityDef>, config: FabricIdentityDef) {
    RED.nodes.createNode(this, config);
    if (this.credentials) {
      config.cert = this.credentials.cert;
      config.privateKey = this.credentials.privateKey;
    }
    addConfiguration(this, config);
  }

  RED.nodes.registerType('fabric-identity', fabricIdentityNode, {
    credentials: {
      cert:           { type: 'text' },
      privateKey:     { type: 'text' },
    }}
  );
}

