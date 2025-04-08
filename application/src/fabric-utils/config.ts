import * as path from 'path';

export const mspId = 'Org1MSP';
export const channelName = 'mychannel';
export const chaincodeName = 'basic';

const cryptoPath = path.resolve(__dirname, '..', '..', 'hyperledger-fabric', 'network', 'organizations', 'peerOrganizations', 'org1.example.com');
export const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
export const peerEndpoint = 'localhost:7051';

export const fabricCaTlsCertPath = path.join(__dirname, '..', '..', 'hyperledger-fabric', 'network', 'organizations', 'fabric-ca', 'org1', 'tls-cert.pem');
export const caURL = 'https://localhost:7054';
export const peerHostAlias = 'peer0.org1.example.com';

export const adminWalletPath = path.join(__dirname, '..', 'wallet', 'admin');

export const usersWalletPath = path.join(__dirname, '..', 'wallet', 'users');
