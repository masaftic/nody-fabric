import CustomApiError from "./CustomApi.error";
import {StatusCodes} from "http-status-codes";


class BadRequestError extends CustomApiError{
    constructor(message:string = "Bad Request") {
        super(message, StatusCodes.BAD_REQUEST);
        this.name = "BadRequestError"
    }
}
export default BadRequestError;