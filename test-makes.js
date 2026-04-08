const axios = require("axios");

const USER_ID = "17292";
const AUTH_CODE = "LY9-P98-KK2";

const url = "http://test.autoinfo.com.au/API/AutoInfoGateway.asmx";

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

async function getMakes() {
  try {
    const res = await axios.post(url, soapBody, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/VehicleQueryD",
      },
    });
    console.log("Response:", res.data);
  } catch (err) {
    console.error("Status:", err.response?.status);
    console.error("Response body:", err.response?.data);
  }
}

getMakes();
