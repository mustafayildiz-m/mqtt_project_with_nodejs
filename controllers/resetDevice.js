const mqtt = require("mqtt");
// const pgService = require("../service/pgService");

exports.resetDevice = async function (req, res) {
    try {
        const client = await mqtt.connect(process.env.MQTT_HOST_NAME, {
            clean: true,
            connectTimeout: 4000,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            reconnectPeriod: 1000,
        })
        //let pgClient = new pgService();
        client.on("error", (err) => {
            res.json(err)
            res.end()
        });
        await client.on("connect", async () => {
            await client.publish(`superlog/reset/${req.body.topic}`);
            console.log("Cihaz Resetlendi.");

            res.status(200).send({message: 'success'})
            res.end();

        })


    } catch (error) {
        console.log(error.message)
        return res.status(400).json({status: 400, message: error.message});


    }
}