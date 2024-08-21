const Hyperbee = require('hyperbee');
const Hypercore = require('hypercore');
const { generateId, generateVectorClock, mergeVectorClocks, isClockAhead } = require('./utils');
const logger = require('./logger');

class Auction {
  constructor(nodeId) {
    this.core = new Hypercore(`./db/auction-core-${nodeId}`);
    this.db = new Hyperbee(this.core, { keyEncoding: 'utf-8', valueEncoding: 'json' });
    this.nodeId = nodeId;
  }

  async init() {
    await this.db.ready();
    logger.info('Auction database initialized.');
  }

  async openAuction(item, openingPrice) {
    const auctionId = generateId();
    const auction = {
      auctionId,
      item,
      bids: [],
      status: 'open',
      creator: this.nodeId,
      openingPrice: openingPrice, // Store the opening price here
      vectorClock: generateVectorClock(this.nodeId)
    };
  
    await this.db.put(`auction-${auctionId}`, auction);
    logger.info(`Auction ${auctionId} opened for item: ${item} with opening price: ${openingPrice}`);
    return auctionId;
  }


  async placeBid(auctionId, amount) {
    const auction = await this.getAuction(auctionId);

    if (!auction || !auction.value) {
      logger.error(`Auction with ID ${auctionId} does not exist locally.`);
      console.log(`Auction with ID ${auctionId} does not exist locally. Try again later.`);
      return;
    }

    logger.info(`Attempting to place bid. Auction status: ${auction.value.status}`);

    if (auction.value.status !== 'open') {
      throw new Error('Auction is closed.');
    }

    // Check if there are no bids yet; if so, compare with the opening price
    const lastBidAmount = auction.value.bids.length > 0 ? auction.value.bids[auction.value.bids.length - 1].amount : auction.value.openingPrice;

    if (amount <= lastBidAmount) {
      throw new Error(`Bid must be higher than the current bid of ${lastBidAmount}.`);
    }

    const bid = {
      bidder: this.nodeId,
      amount,
      vectorClock: generateVectorClock(this.nodeId)
    };

    auction.value.bids.push(bid);
    auction.value.vectorClock = mergeVectorClocks(auction.value.vectorClock, bid.vectorClock);

    await this.db.put(`auction-${auctionId}`, auction);
    logger.info(`Bid of ${amount} placed on auction ${auctionId}`);
  }


  async closeAuction(auctionId) {
    const auction = await this.db.get(`auction-${auctionId}`);

    if (!auction || !auction.value) {
      throw new Error(`Auction with ID ${auctionId} does not exist locally.`);
    }

    if (auction.value.creator !== this.nodeId) {
      throw new Error('Only the creator can close the auction.');
    }

    auction.value.status = 'closed';
    auction.value.vectorClock = generateVectorClock(this.nodeId);

    await this.db.put(`auction-${auctionId}`, auction.value);
    logger.info(`Auction ${auctionId} closed`);
    return auction.value;
  }

  async getAuction(auctionId) {
    return await this.db.get(`auction-${auctionId}`);
  }

  async listAuctions() {
    const auctions = [];
    for await (const { key, value } of this.db.createReadStream()) {
      if (key.startsWith('auction-')) auctions.push(value);
    }
    logger.info('Listing all auctions.');
    return auctions;
  }

  async resolveConflict(localAuction, incomingAuction) {
    if (!localAuction) {
      // Ensure that the auction ID is correctly passed and persisted
      const auctionId = incomingAuction.value.auctionId;
      await this.db.put(`auction-${auctionId}`, incomingAuction.value);
      logger.info(`Auction ${auctionId} persisted locally.`);
      return incomingAuction;
    }

    // Otherwise, resolve conflicts based on vector clocks
    if (isClockAhead(incomingAuction.vectorClock, localAuction.vectorClock)) {
      localAuction = incomingAuction.value;
    } else {
      localAuction.vectorClock = mergeVectorClocks(localAuction.vectorClock, incomingAuction.vectorClock);
    }
    await this.db.put(`auction-${localAuction.auctionId}`, localAuction);
    return localAuction;
  }
}

module.exports = Auction;
