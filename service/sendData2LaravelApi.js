const axios = require('axios');
require('dotenv').config()

const sendData2LaravelApi = async (postData) => {
    console.log("içerde")
    try {
        const apiUrl = `${process.env.RESTFUL_LARAVEL_URL}api/send-email`; // endpoint
        const bufferData = Buffer.from(postData.serial_no, 'utf-8');
        const base64Encoded = bufferData.toString('base64');
        const config = {
            headers: {
                'X-Device-Serial-Number': base64Encoded, // seri numara cripto
            },
        };
        let result = await axios.post(apiUrl, postData, config)
        console.log(result.data)
    } catch (e) {
        console.error(e.message)
    }
}

module.exports = sendData2LaravelApi;

