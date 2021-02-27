const sha256=require('sha256');
const { v4: uuidv4 } = require('uuid');

const currentNodeUrl=process.argv[3];

class Blockchain{
    constructor() {
        this.chain=[]; //all the blocks will be stored here as a chain
        this.pendingTransactions=[]; //here all new transactions will be stored before they are placed in the block
        
        this.currentNodeUrl=currentNodeUrl
        this.networkNodes=[]

        this.createNewBlock(100,'0','0'); //genesis block i.e the first block
    }

    createNewBlock(nonce,previousBlockHash,hash){
        const newBlock={
            index:this.chain.length+1,     //this will describe what number block is in our chain
            timestamp:Date.now(),
            transactions:this.pendingTransactions,
            nonce:nonce,     //it is a number,a proof of work
            hash:hash,   //the data from our new block hashed into the string
            previousBlockHash:previousBlockHash  //the data from previousBlock hashed
        };

        this.pendingTransactions=[];
        this.chain.push(newBlock)

        return newBlock;
    }

    getLastBlock(){
        return this.chain[this.chain.length-1];
    }

    createNewTransaction(amount,sender,recipient){
        const newTransaction={
            amount,
            sender,
            recipient,
            transactionId:uuidv4().split('-').join('')
        }

        return newTransaction;
    }

    addTransactionsToPendingTransactions(transactionObj){
        this.pendingTransactions.push(transactionObj);
        return this.getLastBlock()['index'] + 1;
    }

    //this function will hash the block into some fixed length string
    hashBlock(previousBlockHash,currentBlockData,nonce){
        const dataAsString=previousBlockHash+nonce.toString() + JSON.stringify(currentBlockData);
        const hash=sha256(dataAsString);
        return hash;
    }

    //it checks if the block to be added is legitimate
    proofOfWork(previousBlockHash,currentBlockData){
        //repeatedly hash block until it finds correct hash=>"0000IACDGFHG3ORMFLXL"
        //uses current block data for hash,but also the previousBlockHash
        //continously changes nonce value until it finds the correct hash
        //returns to us the nonce value that creates the correct hash
        let nonce=0;
        let hash=this.hashBlock(previousBlockHash,currentBlockData,nonce);
        while(hash.substring(0,4)!=='0000'){
            nonce++;
            hash=this.hashBlock(previousBlockHash,currentBlockData,nonce);
        }

        return nonce;
    }

    chainIsValid(blockchain){
        let validChain = true;

        for (var i = 1; i < blockchain.length; i++) {
            const currentBlock = blockchain[i];
            const prevBlock = blockchain[i - 1];
            const blockHash = this.hashBlock(
                    prevBlock['hash'], 
                    { 
                        transactions: currentBlock['transactions'],
                        index: currentBlock['index'] 
                    }, 
                currentBlock['nonce']
            );

            if (blockHash.substring(0, 4) !== '0000'){
                validChain = false;
            }

            if (currentBlock['previousBlockHash'] !== prevBlock['hash']){
                validChain = false;
            }
        };

        const genesisBlock = blockchain[0];
        const correctNonce = genesisBlock['nonce'] === 100;
        const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
        const correctHash = genesisBlock['hash'] === '0';
        const correctTransactions = genesisBlock['transactions'].length === 0;

        if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions){
            validChain=false;
        }

        return validChain;
    }

    getBlock(blockHash){
        let correctBlock=null;
        this.chain.forEach(block=>{
            if(block.hash === blockHash){
                correctBlock=block;
            }
        });
        return correctBlock;
    }

    getTransaction(transactionId){
        let correctTransaction = null;
        let correctBlock = null;

        this.chain.forEach(block=>{
            block.transactions.forEach(transaction=>{
                if(transaction.transactionId===transactionId){
                    correctTransaction = transaction;
                    correctBlock = block;
                };
            });
        });

        return {
            transaction:correctTransaction,
            block:correctBlock
        };
    };

    getAddressData(address){
        const addressTransactions = [];

        this.chain.forEach(block=>{
            block.transactions.forEach(transaction => {
                if (transaction.sender === address || transaction.recipient === address) {
                    addressTransactions.push(transaction);
                };
            });
        });

        let balance=0;
        addressTransactions.forEach(transaction=>{
            if(transaction.recipient === address){
                balance += transaction.amount;
            }
            else if (transaction.sender === address){
                balance-=transaction.amount;
            }
        });

        return {
            addressTransactions: addressTransactions,
            addressBalance: balance
        }
    }
}

module.exports=Blockchain;