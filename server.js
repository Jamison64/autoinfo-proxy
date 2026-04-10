const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;

const USER_ID = "17292";
const AUTH_CODE = "LY9-P98-KK2";

function getMakes() {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:VehicleQueryD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:ReturnField>Make</tns:ReturnField>
      <tns:Make></tns:Make>
      <tns:Model></tns:Model>
      <tns:Year></tns:Year>
      <tns:SeriesChassis></tns:SeriesChassis>
      <tns:Engine></tns:Engine>
      <tns:AU>true</tns:AU>
      <tns:NZ>true</tns:NZ>
      <tns:PA>true</tns:PA>
      <tns:LC>true</tns:LC>
      <tns:MC>false</tns:MC>
      <tns:HC>false</tns:HC>
      <tns:SeriesCheck>false</tns:SeriesCheck>
      <tns:ChassisCheck>false</tns:ChassisCheck>
      <tns:CallingIPAddress></tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
    </tns:VehicleQueryD>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/VehicleQueryD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };

    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });

    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/myip") {
    https.get("https://api.ipify.org?format=json", (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      });
    });
  } else if (req.url === "/makes") {
    try {
      const xml = await getMakes();
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "AutoInfo Proxy Running" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
