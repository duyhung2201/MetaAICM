[//]: # (SPDX-License-Identifier: CC-BY-4.0)

# Blockchain-Empowered Metaverse: Decentralized Marketplace and Crowdsourcing System for Trading Data and Machine Learning Models

## Getting started

To use this sample, you need to download the Fabric Docker images and the Fabric CLI tools. First, make sure that you have installed all of the [Fabric prerequisites](https://hyperledger-fabric.readthedocs.io/en/latest/prereqs.html). You can then follow the instructions to [Install the Fabric Samples, Binaries, and Docker Images](https://hyperledger-fabric.readthedocs.io/en/latest/install.html) in the Fabric documentation.

## Test network

The [test network](test-network) in the repository provides a Docker Compose based test network with two Organization peers and 50 ordering service nodes that run the consensus.

For more detail, take a look at [test network](test-network/README.md).

## MetaCrowd chaincode
The [chaincode](MetaCrowdChaincode) is written in Javascript and composed of 4 main smart contracts: Machine Learning Contract, Data Smart Contract, Markeplace Contract and Reputation Smart Contract.

## Benchmark
[Hyperledger Caliper](caliper-benchmarks), a blockchain performance benchmark tool, is used to generate transaction workload and monitor the performance of the simulated network. The work- load consists of mixed read and write transactions that invoke different smart contract functions. Accordingly, transactions are injected into MetaCrowd with different speeds to evaluate the system performance in different network conditions, from low to high and even extreme workloads.
For more detail, take a look at [caliper-benchmarks](caliper-benchmarks/README.md).
