const Hyperswarm = require('hyperswarm');
const DHT = require('hyperdht');
const Auction = require('./auction');
const { serialize, deserialize } = require('./utils');
const logger = require('./logger');
const crypto = require('crypto');
const { mergeVectorClocks, generateVectorClock } = require('./utils');

class P2PAuctionNode {
  constructor({ bootstrap }) {
    this.dht = new DHT({
      keyPair: DHT.keyPair(crypto.randomBytes(32)),
      bootstrap,
    });

    this.swarm = new Hyperswarm();
    this.peers = new Set(); // To keep track of connected peers
    this.auction = new Auction(this.getPublicKey());

    this.swarm.on('connection', (socket) => {
      this.handleNewConnection(socket);
    });

    this.swarm.on('error', (err) => {
      logger.error(`Swarm error: ${err.message}`);
    });
  }

  async init() {
    await this.auction.init();
    logger.info(`Node initialized with public key: ${this.getPublicKey()}`);

    const topic = crypto.createHash('sha256').update('p2p-auction-topic').digest();
    this.swarm.join(topic, {
      lookup: true, // Find peers
      announce: true, // Announce ourselves to the DHT
    });
  }

  handleNewConnection(socket) {
    logger.info('New peer connected.');
    this.peers.add(socket);

    socket.on('data', (data) => {
      const { event, message } = deserialize(data);
      this.handleEvent(event, message);
    });

    socket.on('error', (err) => {
      logger.error(`Connection error: ${err.message}`);
    });

    socket.on('close', () => {
      this.peers.delete(socket);
      logger.info('Peer disconnected.');
    });
  }

  broadcast(event, message) {
    const payload = serialize({ event, message });
    for (const peer of this.peers) {
      try {
        peer.write(payload);
      } catch (err) {
        logger.error(`Error broadcasting to peer: ${err.message}`);
      }
    }
    logger.info(`Broadcasting event "${event}" to peers.`);
  }

  async handleEvent(event, message) {
    switch (event) {
      case 'auctionOpened':
        logger.info(`Received auction opened event: ${JSON.stringify(message)}`);
        const existingAuction = await this.auction.getAuction(message.auctionId);
        if (!existingAuction) {
          await this.auction.resolveConflict(null, message.details);
        } else {
          await this.auction.resolveConflict(existingAuction, message.details);
        }
        break;
  
      case 'bidPlaced':
        logger.info(`Received bid placed event: ${JSON.stringify(message)}`);
        const auction = await this.auction.getAuction(message.auctionId);
        if (!auction || !auction.value) {
          logger.error(`Auction with ID ${message.auctionId} does not exist locally.`);
          return;
        }
        
        // Ensure bids array is initialized
        auction.value.bids = auction.value.bids || [];
  
        // Merge the new bid with the existing bids
        auction.value.bids = auction.value.bids.concat(message.bid);
  
        // Update the vector clock
        auction.value.vectorClock = mergeVectorClocks(auction.value.vectorClock, generateVectorClock(this.nodeId));
  
        // Persist the updated auction data
        await this.auction.resolveConflict(auction, auction.value);
        break;
  
      case 'auctionClosed':
        logger.info(`Received auction closed event: ${JSON.stringify(message)}`);
        const closedAuction = await this.auction.getAuction(message.auctionId);
        if (!closedAuction) {
          logger.error(`Auction with ID ${message.auctionId} does not exist locally.`);
          return;
        }
        await this.auction.resolveConflict(closedAuction, message);
        break;
  
      default:
        logger.warn(`Unknown event received: ${event}`);
    }
  }
    

  async openAuction(item, openingPrice) {
    const auctionId = await this.auction.openAuction(item, openingPrice);
    this.broadcast('auctionOpened', { auctionId, details: await this.auction.getAuction(auctionId) });
    return auctionId;
  }

  async placeBid(auctionId, amount) {
    await this.auction.placeBid(auctionId, amount);
    this.broadcast('bidPlaced', { auctionId, bid: { bidder: this.getPublicKey(), amount } });
  }

  async closeAuction(auctionId) {
    const closedAuction = await this.auction.closeAuction(auctionId);
    this.broadcast('auctionClosed', closedAuction);
  }

  async listAuctions() {
    return this.auction.listAuctions();
  }

  getPublicKey() {
    return this.dht.defaultKeyPair.publicKey.toString('hex');
  }
}

module.exports = P2PAuctionNode;