import { Request, Response } from "express";
import { fabricConnection, withFabricAdminConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { StatusCodes } from "http-status-codes";

async function initLedger(req: Request, res: Response) {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    await withFabricAdminConnection((contract) => {
        const blockchainRepo = new BlockChainRepository(contract);
        return blockchainRepo.initLedger();
    });

    res.status(StatusCodes.CREATED).json({ message: 'ledger initialized successfully' });
}

async function getWorldState(req: Request, res: Response) {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const result = await withFabricAdminConnection((contract) => {
        const blockchainRepo = new BlockChainRepository(contract);
        return blockchainRepo.getWorldState();
    });

    res.status(StatusCodes.OK).json(result);
    return;
}

// async function clear(req: Request, res: Response) {
//     if (!req.body.userId) {
//         res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
//         return;
//     }

//     await withFabricAdminConnection((contract) => {
//         const blockchainRepo = new BlockChainRepository(contract);
//         return blockchainRepo.deleteWorldState();
//     });

//     res.status(StatusCodes.OK).json({ message: 'Ledger cleared successfully' });
// }

export {
    initLedger,
    getWorldState,
}