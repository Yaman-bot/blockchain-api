const express = require('express');
const bodyParser=require('body-parser');
const axios = require('axios')
const { v4: uuidv4 }=require('uuid');
const Blockchain =require('./blockchain')
const app = express();

const port=process.argv[2];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const nodeAddress = uuidv4().split('-').join('');

const bitcoin=new Blockchain();

//fetch entire blockchain
app.get('/blockchain', (req, res) =>{
    res.send(bitcoin);
})


//create a new transaction
app.post('/transaction',(req, res)=>{
    const newTransaction = req.body;
    const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
    res.json({ note: `Transaction will be added in block ${blockIndex}.` });
})

// broadcast transaction
app.post('/transaction/broadcast', (req, res) => {
    const newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    bitcoin.addTransactionToPendingTransactions(newTransaction);

    try {
        bitcoin.networkNodes.forEach(async networkNodeUrl=>{
            await axios.post(networkNodeUrl+'/transaction', newTransaction)
            res.json({ note: 'Transaction created and broadcast successfully.' });
        })
    }catch(err) {
        res.send(err)
    }
})

//mine a new block
app.get('/mine',async (req, res)=>{
    const lastBlock=bitcoin.getLastBlock();
    const previousBlockHash=lastBlock['hash'];
    const currentBlockData={
        transactions:bitcoin.pendingTransactions,
        index:lastBlock['index']+1
    }

    const nonce=bitcoin.proofOfWork(previousBlockHash,currentBlockData); 
    const blockHash=bitcoin.hashBlock(previousBlockHash,currentBlockData,nonce);

    const newBlock=bitcoin.createNewBlock(nonce,previousBlockHash,blockHash);

    try{
        bitcoin.networkNodes.forEach(async networkNodeUrl => {
            await axios.post(networkNodeUrl + '/recieve/newblock', { newBlock })
        })

        //Mining reward
        await axios.post(networkNodeUrl+'/transaction/broadcast',{
            amount: 12.5,
            sender: "00",
            recipient: nodeAddress
        })

        res.json({
            note: "New block mined & broadcast successfully",
            block: newBlock
        });
    }catch(err){
        res.send(err)
    }
});

// receive new block
app.post('/recieve/newblock',(req, res)=>{
    const newBlock = req.body.newBlock;
    const lastBlock = bitcoin.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

    if (correctHash && correctIndex) {
        bitcoin.chain.push(newBlock);
        bitcoin.pendingTransactions = [];
        res.json({
            note: 'New block received and accepted.',
            newBlock: newBlock
        });
    } else {
        res.json({
            note: 'New block rejected.',
            newBlock: newBlock
        });
    }
})

//register a node and broadcast it to the whole network
app.post('/register/broadcastnode',async (req, res)=>{
    const newNodeUrl=req.body.newNodeUrl;

    if(bitcoin.networkNodes.indexOf(newNodeUrl)===-1){
        bitcoin.networkNodes.push(newNodeUrl);
    }
    try{
        bitcoin.networkNodes.forEach(async networkNodeUrl=>{
                //hit this endpoint 'register/node'
                await axios.post(networkNodeUrl+'/register/node',{newNodeUrl})
        })
        
        await  axios.post(newNodeUrl + '/register/nodes/bulk', { allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl] })
  
        res.json({ note: 'New node registered with network successfully.' });  
    }catch(err){
        res.send(err)
    }
    
})

//register a node with the network
app.post('/register/node',(req, res)=>{
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) === -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode){
        bitcoin.networkNodes.push(newNodeUrl);
    }
    res.json({note:'New node registered successfully'})
})

//register multiple nodes at once
app.post('/register/nodes/bulk', (req, res) => {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) {
            bitcoin.networkNodes.push(networkNodeUrl);
        }
    });

    res.json({ note: 'Bulk registration successful.' });
})

//consensus endpoint
const blockchains=[];
app.get('/consensus',(req, res)=>{

    try{
        bitcoin.networkNodes.forEach(async networkNodeUrl=>{
        const response= await axios.get(networkNodeUrl+'/blockchain');
        blockchains.push(response.data);
        })

        const currentChainLength=bitcoin.chain.length;
        let maxChainLength=currentChainLength;
        let newLongestChain=null;
        let newPendingTransactions=null;

        blockchains.forEach(blockchain=>{
            if(blockchain.chain.length > maxChainLength){
                maxChainLength=blockchain.chain.length;
                newLongestChain=blockchain.chain;
                newPendingTransactions=blockchain.pendingTransactions;
            }
        });

        if (!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))) {
            res.json({
                note: 'Current chain has not been replaced.',
                chain: bitcoin.chain
            });
        }
        else {
            bitcoin.chain = newLongestChain;
            bitcoin.pendingTransactions = newPendingTransactions;
            res.json({
                note: 'This chain has been replaced.',
                chain: bitcoin.chain
            });
        }
    }catch(err){
        res.send(err);
    }
})

//get block by blockHash
app.get('/block/:blockHash',(req, res)=>{
    const blockHash = req.params.blockHash;
    const correctBlock = bitcoin.getBlock(blockHash);
    res.json({ block: correctBlock });
})

//get transaction by transactionId
app.get('/transaction/:transactionId',(req, res)=>{
    const transactionId = req.params.transactionId;
    const trasactionData = bitcoin.getTransaction(transactionId);
    res.json({
        transaction: trasactionData.transaction,
        block: trasactionData.block
    });
})


//get address by address
app.get('/address/:address',(req, res)=>{
    const address = req.params.address;
    const addressData = bitcoin.getAddressData(address);
    res.json({ addressData: addressData });
})

// block explorer
app.get('/block-frontend', function (req, res) {
    res.sendFile('./block-frontend/index.html', { root: __dirname });
});

app.listen(port,()=>{
    console.log(`Server is running on port ${port}!!!`);
})