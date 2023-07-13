require('dotenv').config()

const pgService = require("./service/pgService");
let pgClient = new pgService()

pgClient.client.query("select serial_no,master_key,created_at from devices", async (err, res) => {
    if (err) throw new Error(err)
    let data = Buffer.from(JSON.stringify(res.rows[0].created_at), 'base64').toString('ascii')
    var encoded = btoa(JSON.stringify(res.rows[0].created_at+"-"+123))
    //console.log(encoded)

    console.log(JSON.parse(atob(encoded)))

})

//console.log( Buffer.from(String(MTIzNDU2MzIx), 'base64').toString('ascii'))