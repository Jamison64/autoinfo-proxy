const http = require("http");
const https = require("https");
const xml2js = require("xml2js");

const PORT = process.env.PORT || 3000;

const USER_ID = "17292";
const AUTH_CODE = "LY9-P98-KK2";

function vehicleQuery(
  returnField,
  make = "",
  model = "",
  year = "",
  seriesChassis = "",
  engine = "",
) {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:VehicleQueryD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:ReturnField>${returnField}</tns:ReturnField>
      <tns:Make>${make}</tns:Make>
      <tns:Model>${model}</tns:Model>
      <tns:Year>${year}</tns:Year>
      <tns:SeriesChassis>${seriesChassis}</tns:SeriesChassis>
      <tns:Engine>${engine}</tns:Engine>
      <tns:AU>true</tns:AU>
      <tns:NZ>true</tns:NZ>
      <tns:PA>true</tns:PA>
      <tns:LC>true</tns:LC>
      <tns:MC>false</tns:MC>
      <tns:HC>false</tns:HC>
      <tns:SeriesCheck>false</tns:SeriesCheck>
      <tns:ChassisCheck>false</tns:ChassisCheck>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
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

function parseVehicleResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const results =
          result["soap:Envelope"]["soap:Body"]["VehicleQueryDResponse"][
            "VehicleQueryDResult"
          ]["VehicleResult"]["VehicleResult"];
        const items = results.map((item) => ({
          text: item.SelectText,
          vehicleId: item.VehicleId,
        }));
        resolve(items);
      } catch (e) {
        reject(new Error("Failed to parse XML structure: " + e.message));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const path = parsedUrl.pathname;
  const params = parsedUrl.searchParams;

  if (path === "/myip") {
    https.get("https://api.ipify.org?format=json", (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      });
    });
  } else if (path === "/makes") {
    try {
      const xml = await vehicleQuery("Make");
      const makes = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(makes));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/models") {
    const make = params.get("make") || "";
    try {
      const xml = await vehicleQuery("Model", make);
      const models = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(models));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/years") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    try {
      const xml = await vehicleQuery("Year", make, model);
      const years = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(years));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/serieschassis") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    const year = params.get("year") || "";
    try {
      const xml = await vehicleQuery("SeriesChassis", make, model, year);
      const series = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(series));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/engine") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    const year = params.get("year") || "";
    const seriesChassis = params.get("seriesChassis") || "";
    try {
      const xml = await vehicleQuery(
        "Engine",
        make,
        model,
        year,
        seriesChassis,
      );
      const engines = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(engines));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/details") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    const year = params.get("year") || "";
    const seriesChassis = params.get("seriesChassis") || "";
    const engine = params.get("engine") || "";
    try {
      const xml = await vehicleQuery(
        "Details",
        make,
        model,
        year,
        seriesChassis,
        engine,
      );
      const details = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(details));
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
