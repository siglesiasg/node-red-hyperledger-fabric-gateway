# Hyperledger Fabric Gateway for Node Red 

A Hyperledger Fabric Gateway for Node Red 3.x implementation nodes to work with recent HLF networks v2.4 (or later)

<!-- [![Donate][donation-badge]](https://www.buymeacoffee.com/siglesiasg)

[donation-badge]: https://img.shields.io/badge/Buy%20me%20a%20pizza-%23d32f2f?logo=buy-me-a-coffee&style=flat&logoColor=white -->

## Overview

Built in Typescript, this package aims to provide an easy to use and up-to-date set of Node Red nodes that enable seamless integration with Hyperledger Fabric blockchain networks.

Developers can leverage the power of the Hyperledger Fabric programming model to rapidly build blockchain-connected applications using Node Red.

### Key features

 - Simple, intuitive Nodes for working with Hyperledger Fabric
 - Actively maintained and updated for latest Fabric releases
 - Built on top of Node.js Fabric Gateway library for enhanced compatibility
 - Designed for smooth integration into your Node Red workflows

### Compatibility

This Nodes are based on fabric gateway and requires Fabric v2.4 (or later) with a Gateway enabled Peer. Additional compatibility information is available in the documentation:

- https://hyperledger.github.io/fabric-gateway/

- https://github.com/hyperledger/fabric-gateway/

## Getting Started

To use this Node-RED package, you first need to configure a connection to your Hyperledger Fabric network.

### Create a new connection

A connection requires specifying:
 - Gateway - The gateway URL and options to connect to your Fabric network
 - Identity - The credentials to authenticate with the network
 - Channel - The channel name to interact with

This connection information can then be leveraged in a modular way across nodes that need to interact with the Fabric network.

![Basic Connection][connection1]

[connection1]: ./readme-assets/connection1.png

### Gateway

Gateway needs a peer definition. This peer will be used to execute all requests to HLF.

TODO: Enable selection multiple peers to get complex transaction request.


![GW][connection-gw]

[connection-gw]: ./readme-assets/connection-gw.png

### Peer

To connect to a Hyperledger Fabric peer, you will need to specify the following configuration:

 - Peer URL - The URL of the peer is required to connect to it. 
 - TLS Cert in Base64 - The TLS certificate is required if the peer connection is using TLS. Provide the PEM encoded certificate as a base 64 string. 
 - gRPC Options - Additional gRPC options can be provided as an object:

```js
{
    "grpc.default_authority": "testpeer.com:9999",
    "grpc.ssl_target_name_override": "testpeer.com"
}
```

Refer to the gRPC documentation for full options.

![Peer][connection-peer]

[connection-peer]: ./readme-assets/connection-peer.png

### Identity

An identity can be configured in three different ways using the `Cert Type` parameter:

- `Embedded` - Identity credentials are provided in base64 and stored as credentials in Node-RED. `Private Key` and `Cert` fields must be provided.

- `Filesystem` - Identity credentials are read from a local file:

    - `Legacy Key/Cert Identity` - Certificate and Key file paths must be provided in PEM format.
    
    - `Fabric Operations Console Identity` - The identity is loaded from a single JSON file containing the certificate and private key embedded as base64 strings. This matches the format used by Hyperledger Fabric Operations Console:

    ```json 
    {
      "name": "admin",  
      "cert": "LS0tL......",
      "private_key": "LS0tl...."
    }
    ```

- `Microfab` - The identity is loaded remotely using the Microfab management REST API. This requires configuring the Microfab host and specifying the ID of the identity.

### Channel

Node to configure the channel name

![Channel][connection-channel]

[connection-channel]: ./readme-assets/connection-channel.png

## Transaction Nodes

Once the connection nodes are configured properly, you can operate with HLF using `Chaincode Nodes`.

![Transaction Nodes][transaction-nodes]

[transaction-nodes]: ./readme-assets/transaction-nodes.png

### Chaincode Evaluate
### Chaincode Submit
### Chaincode Call

## Event Nodes

## Channel Nodes

## Example

## TODO

 - Make gateway 

## Donate
Do you like my work? Buy me a coffee - or pizza 😜🍕

[![Donate][donation-badge-2]](https://www.buymeacoffee.com/siglesiasg)

[donation-badge-2]: ./readme-assets/bmc_qr.png

## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE] file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
