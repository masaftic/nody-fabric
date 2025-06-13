// @ts-nocheck
import FlaskService from "../service/flask.service";
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "express";
import fs from "fs";
import { logger } from "../logger";
import { faceVerificationService } from "../service/face-verification.service";
const flaskService = new FlaskService("http://localhost:5000")

const getUserFaceEmbedding = async (req: Request, res: Response) => {
    logger.info(`Uploaded file: ${req.file}`);
    if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'No image uploaded' });
        return;
    }
    const imagePath: string = req.file.path;
    logger.info(`imagepath --> ${imagePath}`)
    if (!imagePath) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Failed to extract face embedding"
        });
        return;
    }

    if (!fs.existsSync(imagePath)) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: "Image file does not exist"
        });
        return;
    }

    const response: number[] | string = await flaskService.getFaceEmbedding(imagePath)

    logger.info(`there is response ${response}`)
    if (typeof response == "string") {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: response
        })
        return;
    }
    else {
        res.status(StatusCodes.OK).json({
            embedding: response
        });
        return;
    }
}

const verifyUserFace = async (req: Request, res: Response) => {
    const { embedding1, embedding2 } = req.body
    if (embedding1 === "" || embedding2 === '') {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: "Missing Required Fields"
        })
        return;
    }
    const response: string = await flaskService.verifyFace(embedding1, embedding2)
    console.log(`response from controller --> ${response}`)
    if (!response) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Failed to verify face"
        })
        return;
    }

    if (response == "false") {
        res.status(StatusCodes.OK).json({
            message: response,
        })
        return;
    }

    const verificationSecret = faceVerificationService.generateSecret();
    res.status(StatusCodes.OK).json({
        message: response,
        face_verification_secret: verificationSecret
    })
}

const extractUserInfo = async (req: Request, res: Response) => {
    if (!req.files || !req.files.front || !req.files.back) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: "Both images are required"
        });
        return;
    }
    const frontImagePath = req.files.front[0].path; // Using [0] because it's an array
    const backImagePath = req.files.back[0].path;

    const response = await flaskService.processCardId(frontImagePath, backImagePath)

    if (!response) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Operation Failed"
        })
        return;
    }
    // {
    //     data: {
    //         address: 'دمباط عع ماشارع ابراا رذا _  الثانية دمباط',
    //             id: [ '١١١١1١١١١١١١١١' ],
    //             job: '',
    //             name: 'وليد جون سيتيزن ويليامز'
    //     },
    //     status: 'success'
    // }

    // Generate face verification secret if national ID is present in the response

    res.status(StatusCodes.OK).json({
        message: "Operation Done",
        data: response
    });
}
export {
    getUserFaceEmbedding,
    verifyUserFace,
    extractUserInfo
}