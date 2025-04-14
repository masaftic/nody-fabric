
class CustomApiError extends Error {
    statusCode:number;
    isOperational:boolean;
    constructor(message:string, statusCode:number = 500) {
        super(message);
        this.name = this.constructor.name
        this.statusCode = statusCode;
        this.isOperational = true
        // This captures the stack trace in modern JS engines
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

}
export  default  CustomApiError;