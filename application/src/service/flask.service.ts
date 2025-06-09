import axios, {AxiosInstance, AxiosResponse, AxiosError} from "axios"
import formData from "form-data"
import fs from "fs"
import {logger} from "../logger";

interface FaceEmbeddingResponse{
    embedding?:number[],
    message?:string
}

interface FaceVerificationResponse{
    verify?:boolean,
    message?:string
}

interface CardProcessResponse {
    status?:'string',
    data?:any,
    message?:"string"
}
class FlaskService {

    private client: AxiosInstance;

    constructor(baseUrl:string) {
        this.client = axios.create(
            {
                baseURL:baseUrl || "http://localhost:8080",
                timeout: 10000 * 60
            }
        )
    }

    async getFaceEmbedding(imagePath:string) : Promise<number[] | string>{
        try{
            logger.info(`image path --> ${imagePath}`)
            const data = new formData();
            data.append("image",fs.createReadStream(imagePath))
            const response : AxiosResponse<FaceEmbeddingResponse> = await this.client.post(
                "/face/get-embedding",
                data,
                {
                    headers:data.getHeaders()
                }
            )
            fs.unlinkSync(imagePath);

            if (response.status === 400){
                return response.data.message as string
            }
            // @ts-ignore
            return response?.data[0].embedding as number[]
        }
        catch (e) {
            const axiosError = e as AxiosError
            return `Get Embedding Error, error ${axiosError.response?.data || axiosError.message}`
        }
    }

    async verifyFace(embedding1 : number[], embedding2:number []) : Promise<string>{
        try {
            const response: AxiosResponse<FaceVerificationResponse> = await this.client.post(
                "/face/verify",
                {
                    embedding1,
                    embedding2
                }
            )
            console.log(`response from flask -->`)
            // console.log(response)
            if(response.status === 400){
                return `${response.data.message}`
            }
            return `${response.data.verify}`
        }
        catch (e) {
            const axiosError = e as AxiosError;
            // console.error(
            //     'Face verification error:',
            //     axiosError.response?.data || axiosError.message
            // );
            return 'Face Verification Error'
        }
    }

    async processCardId(frontImagePath:string, backImagePath:string): Promise<CardProcessResponse | string> {
        try {
            const data = new formData()
            data.append('front',fs.createReadStream(frontImagePath))
            data.append('back', fs.createReadStream(backImagePath))

            const response: AxiosResponse<CardProcessResponse> = await this.client.post(
                "/face/process-id",
                data,
                {
                    headers:data.getHeaders()
                }
            )
            fs.unlinkSync(frontImagePath);
            fs.unlinkSync(backImagePath)
            console.log("response from flask")
            console.log(response.data)
            if(response.status === 400)
                return response.data.message as string
            return response.data
        }
        catch (e) {
            const axiosError = e as AxiosError;
            // console.error(
            //     'Face verification error:',
            //     axiosError.response?.data || axiosError.message
            // );
            return 'Process Card Error' as string
        }
    }
}

export default FlaskService;