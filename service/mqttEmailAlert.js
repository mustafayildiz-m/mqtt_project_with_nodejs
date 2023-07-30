const nodemailer = require("nodemailer");
const emailConfig = {
    host: 'proxy.uzmanposta.com',
    port: 587,
    secure: false,
    auth: {
        user: 'info@arsiwi.com',
        pass: 'Aa.159357*',
    },
};
const transporter = nodemailer.createTransport(emailConfig);

function sendEmail(object, serial_no, allowed_email, deviceLimits, zone) {
    const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Alarm</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
        }
        h1 {
          color: #ff0000;
        }
        p {
          margin: 10px 0;
        }
        .alert {
          color: #DC3545;
          font-weight: bold;
        }
        .critical-alert {
          color: #FFC107;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <h1> Alarm Durumu : ${serial_no} Seri Numaralı Cihaz Uyarısı</h1>
      <p>Sıcaklık: ${object.temp} °C</p>
      <p>Nem: ${object.humd} %</p>
      <p>Durum: 
        <span class="alert">${object.state == 'alarm' ? 'Alarm' : 'Kritik Alarm'}</span>
      </p>
      <p>Bu e-posta otomatik olarak gönderilmiştir. Lütfen cevaplamayın.</p>
    </body>
    </html>
  `;


    const mailOptions = {
        from: 'mustafayildiz.m@gmail.com',
        to: allowed_email,
        subject: '📣 Alarm',
        html: emailTemplate,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('E-posta gönderilemedi:', error);
        } else {
            console.log('E-posta gönderildi:', info.response);
        }
    });
}

module.exports = sendEmail;