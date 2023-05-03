# Fabric Networks

Ensure you have all the necessary prerequisites for [Caliper](https://github.com/hyperledger/caliper/) and [Hyperledger Fabric prerequisites](https://hyperledger-fabric.readthedocs.io/en/latest/prereqs.html)

## Fabric Samples Test Network

Hyperledger Fabric provides a test network as part of its samples. This test network is a good generalised network that you can used to get started.

Steps to setup an environment to use caliper-benchmarks with Fabric samples test-network

- create a directory for this environment - eg `mkdir fabric-benchmarks`
- change to this directory - eg `cd fabric-benchmarks`
- follow the steps to install that latest version of fabric samples and docker images [install fabric](https://hyperledger-fabric.readthedocs.io/en/latest/install.html)
- clone caliper-benchmarks (ensure it is created inside the directory you created above)

```bash
git clone https://github.com/hyperledger/caliper-benchmarks
```

- change into the caliper-benchmarks directoy

```bash
cd caliper-benchmarks
```

- install the latest version of caliper

```bash
npm install --only=prod @hyperledger/caliper-cli
```

- bind to the fabric

To bind with fabric 2.2 (which uses the legacy node-sdk 2.2) which can be used with a Fabric 2.2 or higher SUT run:
```bash
npx caliper bind --caliper-bind-sut fabric:2.2
```

To bind with fabric 2.4 and utilise the new peer-gateway service introduced in fabric 2.4 run:
```bash
npx caliper bind --caliper-bind-sut fabric:2.4
```

If you wish to change the version of binding make sure to unbind your current binding (for example if you bound to fabric:2.2 unbind first with `caliper unbind --caliper-bind-sut fabric:2.2`) before binding to the new one.

- change to the fabric-samples/test-network directory `cd ../fabric-samples/test-network directory`
- bring up test network with a channel called `mychannel`

```bash
./network.sh up createChannel -s couchdb
```

This will create a fabric network using `couchdb` as the state database because some of the chaincodes use rich queries. If you want to test with `leveldb` you can drop the `-s couchdb` option but make sure the chaincode you deploy doesn't require it.
The test-network caliper configuration file is coded to work with cryptogen generated material so do not start test-network using fabric-cas for the generated keys and certificates (ie don't use the `-ca` option).

To terminate the network use the `./network.sh down` command

Now you are ready to choose a chaincode to deploy and run some benchmarks. There are some pre-requisites for test-network

1. For Go chaincode deployment you will need GoLang installed and it needs to be an appropriate version to support the version of fabric you are using, currently tested with GoLang 16.7
2. For Java chaincode deployment you will need Java JDK 8 installed

The network configuration file provided by this repo for test-network called `networks/fabric/test-network.yaml` is configured to support all the chaincodes listed in this README. It also looks for certificates created using cryptogen by test-network, which is the default when starting test-network and is reflected in the commands provided in this README.
