const P2PAuctionNode = require('./src/node');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const node = new P2PAuctionNode({ bootstrap: [] });

node.init().then(() => {
  console.log('\nPlease choose an option:');
  console.log('1. Open an auction');
  console.log('2. Place a bid');
  console.log('3. Close an auction');
  console.log('4. Show all auctions');
  console.log('5. Exit');

  rl.on('line', (input) => {
    switch (input.trim()) {
      case '1':
        rl.question('Enter item to auction: ', (item) => {
          rl.question('Enter opening price: ', (openingPrice) => {
            node.openAuction(item, parseFloat(openingPrice)).then(() => rl.prompt());
          });
        });
        break;
      case '2':
        rl.question('Enter auction ID: ', (auctionId) => {
          rl.question('Enter bid amount: ', (amount) => {
            node.placeBid(auctionId, parseFloat(amount))
              .then(() => rl.prompt())
              .catch(err => {
                console.log(err.message); // Notify user about the error
                rl.prompt();
              });
          });
        });
        break;
      case '3':
        rl.question('Enter auction ID to close: ', (auctionId) => {
          node.closeAuction(auctionId)
            .then(() => {
              console.log(`Auction ${auctionId} closed successfully.`);
              rl.prompt();
            })
            .catch(err => {
              console.log(`Error: ${err.message}`);
              rl.prompt();
            });
        });        
        break;
      case '4':
        node.listAuctions().then((auctions) => {
          console.log('Current auctions:', auctions);
          rl.prompt();
        });
        break;
      case '5':
        console.log('Exiting...');
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid option. Please try again.');
        rl.prompt();
        break;
    }
  });

  rl.prompt();
});