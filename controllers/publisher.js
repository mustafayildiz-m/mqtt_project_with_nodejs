const mqtt = require("mqtt");
const pgService = require("../service/pgService");
exports.publishMQTTMessage = async function (req, res) {
    try {
        const client = await mqtt.connect(process.env.MQTT_HOST_NAME, {
            clean: true,
            connectTimeout: 4000,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            reconnectPeriod: 1000,
        })
        let pgClient = new pgService()

        client.on("error", (err) => {
            res.json(err)
            res.end()

        });

        let {topic, message, statu} = req.body
        await client.on("connect", async () => {
                let topic_device = `superlog/${statu}/${topic}`
                switch (statu) {
                    case "info":
                        await client.publish(topic_device, JSON.stringify({'status': 'info'}), {qos: 2});
                        break;
                    case "mqtt":
                        await client.publish(topic_device, JSON.stringify({
                            url: process.env.MQTT_PUPLISH,//string
                            port: process.env.MQTT_PORT, //int
                            username: process.env.MQTT_USERNAME,
                            password: process.env.MQTT_PASSWORD,
                            ssl: true // true ise ssl var , ssl yoksa false gönder
                        }), {qos: 2});
                        break;
                    case "wifi":
                        let msgWifi
                        if (message.ip_set) {
                            msgWifi = {
                                ssid: "burada wifi name",
                                pass: 'string',
                                ip_set: true,// true ise statik , false ise dinamk olacak
                                ip: 'string',
                                submask: 'string',
                                gateway: 'string',
                                dns: 'string data '
                            }
                        } else {
                            msgWifi = {
                                ssid: "burada wifi name",
                                pass: 'string',
                                ip_set: false,// true ise statik , false ise dinamk olacak
                            }
                        }
                        await client.publish(
                            topic_device,
                            JSON.stringify(msgWifi),
                            {qos: 2}
                        );
                        break;
                    case "ethernet":
                        let msgEthernet
                        if (message.ip_set) {
                            msgEthernet = {
                                ip_set: true,// true ise statik , false ise dinamk olacak
                                ip: 'string',
                                submask: 'string',
                                gateway: 'string',
                                dns: 'string data '
                            }
                        } else {
                            msgEthernet = {
                                ip_set: false,// true ise statik , false ise dinamk olacak
                            }
                        }

                        await client.publish(
                            topic_device,
                            JSON.stringify(msgEthernet),
                            {qos: 2}
                        );
                        break;
                    case "trashold":
                        try {
                            await client.publish(
                                topic_device,
                                JSON.stringify(req.body.trashold),
                                {qos: 2}, async (err) => {
                                    if (err) console.error(err)
                                    let {
                                        temp_min,
                                        moisture_min,
                                        temp_max,
                                        moisture_max,
                                        crit_temp_min,
                                        crit_moisture_min,
                                        crit_temp_max,
                                        crit_moisture_max
                                    } = req.body.trashold

                                    const query = {
                                        text: 'INSERT INTO device_temp_hum_limits (temp_min,moisture_min,temp_max, moisture_max,crit_temp_min,crit_moisture_min, crit_temp_max, crit_moisture_max,serial_no) VALUES ($1, $2, $3,$4,$5,$6,$7,$8,$9)',
                                        values: [
                                            parseInt(temp_min),
                                            parseInt(moisture_min),
                                            parseInt(temp_max),
                                            parseInt(moisture_max),
                                            parseInt(crit_temp_min),
                                            parseInt(crit_moisture_min),
                                            parseInt(crit_temp_max),
                                            parseInt(crit_moisture_max),
                                            req.body.topic
                                        ],
                                    };
                                    try {
                                        const result = await pgClient.client.query(query);
                                        console.log('Yeni kayıt eklendi:', result.rowCount, 'satır etkilendi.');

                                    } catch (e) {
                                        console.error('Sorgu hatası:', err);
                                        throw err;
                                    }

                                }
                            );
                            res.status(200).send({message: 'success'})
                            res.end()
                        } catch (e) {
                            return res.status(400).json({status: 400, message: e.message});

                        }

                        break;
                    case "smtp":
                        await client.publish(
                            topic_device,
                            JSON.stringify({
                                server: "server name",
                                user_name: "name",
                                password: "string",
                                port: 3000, // number
                                sender_mail: "string",
                                to_mail: "string",
                                mail_subject: "string",
                                mail_body: "string"
                            }),
                            {qos: 2}
                        );
                        break;
                    case "alert":
                        await client.publish(topic_device, JSON.stringify({
                            offline_alert: true // true ise
                        }), {qos: 2});
                        break;
                    case "cycle":
                        await client.publish(topic_device, JSON.stringify({
                            cycle: 3,  // herşey yolundaysa data bana kaç dk da bir gelecek dakika cinsinden gelecek
                            offline_cycle: 3,// veri kaç dk da göndersin
                            alert_cycle: 3 // veri kaç dk da göndersin
                        }), {qos: 2});
                        break;
                    case "ntp":
                        await client.publish(topic_device, JSON.stringify({
                            server: "string değer girilecek",// pool.ntp.org
                            gmt: -12, // -12 ile 10 arasında
                        }), {qos: 2});
                        break;

                }
            }
        )
    } catch (error) {
        return res.status(400).json({status: 400, message: error.message});
    }
};