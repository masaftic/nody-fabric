import { Request, Response } from "express";
import { fabricConnection, withFabricAdminConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { StatusCodes } from "http-status-codes";

async function init(req: Request, res: Response) {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    await withFabricAdminConnection((contract) => {
        const votingController = new BlockChainRepository(contract);
        return votingController.initLedger();
    });

    res.status(StatusCodes.CREATED).json({ message: 'ledger initialized successfully' });
}

async function getWorldState(req: Request, res: Response) {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const result = await withFabricAdminConnection((contract) => {
        const votingController = new BlockChainRepository(contract);
        return votingController.getWorldState();
    });

    res.status(StatusCodes.OK).json(result);
    return;
}

async function clear(req: Request, res: Response) {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    await withFabricAdminConnection((contract) => {
        const votingController = new BlockChainRepository(contract);
        return votingController.deleteWorldState();
    });

    res.status(StatusCodes.OK).json({ message: 'Ledger cleared successfully' });
}

export {
    init as initLedger,
    getWorldState as voteCast,
    clear as deleteLedger
}