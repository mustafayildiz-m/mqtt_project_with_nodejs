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
                let topic_device = `superlog/${statu}/${topic}`;
                console.log(statu)
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
                        try {
                            await client.subscribe(`superlog/${topic}`);
                            let msgWifi
                            if (req.body.wifi.ip_set) {
                                msgWifi = {
                                    ssid: req.body.wifi.ssid,
                                    password: req.body.wifi.password,
                                    ip_set: true,// true ise statik , false ise dinamk olacak
                                    ip: req.body.wifi.ip,
                                    submask: req.body.wifi.submask,
                                    gateway: req.body.wifi.gateway,
                                    dns: req.body.wifi.dns
                                }
                            } else {
                                msgWifi = {
                                    ssid: req.body.wifi.ssid,
                                    password: req.body.wifi.password,
                                    ip_set: false,// true ise statik , false ise dinamk olacak
                                }
                            }
                            console.log(msgWifi)
                            await client.publish(
                                topic_device,
                                JSON.stringify(msgWifi),
                                {qos: 2}, async (err) => {
                                    if (err) console.error(err)
                                }
                            );

                            // Handle incoming messages
                            client.on('message', async (receivedTopic, message) => {
                                let parsedObj = JSON.parse(message.toString());
                                console.log(parsedObj);

                                if (parsedObj.statu === 'ok') {
                                    console.log("içerde")
                                    await client.publish(`superlog/reset/${topic}`, JSON.stringify({"statu": "reset"}), {qos: 2});

                                    res.status(200).send({message: 'success'})
                                    res.end();
                                    await client.unsubscribe(`superlog/${topic}`, (error) => {
                                        if (error) {
                                            console.error('wifi bilgileri eklenemedi:', error);
                                        } else {
                                            console.log('wifi bilgileri eklendi:', topic);
                                        }
                                    });
                                } else {
                                    res.status(200).send({message: 'error'})
                                    res.end();
                                }

                            });
                        } catch (e) {
                            console.log(e.message)
                            return res.status(400).json({status: 400, message: e.message});

                        }

                        break;
                    case "ethernet":
                        try {
                            await client.subscribe(`superlog/${topic}`);
                            let msgEthernet
                            if (req.body.ethernet.ip_set) {
                                msgEthernet = {
                                    ip_set: true,// true ise statik , false ise dinamk olacak
                                    ip: req.body.ethernet.ip,
                                    submask: req.body.ethernet.ip,
                                    gateway: req.body.ethernet.gateway,
                                    dns: req.body.ethernet.dns
                                }
                            } else {
                                msgEthernet = {
                                    ip_set: false,// true ise statik , false ise dinamk olacak
                                }
                            }
                            await client.publish(
                                topic_device,
                                JSON.stringify(msgEthernet),
                                {qos: 2}, async (err) => {
                                    if (err) console.error(err)
                                }
                            );

                            // Handle incoming messages
                            client.on('message', async (receivedTopic, message) => {
                                let parsedObj = JSON.parse(message.toString());
                                console.log(parsedObj);

                                if (parsedObj.statu === 'ok') {
                                    // await client.publish(`superlog/reset/${topic}`);
                                    res.status(200).send({message: 'success'})
                                    res.end();
                                    await client.unsubscribe(`superlog/${topic}`, (error) => {
                                        if (error) {
                                            console.error('ethernet bilgileri eklenemedi:', error);
                                        } else {
                                            console.log('ethernet bilgileri eklendi:', topic);
                                        }
                                    });
                                } else {
                                    res.status(200).send({message: 'error'})
                                    res.end();
                                }

                            });
                        } catch (e) {
                            return res.status(400).json({status: 400, message: e.message});

                        }
                        break;
                    case "trashold":
                        try {
                            await client.subscribe(`superlog/${topic}`);

                            await client.publish(
                                topic_device,
                                JSON.stringify({
                                    temp_min: parseFloat(req.body.trashold.temp_min),
                                    moisture_min: parseFloat(req.body.trashold.moisture_min),
                                    temp_max: parseFloat(req.body.trashold.temp_max),
                                    moisture_max: parseFloat(req.body.trashold.moisture_max),
                                    crit_temp_min: parseFloat(req.body.trashold.crit_temp_min),
                                    crit_moisture_min: parseFloat(req.body.trashold.crit_moisture_min),
                                    crit_temp_max: parseFloat(req.body.trashold.crit_temp_max),
                                    crit_moisture_max: parseFloat(req.body.trashold.crit_moisture_max)
                                }),
                                {qos: 2}, async (err) => {
                                    if (err) console.error(err)

                                    const query = {
                                        text: 'INSERT INTO device_temp_hum_limits (temp_min,moisture_min,temp_max, moisture_max,crit_temp_min,crit_moisture_min, crit_temp_max, crit_moisture_max,serial_no) VALUES ($1, $2, $3,$4,$5,$6,$7,$8,$9)',
                                        values: [
                                            parseFloat(req.body.trashold.temp_min),
                                            parseFloat(req.body.trashold.moisture_min),
                                            parseFloat(req.body.trashold.temp_max),
                                            parseFloat(req.body.trashold.moisture_max),
                                            parseFloat(req.body.trashold.crit_temp_min),
                                            parseFloat(req.body.trashold.crit_moisture_min),
                                            parseFloat(req.body.trashold.crit_temp_max),
                                            parseFloat(req.body.trashold.crit_moisture_max),
                                            req.body.topic
                                        ],
                                    };
                                    const result = await pgClient.client.query(query);
                                    console.log('Yeni kayıt eklendi:', result.rowCount, 'satır etkilendi.');

                                }
                            );
                            // Handle incoming messages
                            client.on('message', async (receivedTopic, message) => {
                                let parsedObj = JSON.parse(message.toString());
                                console.log(parsedObj);

                                if (parsedObj.statu === 'ok') {
                                    //await client.publish(`superlog/reset/${topic}`, JSON.stringify({"statu": "reset"}), {qos: 2});
                                    res.status(200).send({message: 'success'})
                                    res.end();
                                    await client.unsubscribe(`superlog/${topic}`, (error) => {
                                        if (error) {
                                            console.error('Abonelikten çıkış başarısız:', error);
                                        } else {
                                            console.log('Abonelikten çıkıldı:', topic);
                                        }
                                    });
                                } else {
                                    res.status(200).send({message: 'error'})
                                    res.end();
                                }

                            });


                        } catch (e) {
                            return res.status(400).json({status: 400, message: e.message});

                        }

                        break;
                    case "smtp":
                        await client.publish(
                            topic_device,
                            JSON.stringify({
                                server: "server name",
                                login_email: "name",
                                login_password: "string",
                                port: 3000, // number
                                sender_mail: "string",
                                to_mail: "string",
                                mail_header: "string",
                                mail_subject: "string"
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
                            offline_cycle: 5,// veri kaç dk da göndersin (min 5 dk olacak) 5 değerinin altı olmamalı.
                            alert_cycle: 3 // sıcaklık derecesi alarm durmuna geçtiğinde kaç sn de bir veri göndersin
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