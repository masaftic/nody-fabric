// @ts-nocheck
import FlaskService from "../service/flask.service";
import {StatusCodes} from "http-status-codes";

import {logger} from "../logger";
const flaskService = new FlaskService("http://localhost:5000")

const getUserFaceEmbedding = async (req:Request, res:Response) => {

    logger.info(req.url)
    if(!req.file){
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'No image uploaded' });
    }
    const imagePath:string = req.file.path;
    logger.info(`imagepath --> ${imagePath}`)
    if(!imagePath)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message:"Faild to extract face embedding"
        })

    const response : number[] | string = await flaskService.getFaceEmbedding(imagePath)

    logger.info(`there is response ${response}`)
    if(typeof response == "string")
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: response
        })
    else{
        return res.status(StatusCodes.OK).json({
            embedding:response
        })
    }
}

const verifyUserFace = async (req:Request, res:Response) => {
    const {embedding1, embedding2} = req.body
    if (embedding1 === "" || embedding2 === '')
        return res.status(StatusCodes.BAD_REQUEST).json({
            message:"Missing Required Falids"
        })
    const response : string = await flaskService.verifyFace(embedding1, embedding2)
    console.log(`response from controller --> ${response}`)
    if(!response)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message:"Faild to verify face"
        })
    return  res.status(StatusCodes.OK).json({
        message:response
    })
}

const extractUserInfo = async (req: Request, res: Response) => {
    if (!req.files || !req.files.front || !req.files.back) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            message:"Both images are required"
        });
    }
    const frontImagePath = req.files.front[0].path; // Using [0] because it's an array
    const backImagePath = req.files.back[0].path;

    const response = await flaskService.processCardId(frontImagePath, backImagePath)

    if(!response)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            "message" :"Operation Falid"
        })
    // {
    //     data: {
    //         address: 'دمباط عع ماشارع ابراا رذا _  الثانية دمباط',
    //             id: [ '١١١١1١١١١١١١١١' ],
    //             job: '',
    //             name: 'وليد جون سيتيزن ويليامز'
    //     },
    //     status: 'success'
    // }
    return res.status(StatusCodes.OK).json({
        message:"Operation Done"
    })
}
export {
    getUserFaceEmbedding,
    verifyUserFace,
    extractUserInfo
}