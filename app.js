const express = require("express");
const publish = require("./routes/publish");
const app = express();
require('dotenv').config()
const mqtt = require("mqtt");
const pgService = require("./service/pgService");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use("/", publish); // ----> restful route

let mqttClient = mqtt.connect(process.env.MQTT_HOST_NAME, {
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000,
})
let pgClient = new pgService()
mqttClient.on("error", (err) => {
    if (err) console.error(err)
    mqttClient.end();
});


//** Subscribe start here **//
mqttClient.on("connect", async () => {
    console.log('Mqtt Connected')
    await mqttClient.subscribe(`superlog/register`, {qos: 2}); // subscribe to register topic
    await pgClient.client.query("select serial_no,created_at,master_key from devices", async (err, res) => { // subscribe to the devices in the database
        if (err) throw new Error(err)
        for (const device in res.rows) {
            if (decrypteData(res.rows[device].master_key) === getHourAndSerialNo(res.rows[device].created_at, res.rows[device].serial_no)) {
                await mqttClient.subscribe(`superlog/${res.rows[device].serial_no}`, {qos: 2});
            }
        }
    })
    //** subscribe section end **//

    await mqttClient.on("message", async (topic, message) => {
        //this part will work as long as a message is received from the device.
        let parsedObj = JSON.parse(message.toString());
        if (topic === "superlog/register") {
            let {connection_type, serial_no} = parsedObj
            let created_at = new Date()
            let master_key = encrypteData(created_at, serial_no) // gelen seri numarasını encrypte edilerek şifrelenir

            let pg_query = {
                text: "SELECT serial_no,created_at,master_key FROM devices WHERE serial_no = $1",
                values: [serial_no]
            }
            await pgClient.client.query(pg_query, async (err, res) => { // register ile gelen seri numarası db de varmı kontrol
                if (err) console.error(err)
                if (res.rowCount === 0) {//If there is no registered device
                    let pg_insert_device = {
                        text: 'INSERT INTO devices(device_name,serial_no, master_key,connection_type,created_at,device_img) VALUES($1,$2,$3,$4,$5,$6)',
                        values: [
                            `device_${serial_no}`,
                            serial_no,
                            master_key,
                            connection_type === 0 ? 'ethernet' : 'wifi',
                            created_at,
                            '/images/51BbzkxcseL.jpg'
                        ]
                    }
                    await pgClient.client.query(pg_insert_device, async (err, res) => { // burada cihazın varsayılan değerleri db ye yazılır
                        if (err) console.error(err)

                        //register olduktan sonra subscribe olma
                        if (decrypteData(master_key) === getHourAndSerialNo(created_at, serial_no)) {
                            console.log(`superlog/${serial_no}`)
                            await mqttClient.subscribe(`superlog/${serial_no}`)  //Subscribe to the device registered to the database
                            await mqttClient.publish(`"superlog/master"/${serial_no}`, JSON.stringify({
                                master_key
                            }), {qos: 2});
                        }
                    })
                    let max_min_temp_query = {
                        text: 'INSERT INTO device_temp_hum_limits(serial_no,created_at) VALUES($1,$2)',
                        values: [
                            serial_no,
                            created_at,
                        ]
                    }
                    await pgClient.client.query(max_min_temp_query)
                }
            })


        } else { //register topik dışında sensor log ile ilgili datalar buraya düşer
            let serial_no = topic.split('/')[1]
            let pg_query = {
                text: "SELECT * FROM devices WHERE serial_no = $1",
                values: [serial_no]
            }
            await pgClient.client.query(pg_query, async (err, res) => {
                if (err) console.error(err)
                if (res.rowCount > 0) {
                    switch (parsedObj.statu) {
                        case "info":
                            let {
                                product_brand,
                                hostname,
                                ethernet_mac,
                                wifi_mac,
                                hardware_version,
                                firmware_version,
                                connection_type
                            } = parsedObj;
                            let pgQuery = {
                                text: 'INSERT INTO device_infos(serial_no,product_brand, hostname,ethernet_mac,wifi_mac,hardware_version,firmware_version,connection_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
                                values: [
                                    serial_no,
                                    product_brand,
                                    hostname,
                                    ethernet_mac,
                                    wifi_mac,
                                    hardware_version,
                                    firmware_version,
                                    connection_type === 0 ? 'ethernet' : 'wifi'
                                ]
                            }
                            await pgClient.client.query(pgQuery, async (err, res) => {
                                if (err) console.error(err)
                            })
                            break;
                        case "ok":
                            let retValOk = {
                                statu: "ok",
                                connection_type: 0,//0 ise ethernet 1 ise wifi
                            }
                            console.log(message.toString())
                            break;
                        case "trashhold":
                            let {
                                humd, // nem
                                temp, //ısı
                                state, // string değer gelecek alarm yada normal olarak gelecek
                                timestamp, //unixtime format
                            } = parsedObj;

                            //limit sorgu
                            getLastRecordId(serial_no)
                                .then(async (limit_id) => {
                                    let pgQueryInsert = {
                                        text: 'INSERT INTO device_logs(serial_no,humd,temp, state,created_at,connection_type,limit_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
                                        values: [
                                            serial_no,
                                            humd,
                                            temp,
                                            state,
                                            // convertDate(timestamp),
                                            new Date(),
                                            parsedObj.connection_type === 0 ? 'ethernet' : 'wifi',
                                            limit_id
                                        ]
                                    }

                                    await pgClient.client.query(pgQueryInsert, async (err, res) => {
                                        if (err) console.error(err)
                                    })
                                })
                                .catch((err) => {
                                    console.error('Hata:', err);
                                });


                            break;
                    }

                    await mqttClient.publish(`"superlog/master"/${res.rows[0].serial_no}`, JSON.stringify({
                        master_key: res.rows[0].master_key
                    }), {qos: 2});

                }
            })
        }
    });
});

async function getLastRecordId(serial_no) {
    const query = {
        text: 'SELECT id FROM device_temp_hum_limits WHERE serial_no = $1 ORDER BY id DESC LIMIT 1',
        values: [serial_no],
    };
    try {
        const result = await pgClient.client.query(query);
        return result.rows[0].id; // ID'yi döndürür
    } catch (err) {
        console.error('Sorgu hatası:', err);
        throw err;
    }
}

mqttClient.on("close", () => {
    console.log(`MQTT client disconnected`);
});

let convertDate = (UNIX_timestamp) => {
    let a = new Date(UNIX_timestamp * 1000);
    return a.getFullYear() + '-' + a.getMonth() + '-' + a.getDate() + ' ' + a.getHours() + ':' + a.getMinutes() + ':' + a.getSeconds();
}

let encrypteData = (created_at, serial_no) => {
    return btoa(JSON.stringify(created_at + '-' + serial_no))
}
let decrypteData = master_key => {
    let arr = JSON.parse(atob(master_key)).split('-')
    let seri_no = arr[arr.length - 1]
    let time = JSON.parse(atob(master_key)).split(' ')[4].slice(0, -3)
    return time + '-' + seri_no
}
let getHourAndSerialNo = (date, serial_no) => {
    let hour = String(date).split(' ')[4]
    return hour.slice(0, -3) + '-' + String(serial_no)
}


app.listen(process.env.RESTFUL_PORT, process.env.RESTFUL_HOST, () => {
    console.log(`mqtt app listening on port ${process.env.RESTFUL_HOST}:${process.env.RESTFUL_PORT}`);
});