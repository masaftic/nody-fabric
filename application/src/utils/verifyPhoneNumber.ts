

const verifyPhoneNumber = (phoneNumber:string):boolean =>{
    return (/^(?:\+20|0)?(1[0-9]{9}|2[0-9]{8,9}|(10|11|12|15)[0-9]{8})$/.test(phoneNumber))
}

export default verifyPhoneNumber;