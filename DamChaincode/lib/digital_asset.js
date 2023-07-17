"use strict";

const stringify = require("json-stringify-deterministic");
const sortKeysRecursive = require("sort-keys-recursive");
const { Contract } = require("fabric-contract-api");

const itemCounterKey = "item_counter";
const buyReqCounterKey = "buy_req_counter";

class DigitalAssetContract extends Contract {
	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.tokenERC20Contract = ctx.tokenERC20Contract;
	}

	async queryItem(itemId) {
		const itemAsBytes = await this.ctx.stub.getState(itemId);

		if (!itemAsBytes || itemAsBytes.length === 0) {
			throw new Error(`Item ${itemId} does not exist.`);
		}
		return itemAsBytes.toString();
	}
	async _queryBuyReq(buyReqId) {
		const buyReqAsBytes = await this.ctx.stub.getState(buyReqId);

		if (!buyReqAsBytes || buyReqAsBytes.length === 0) {
			throw new Error(`Buy request ${buyReqId} does not exist.`);
		}
		return buyReqAsBytes.toString();
	}

	async queryBuyReq(buyReqId) {
		const req = await this._queryBuyReq(buyReqId);
		const parsedReq = JSON.parse(req);
		const buyer = this.ctx.clientIdentity.getID();

		if (parsedReq.buyer !== buyer) {
			throw new Error("authentication fail");
		}

		return req;
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

	async listItem(price, parentAsset, commissionRate, itemId) {
		const owner = this.ctx.clientIdentity.getID();
		// const itemId = await this.increaseItemCount();
		const item = {
			itemId,
			owner,
			price,
			parentAsset,
			commissionRate,
			active: true,
		};

		await this.ctx.stub.putState(
			itemId,
			Buffer.from(stringify(sortKeysRecursive(item)))
		);

		return itemId;
	}

	async unlistItem(itemId) {
		const item = JSON.parse(await this.queryItem(itemId));
		const sender = this.ctx.clientIdentity.getID();

		if (item.owner !== sender) {
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

	async updatePrice(itemId, newPrice) {
		const sender = this.ctx.clientIdentity.getID();
		const item = JSON.parse(await this.queryItem(itemId));
		if (item.owner !== sender) {
			throw new Error("authentication fail");
		}
		if (!item.active) {
			throw new Error("the item is inactive");
		}

		item.price = newPrice;
		await this.ctx.stub.putState(
			itemId,
			Buffer.from(stringify(sortKeysRecursive(item)))
		);
	}

	async registerRequest(itemId, reqId) {
		const buyer = this.ctx.clientIdentity.getID();
		const item = JSON.parse(await this.queryItem(itemId));

		if (buyer === item.owner) {
			throw new Error("Caller is the owner");
		}
		if (!item.active) {
			throw new Error("the item is inactive");
		}
		await this.tokenERC20Contract.Transfer(
			this.ctx,
			`${this.getName()}_${reqId}`,
			item.price
		);

		// const reqId = await this.increaseBuyReqCount();
		const req = {
			price: item.price,
			buyer,
			itemId,
			active: true,
			encryptedSymmetricKey: null,
			encryptedFileHash: null,
			ipfsURI: null,
		};
		await this.ctx.stub.putState(
			reqId,
			Buffer.from(stringify(sortKeysRecursive(req)))
		);

		// Emit the event
		this.ctx.stub.setEvent("registerRequest", {
			customerId: buyer,
			fundAmount: item.price,
		});

		return reqId;
	}

	async cancelRequest(buyReqId) {
		const req = JSON.parse(await this._queryBuyReq(buyReqId));
		const sender = this.ctx.clientIdentity.getID();

		if (req.buyer !== sender) {
			throw new Error("authentication fail");
		}
		if (!req.active) {
			throw new Error("the request is inactive");
		}
		if (!!req.encryptedSymmetricKey) {
			throw new Error("the request is already fulfilled");
		}

		await this.tokenERC20Contract._transfer(
			this.ctx,
			this.getName(),
			sender,
			req.price
		);
		req.active = false;
		await this.ctx.stub.putState(
			buyReqId,
			Buffer.from(stringify(sortKeysRecursive(req)))
		);
	}

	async grantAccess(
		buyReqId,
		encryptedFileHash,
		encryptedSymmetricKey,
		ipfsURI
	) {
		const sender = this.ctx.clientIdentity.getID();
		const req = JSON.parse(await this._queryBuyReq(buyReqId));
		const item = JSON.parse(await this.queryItem(req.itemId));
		if (req.ipfsURI) {
			throw new Error("Access already granted");
		}
		if (!req.active) {
			throw new Error("The request is inactive");
		}
		if (!item.active) {
			throw new Error("The item is inactive");
		}
		if (item.owner !== sender) {
			throw new Error("Sender is not the owner");
		}

		const t = {
			...req,
			encryptedSymmetricKey,
			encryptedFileHash,
			ipfsURI,
		};
		await this.ctx.stub.putState(
			buyReqId,
			Buffer.from(stringify(sortKeysRecursive(t)))
		);
	}

	async compareHashes(buyReqId, customerHash) {
		const sender = this.ctx.clientIdentity.getID();
		const req = JSON.parse(await this._queryBuyReq(buyReqId));
		const item = JSON.parse(await this.queryItem(req.itemId));

		if (req.buyer !== sender) {
			throw new Error("Authentication fail");
		}
		if (!req.active) {
			throw new Error("The request is inactive");
		}
		if (!req.ipfsURI) {
			throw new Error("Access not granted");
		}

		if (customerHash !== req.encryptedFileHash) {
			await this.tokenERC20Contract._transfer(
				this.ctx,
				`${this.getName()}_${buyReqId}`,
				sender,
				req.price
			);
		} else {
			let commissionFee = 0;
			const parentAsset = JSON.parse(
				await this.queryItem(item.parentAsset)
			);
			if (!!parentAsset) {
				commissionFee = parentAsset.commissionRate * req.price;
				await this.tokenERC20Contract._transfer(
					this.ctx,
					`${this.getName()}_${buyReqId}`,
					parentAsset.owner,
					commissionFee
				);
			}
			await this.tokenERC20Contract._transfer(
				this.ctx,
				`${this.getName()}_${buyReqId}`,
				item.owner,
				req.price - commissionFee
			);
		}
		req.active = false;
		await this.ctx.stub.putState(
			buyReqId,
			Buffer.from(stringify(sortKeysRecursive(req)))
		);
	}
}

module.exports = DigitalAssetContract;
