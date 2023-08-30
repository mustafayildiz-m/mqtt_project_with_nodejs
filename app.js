const express = require("express");
const publish = require("./routes/publish");
const app = express();
require('dotenv').config()
const mqtt = require("mqtt");
const pgService = require("./service/pgService");
//const nodemailer = require('nodemailer');
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use("/", publish); // ----> restful route
//let sendEmail = require('./service/mqttEmailAlert'); (performans yavaş olursa nodejs ten istek atılacak)

let sendData2LaravelApi = require('./service/sendData2LaravelApi')


let mqttClient = mqtt.connect(process.env.MQTT_HOST_NAME, {
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000,
})
let pgClient = new pgService();

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

// Değişkenler
    const devices = {}; // Cihazları saklayacak nesne
    const emailInterval = 1 * 60 * 1000; // 15 min (15 min x 60 second x 1000 ms)


    await mqttClient.on("message", async (topic, message) => {
        //this part will work as long as a message is received from the device.
        let parsedObj = JSON.parse(message.toString());
        if (topic === "superlog/register") {
            let {connection_type, serial_no} = parsedObj
            let created_at = new Date()
            let master_key = encrypteData(created_at, serial_no) // gelen seri numarasını encrypte edilerek şifrelenir

            await pgClient.client.query("SELECT serial_no,created_at,master_key FROM devices WHERE serial_no = $1", [serial_no], async (err, res) => { // register ile gelen seri numarası db de varmı kontrol
                if (err) console.error(err)
                console.log("kayıtlı cihaz sayısı->", res.rowCount)
                if (res.rowCount === 0) {//If there is no registered device
                    await pgClient.client.query('INSERT INTO devices(device_name,serial_no, master_key,connection_type,created_at,device_img) VALUES($1,$2,$3,$4,$5,$6)', [
                        `device_${serial_no}`,
                        serial_no,
                        master_key,
                        connection_type === 0 ? 'ethernet' : 'wifi',
                        created_at,
                        '/images/51BbzkxcseL.jpg'
                    ], async (err, res) => { // burada cihazın varsayılan değerleri db ye yazılır
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

                    try {
                        await pgClient.client.query('INSERT INTO device_temp_hum_limits(serial_no,created_at) VALUES($1,$2)', [
                            serial_no,
                            created_at,
                        ]) // ısı nem limit bilgileri
                        await pgClient.client.query('INSERT INTO device_connection_infos(serial_no,connection_type,created_at) VALUES($1,$2,$3)', [
                            serial_no,
                            connection_type,
                            created_at,
                        ]) // bağlantı bilgileri
                        await pgClient.client.query('INSERT INTO device_infos(serial_no,connection_type,created_at) VALUES($1,$2,$3)', [
                            serial_no,
                            connection_type,
                            created_at,
                        ]) // cihaz statik bilgileri
                        await pgClient.client.query('INSERT INTO wifi_dynamics(serial_no,created_at) VALUES($1,$2)', [
                            serial_no,
                            created_at,
                        ]) // cihaz wifi dinamik bilgileri
                        await pgClient.client.query('INSERT INTO ethernet_dynamics(serial_no,created_at) VALUES($1,$2)', [
                            serial_no,
                            created_at,
                        ]) // cihaz ethernet dinamik bilgileri
                    } catch (e) {
                        console.error('Error occurred:', e);

                    }


                }
            })


        } else { //register topic dışında sensor log ile ilgili datalar buraya düşer
            let serial_no = topic.split('/')[1]
            await pgClient.client.query("SELECT * FROM devices WHERE serial_no = $1", [serial_no], async (err, res) => {
                if (err) console.error(err)
                if (res.rowCount === 1) {
                    switch (parsedObj.statu) {
                        case "info":
                            console.log(parsedObj)
                            try {
                                // Run the query to find data
                                const query12 = 'SELECT * FROM device_infos WHERE serial_no = $1';
                                const params1 = [serial_no]; // Value to search for
                                const issetDevice = await pgClient.client.query(query12, params1);
                                if (issetDevice.rowCount > 0) {
                                    const result = await pgClient.client.query('UPDATE device_infos SET product_brand = $1, hostname = $2, ethernet_mac = $3, wifi_mac = $4, hardware_version = $5 ,  firmware_version = $6, connection_type = $7 ,mqtt_url = $8, mqtt_port = $9 WHERE serial_no = $10', [
                                        parsedObj.product_brand,
                                        parsedObj.hostname,
                                        parsedObj.ethernet_mac,
                                        parsedObj.wifi_mac,
                                        parsedObj.hardware_version,
                                        parsedObj.firmware_version,
                                        parsedObj.connection_type === 0 ? 'ethernet' : 'wifi',
                                        parsedObj.mqtt_url,
                                        parsedObj.mqtt_port,
                                        serial_no
                                    ]);
                                    console.log('Rows affected:', result.rowCount);

                                }

                            } catch (error) {
                                console.error('Error occurred:', error);
                            }

                            break;
                        case "ok":
                            let retValOk = {
                                statu: "ok",
                                connection_type: 0,//0 ise ethernet 1 ise wifi
                            }
                            console.log(message.toString())
                            break;
                        case "trashold":
                            console.log(parsedObj)

                            if (!devices[serial_no]) {
                                devices[serial_no] = {
                                    lastStatus: '', // Son durum bilgisi
                                    lastEmailTimestamp: 0, // Son e-posta gönderim zamanı
                                };
                            }
                            try {
                                //** mail sending process start *//
                                let {state} = parsedObj;
                                console.log(state, "state")

                                const currentTime = Date.now();
                                const deviceData = devices[serial_no];
                                if (state === parseInt(process.env.ALARM) || state === parseInt(process.env.CRITICAL_ALARM)) { // gelen durum alarm yada critik alarmsa mail uyarı gönder
                                    if (
                                        currentTime - deviceData.lastEmailTimestamp >= emailInterval ||
                                        (state !== deviceData.lastStatus &&
                                            currentTime - deviceData.lastEmailTimestamp >= emailInterval)
                                    ) {
                                        //get mail
                                        let result = await pgClient.client.query('SELECT allowed_email,allowed_workspace_id FROM allowed_user_and_workspaces WHERE allowed_device_serial_no = $1 LIMIT 1;', [serial_no])
                                        let allowed_email = ''
                                        let allowed_workspace_id = ''
                                        if (result.rows.length > 0) { //eğer cihaza kayıtlı email varsa
                                            allowed_email = result.rows[0].allowed_email;
                                            allowed_workspace_id = result.rows[0].allowed_workspace_id;
                                            console.log('owner e-mail ->:', allowed_email);
                                            //get logs
                                            let deviceLimits = await getLimits(serial_no);
                                            // let deviceLimits = "1"
                                            let zone = await getZone(serial_no);
                                            let sendObj2Laravel = {
                                                parsedObj,
                                                serial_no,
                                                allowed_email,
                                                allowed_workspace_id,
                                                deviceLimits,
                                                zone
                                            }
                                            await sendData2LaravelApi(sendObj2Laravel) // datalar laravel tarafına mail atılması için gönderi
                                            //await sendEmail(parsedObj, serial_no, allowed_email, deviceLimits, zone);


                                        }

                                        deviceData.lastEmailTimestamp = currentTime;
                                    }
                                } else if (state === process.env.NORMAL) {
                                    devices[serial_no] = {
                                        lastStatus: '', // Son durum bilgisi
                                        lastEmailTimestamp: 0, // Son e-posta gönderim zamanı
                                    };

                                }
                                deviceData.lastStatus = state;

                                //** mail sending process end *//


                                getLastRecordId(serial_no)
                                    .then(async (limit_id) => {
                                        await pgClient.client.query('INSERT INTO device_logs(serial_no,humd,temp, state,created_at,connection_type,limit_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [
                                                serial_no,
                                                parsedObj.humd,
                                                parsedObj.temp,
                                                parsedObj.state,
                                                convertDate(parsedObj.timestamp),
                                                // new Date(),
                                                parsedObj.connection_type === 0 ? 'ethernet' : 'wifi',
                                                limit_id
                                            ],
                                            async (err, res) => {
                                                if (err) console.error(err)
                                            }
                                        )

                                    })
                                    .catch((err) => {
                                        console.error('Hata:', err);
                                    });


                            } catch (error) {
                                console.error('Error occurred:', error);

                            }

                            break;
                        case "network":
                            console.log(parsedObj)
                            try {
                                // Run the query to find data
                                const device = await pgClient.client.query('SELECT * FROM device_connection_infos WHERE serial_no = $1', [serial_no]);
                                if (device.rowCount > 0) {
                                    // Değerleri güncellemek ve koşulunu belirtmek için kullanılır
                                    const result = await pgClient.client.query('UPDATE device_connection_infos SET ssid = $1, password = $2 WHERE serial_no = $3', [
                                        parsedObj.ssid,
                                        parsedObj.password,
                                        serial_no]);
                                    if (parsedObj.connection_type === 1) {
                                        //wifi dinamik connection info bilgileri
                                        await pgClient.client.query('UPDATE device_connection_infos SET ssid = $1, password = $2 , connection_type = $3 WHERE serial_no = $4', [
                                            parsedObj.ssid,
                                            parsedObj.password,
                                            1,
                                            serial_no]);


                                        await pgClient.client.query('UPDATE wifi_dynamics SET ip = $1, submask = $2 ,gateway = $3 , dns = $4, created_at=$5 WHERE serial_no = $6', [
                                            parsedObj.ip,
                                            parsedObj.submask,
                                            parsedObj.gateway,
                                            parsedObj.dns,
                                            new Date(),
                                            serial_no,
                                        ]);

                                    } else {
                                        //ethernet dinamik connection info bilgileri

                                        await pgClient.client.query('UPDATE device_connection_infos SET connection_type=$1 WHERE serial_no = $2', [
                                            0,
                                            serial_no]);
                                        await pgClient.client.query('UPDATE ethernet_dynamics SET ip = $1, submask = $2 ,gateway = $3 , dns = $4, created_at=$5 WHERE serial_no = $6', [
                                            parsedObj.ip,
                                            parsedObj.submask,
                                            parsedObj.gateway,
                                            parsedObj.dns,
                                            new Date(),
                                            serial_no,
                                        ]);
                                    }
                                    console.log('Rows affected:', result.rowCount);

                                }
                            } catch (error) {
                                console.error('Error occurred:', error);

                            }

                            break;
                        default:
                            console.log('topic is not true');
                            break;
                    }


                }
            })
        }
    });
});

const getLimits = async (serial_no) => {
    const logResult = await pgClient.client.query('SELECT limit_id FROM device_logs WHERE serial_no = $1 AND state IN ($2, $3) ORDER BY id DESC LIMIT 1;', [serial_no, parseInt(process.env.CRITICAL_ALARM), parseInt(process.env.ALARM)]);
    if (logResult.rows.length > 0) {
        const limitId = logResult.rows[0].limit_id;
        // device_temp_hum_limits tablosundaki id ile eşleştirip device_temp_hum_limits tablosundaki değerleri alıyoruz
        const limitResult = await pgClient.client.query('SELECT * FROM device_temp_hum_limits WHERE id = $1;', [limitId]);
        let deviceLimits = ''
        if (limitResult.rows.length > 0) {
            deviceLimits = limitResult.rows[0];

        }
        return deviceLimits;
    } else {
        const limitResult = await pgClient.client.query('SELECT * FROM device_temp_hum_limits WHERE serial_no = $1 ORDER BY id DESC LIMIT 1', [serial_no]);
        let deviceLimits1 = ''
        if (limitResult.rows.length > 0) {
            deviceLimits1 = limitResult.rows[0];

        }
        return deviceLimits1;
    }
}
const getZone = async (serial_no) => {
    try {
        const zoneResult = await pgClient.client.query('SELECT zone_id FROM devices WHERE serial_no = $1;', [serial_no]);
        if (zoneResult.rows.length > 0) {
            const zoneId = zoneResult.rows[0].zone_id;
            //const nameResult = await pgClient.client.query('SELECT name FROM zones WHERE id = $1;', [zoneId]);
            return zoneId;

        } else {
            return "bolgeyok";
        }

    } catch (e) {
        console.error('Error occurred:', e.message);
    }

}

async function getLastRecordId(serial_no) {
    try {
        const result = await pgClient.client.query('SELECT id FROM device_temp_hum_limits WHERE serial_no = $1 ORDER BY id DESC LIMIT 1', [serial_no]);
        if (result.rowCount === 0) {
            const queryText = 'INSERT INTO device_temp_hum_limits(serial_no) VALUES($1) RETURNING id';
            await pgClient.client.query(queryText, [serial_no]).then((res) => {
                return res.rows[0].id;
            })
        } else {
            return result.rows[0].id; // ID'yi döndürür
        }
    } catch (err) {
        console.error('Sorgu hatası:', err);
        throw err;
    }
}

mqttClient.on("close", () => {
    console.log(`MQTT client disconnected`);
});

let convertDate = (unixTime) => {
    const date = new Date(unixTime * 1000); // Unix time is in seconds, so multiply by 1000 to convert to milliseconds

// Extract the various components of the date
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // Months are zero-based, so add 1
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

// Create a formatted string
    const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return formattedDate + ' ' + formattedTime

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