# P2P Auction System

This project is a decentralized peer-to-peer (P2P) auction system implemented using Hyperswarm, Hypercore, and Hyperbee. The system allows users to open auctions, place bids, and close auctions in a distributed manner. Each node in the network acts as both a server and a client, enabling seamless communication and data synchronization between peers.

## Features

- **Decentralized Architecture**: The system uses a P2P architecture where each node is both a server and a client. There is no central server.
- **Auction Management**: Users can open auctions with an item and an opening price. Auctions can be bid on, and only the creator of the auction can close it.
- **Bid Placement**: Users can place bids on open auctions. Each bid must be higher than the previous one or the opening price.
- **Event Propagation**: Auction creation, bid placements, and auction closure events are propagated across all connected nodes.

## Getting Started

### Prerequisites

Ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (version 14 or higher)
- npm (Node Package Manager)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/p2p-auction.git
   cd p2p-auction