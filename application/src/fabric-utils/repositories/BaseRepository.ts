import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../../logger';

/**
 * Base repository class for interacting with the blockchain
 */
export class BaseRepository {
    protected contract: Contract;
    protected utf8Decoder = new TextDecoder();

    constructor(contract: Contract) {
        this.contract = contract;
    }

    /**
     * Get the entire world state (for debugging purposes)
     */
    async getWorldState(): Promise<any> {
        const resultBytes = await this.contract.evaluateTransaction('GetWorldState');
        const resultJson = new TextDecoder().decode(resultBytes);
        if (resultJson === '') {
            return {};
        }
        const result: unknown = JSON.parse(resultJson);
        logger.info('Result: %o', result);
        return result;
    }

    /**
     * Initialize the ledger with sample data
     */
    async initLedger(): Promise<void> {
        logger.info('InitLedger initializes the ledger with some sample elections');
        await this.contract.submitTransaction('InitLedger');
        logger.info('Transaction committed successfully');
    }

    /**
     * Clear all data (for testing)
     */
    async deleteWorldState(): Promise<void> {
        await this.contract.submitTransaction('DeleteWorldState');
        logger.info('Deleted world state');
    }
}
