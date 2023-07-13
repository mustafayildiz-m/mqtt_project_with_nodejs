# Superlog MQTT App 



Superlog MQTT App is a communication protocol with features specifically targeted at IoT solutions: Uses TCP connections, for reliability (assured delivery and packet error checking), fragmentation and ordering. Aims to minimize data overhead of each MQTT packet

```bash
npm install
```
Use the package manager [npm](https://nodejs.org/en/download) to install Superlog packages.


```bash
npm run dev
```
Run the project


## Usage

```nodejs
const mqttService = require("./service/mqttService");
var mqttClient = new mqttService(process.env.MQTT_HOST_NAME, registeredDevices);

mqttClient.connecter()
# connect to mqtt message broker and listen topics

mqttClient.subscriber();
# subscribe topics

```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[Supercode](https://supercode.com.tr/)