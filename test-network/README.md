## Running the test network

You can use the `./network.sh` script to stand up a simple Fabric test network. The test network has two peer organizations with one peer each and 50 nodes raft ordering service. You can also use the `./network.sh` script to create channels and deploy chaincode. For more information, see [Using the Fabric test network](https://hyperledger-fabric.readthedocs.io/en/latest/test_network.html).

Before you can deploy the test network, you need to follow the instructions to [Install the Samples, Binaries and Docker Images](https://hyperledger-fabric.readthedocs.io/en/latest/install.html) in the Hyperledger Fabric documentation.

Run the following command to remove any containers or artifacts from any previous runs:
```
./network.sh down 
```

You can then bring up the network by issuing the following command. 
```
./network.sh up 
```

You can use the network.sh script to create a channel between Org1 and Org2 and join their peers to the channel. Run the following command to create a channel with the default name of mychannel:
```
./network.sh createChannel
```

After you have used the network.sh to create a channel, you can start a chaincode on the channel using the following command:
```
./network.sh deployCC -ccn crowdmeta -ccp ../CrowdMeta/ -ccl javascript
```