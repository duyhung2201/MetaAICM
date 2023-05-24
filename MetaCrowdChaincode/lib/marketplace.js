/*
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

// Deterministic JSON.stringify()
const stringify = require("json-stringify-deterministic");
const sortKeysRecursive = require("sort-keys-recursive");
const { Contract } = require("fabric-contract-api");

const itemCounterKey = "item_counter";
const buyReqCounterKey = "buy_req_counter";
const disputePrefix = "dispute";
const lockedDuration = 30 * 24 * 3600 * 1000;

class MarketplaceContract extends Contract {
	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.reputationContract = ctx.reputationContract;
		this.tokenERC20Contract = ctx.tokenERC20Contract;
	}

	async queryItem(itemId) {
		const itemAsBytes = await this.ctx.stub.getState(itemId);

		if (!itemAsBytes || itemAsBytes.length === 0) {
			throw new Error(`Item ${itemId} does not exist.`);
		}
		return itemAsBytes.toString();
	}

	async queryBuyReq(buyReqId) {
		const buyReqAsBytes = await this.ctx.stub.getState(buyReqId);

		if (!buyReqAsBytes || buyReqAsBytes.length === 0) {
			throw new Error(`Buy request ${buyReqId} does not exist.`);
		}
		return buyReqAsBytes.toString();
	}

	async queryDispute(buyReqId) {
		const disputeKey = this.ctx.stub.createCompositeKey(disputePrefix, [
			buyReqId,
		]);
		const disputeAsBytes = await this.ctx.stub.getState(disputeKey);

		if (!disputeAsBytes || disputeAsBytes.length === 0) {
			throw new Error("Dispute does not exist.");
		}
		return disputeAsBytes.toString();
	}

	async increaseItemCount() {
		const counterBytes = await this.ctx.stub.getState(itemCounterKey);
		let counterValue;
		if (!counterBytes || counterBytes.length === 0) {
			// Initialize the counter if it doesn't exist
			counterValue = 1;
		} else {
			counterValue = parseInt(counterBytes.toString()) + 1;
		}

		// Update the counter value on the ledger
		await this.ctx.stub.putState(
			itemCounterKey,
			Buffer.from(counterValue.toString())
		);

		return counterValue;
	}

	async increaseBuyReqCount() {
		const counterBytes = await this.ctx.stub.getState(buyReqCounterKey);
		let counterValue;
		if (!counterBytes || counterBytes.length === 0) {
			// Initialize the counter if it doesn't exist
			counterValue = 1;
		} else {
			counterValue = parseInt(counterBytes.toString()) + 1;
		}

		// Update the counter value on the ledger
		await this.ctx.stub.putState(
			buyReqCounterKey,
			Buffer.from(counterValue.toString())
		);

		return counterValue;
	}

	async initItem(itemId, itemDescriptionLink, price, proof) {
		const itemOwner = this.ctx.clientIdentity.getID();

		// const itemId = await this.increaseItemCount();
		const item = {
			itemOwner,
			itemDescriptionLink,
			price,
			proof,
			totalSale: 0,
			active: true,
		};

		await this.ctx.stub.putState(
			itemId,
			Buffer.from(stringify(sortKeysRecursive(item)))
		);

		return itemId;
	}

	async buyRequest(itemId, reqId, encryptionKey) {
		const buyer = this.ctx.clientIdentity.getID();
		const item = JSON.parse(await this.queryItem(itemId));

		if (!item.active) {
			throw new Error("the item is inactive");
		}
		await this.tokenERC20Contract.Transfer(
			this.ctx,
			this.getName(),
			item.price
		);

		// const reqId = await this.increaseBuyReqCount();
		const req = {
			buyer,
			itemId,
			encryptionKey,
			active: true,
			encryptedResult: null,
			fulfillTime: null,
		};

		await this.ctx.stub.putState(
			reqId,
			Buffer.from(stringify(sortKeysRecursive(req)))
		);

		return reqId;
	}

	async cancelRequest(buyReqId) {
		const req = JSON.parse(await this.queryBuyReq(buyReqId));
		const item = JSON.parse(await this.queryItem(req.itemId));
		const buyer = this.ctx.clientIdentity.getID();

		if (req.buyer !== buyer) {
			throw new Error("authentication fail");
		}
		if (!req.active) {
			throw new Error("the request is inactive");
		}
		if (!!req.encryptedResult) {
			throw new Error("the request is already fulfilled");
		}

		await this.tokenERC20Contract._transfer(
			this.ctx,
			this.getName(),
			buyer,
			item.price
		);
		req.active = false;
		await this.ctx.stub.putState(
			buyReqId,
			Buffer.from(stringify(sortKeysRecursive(req)))
		);
	}

	async cancelItem(itemId) {
		const item = JSON.parse(await this.queryItem(itemId));
		const itemOwner = this.ctx.clientIdentity.getID();

		if (item.itemOwner !== itemOwner) {
			throw new Error("authentication fail");
		}
		if (!item.active) {
			throw new Error("the item is inactive");
		}

		item.active = false;
		await this.ctx.stub.putState(
			itemId,
			Buffer.from(stringify(sortKeysRecursive(item)))
		);
	}

	async fulfillBuyRequest(buyReqId, encryptedResult) {
		const req = JSON.parse(await this.queryBuyReq(buyReqId));
		const item = JSON.parse(await this.queryItem(req.itemId));
		const itemOwner = this.ctx.clientIdentity.getID();

		if (item.itemOwner !== itemOwner) {
			throw new Error("authentication fail");
		}
		if (!req.active) {
			throw new Error("the request is inactive");
		}

		req.encryptedResult = encryptedResult;
		req.fulfillTime = new Date().getTime();
		await this.ctx.stub.putState(
			buyReqId,
			Buffer.from(stringify(sortKeysRecursive(req)))
		);
	}

	async releasePayment(buyReqId) {
		const req = JSON.parse(await this.queryBuyReq(buyReqId));
		const item = JSON.parse(await this.queryItem(req.itemId));
		const user = this.ctx.clientIdentity.getID();
		if (!req.active) {
			throw new Error("the request is inactive");
		}
		if (
			req.buyer === user ||
			(item.itemOwner === user &&
				req.fulfillTime + lockedDuration > new Date().getTime())
		) {
			await this.tokenERC20Contract._transfer(
				this.ctx,
				this.getName(),
				item.itemOwner,
				item.price
			);
			req.active = false;
			await this.ctx.stub.putState(
				buyReqId,
				Buffer.from(stringify(sortKeysRecursive(req)))
			);
		} else {
			throw new Error("authentication fail");
		}
	}

	async createDisputeRequest(buyReqId, result, disputeDescription) {
		const req = JSON.parse(await this.queryBuyReq(buyReqId));
		const user = this.ctx.clientIdentity.getID();
		if (req.buyer !== user) {
			throw new Error("authentication fail");
		}
		if (!req.active) {
			throw new Error("the request is inactive");
		}

		const encryptedResult = crypto.publicEncrypt(
			{
				key: req.encryptionKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				oaepHash: "sha256",
			},
			Buffer.from(result)
		);

		if (encryptedResult !== req.encryptedResult) {
			throw new Error("Result mismatch");
		}

		const dispute = {
			buyReqId,
			result,
			disputeDescription,
			resolved: false,
			result: null,
		};

		const disputeKey = this.ctx.stub.createCompositeKey(disputePrefix, [
			buyReqId,
		]);
		await this.ctx.stub.putState(
			disputeKey,
			Buffer.from(stringify(sortKeysRecursive(dispute)))
		);
	}

	async resolveDispute(buyReqId, taskId, result) {
		// Check Oracle authorization
		const clientMSPID = this.ctx.clientIdentity.getMSPID();
		if (clientMSPID !== "OracleMSP") {
			throw new Error("client is not authorized to resolve dispute");
		}

		const req = JSON.parse(await this.queryBuyReq(buyReqId));
		const item = JSON.parse(await this.queryItem(req.itemId));
		const dispute = JSON.parse(await this.queryDispute(buyReqId));
		if (dispute.resolved) {
			throw new Error("Dispute has already been resolved");
		}

		dispute.resolved = true;
		dispute.result = result;

		if (result) {
			//refund the buyer if the dispute is resolved in their favor
			await this.tokenERC20Contract._transfer(
				this.ctx,
				this.getName(),
				req.buyer,
				item.price
			);
			await this.reputationContract.award(dispute.user, 1);
			await this.reputationContract.punish(item.itemOwner, 1);
		} else {
			await this.reputationContract.punish(dispute.user, 1);
		}

		const disputeKey = this.ctx.stub.createCompositeKey(disputePrefix, [
			buyReqId,
		]);
		await this.ctx.stub.putState(
			disputeKey,
			Buffer.from(stringify(sortKeysRecursive(dispute)))
		);
	}
}

module.exports = MarketplaceContract;
