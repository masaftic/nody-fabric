import { Request, Response, NextFunction } from "express";
import { fabricConnection, withFabricAdminConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { StatusCodes } from "http-status-codes";

// export async function initLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
//     try {
//         // Get userId from JWT token instead of request body
//         if (!req.user?.user_id) {
//             res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
//             return;
//         }

//         // Only admin users should be able to initialize the ledger
//         if (req.user.role !== 'admin') {
//             res.status(StatusCodes.FORBIDDEN).json({ message: 'Only admin users can initialize the ledger' });
//             return;
//         }
 
//         await withFabricAdminConnection((contract) => {
//             const blockchainRepo = new BlockChainRepository(contract);
//             return blockchainRepo.initLedger();
//         });

//         res.status(StatusCodes.CREATED).json({ message: 'ledger initialized successfully' });
//     } catch (error) {
//         next(error);
//     }
// }


export async function getWorldState(req: Request, res: Response) {
    // Get userId from JWT token instead of request body
    if (!req.user?.user_id) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
        return;
    }

    const result = await withFabricAdminConnection((contract) => {
        const blockchainRepo = new BlockChainRepository(contract);
        return blockchainRepo.getWorldState();
    });

    res.status(StatusCodes.OK).json(result);
    return;
}
